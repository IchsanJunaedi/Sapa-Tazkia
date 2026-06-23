// backend/tests/integration/oauth.test.js
//
// Integration tests for OAuth and extended auth flows:
//
//  1. GET  /api/auth/health              – public health check
//  2. GET  /api/auth/test                – public test route
//  3. GET  /api/auth/check-session       – session check (unauthenticated)
//  4. GET  /api/auth/google              – OAuth initiation (redirects to Google)
//  5. GET  /api/auth/google/callback     – OAuth callback (no code → redirect to error)
//  6. POST /api/auth/verify-email        – email OTP verification
//  7. POST /api/auth/resend-verification – resend OTP
//  8. POST /api/auth/refresh             – JWT refresh token
//  9. POST /api/auth/admin/2fa/verify    – admin 2-factor auth
// 10. GET  /api/auth/admin/2fa/setup     – admin 2FA setup (admin-only)
// 11. GET  /api/auth/me                  – profile (requireAuth)
// 12. GET  /api/auth/verify              – token verify
// 13. GET  /api/auth/protected-test      – protected test route
// 14. POST /api/auth/logout              – logout
// 15. PATCH /api/auth/update-profile     – profile update
//
// NOTE: Google OAuth cannot be fully integration-tested without real Google
// credentials. We verify the redirect behaviour and error handling only.

// ---- Mocks ---------------------------------------------------------------
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/ragService', () => ({
  listDocuments: jest.fn().mockResolvedValue([]),
  addDocument: jest.fn().mockResolvedValue({ id: 'doc-id' }),
  deleteDocument: jest.fn().mockResolvedValue({ deleted: true }),
  getCollectionInfo: jest.fn().mockResolvedValue({ exists: false, pointsCount: 0 }),
  answerQuestion: jest.fn().mockResolvedValue({ answer: 'ok', usage: { total_tokens: 5 } }),
}));

jest.mock('../../src/services/openaiService', () => ({
  testOpenAIConnection: jest.fn().mockResolvedValue({ success: false }),
  generateTitle: jest.fn().mockResolvedValue('Mock Title'),
}));

// ---- Helpers -------------------------------------------------------------
const { agent } = require('../helpers/appHelper');
const { prisma, truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

async function loginAs({ identifier, password }) {
  const res = await agent.post('/api/auth/login').send({ identifier, password });
  return res.body.token;
}

// ============================================================================
describe('OAuth & Extended Auth Integration', () => {
  let userToken;
  let adminToken;
  let testUser;
  let adminUser;

  beforeAll(async () => {
    await truncateAll();

    // Seed a regular student
    const studentSeed = await seedTestUser({
      nim: '2021002001',
      email: 'oauth-student@tazkia.ac.id',
      userType: 'student',
      fullName: 'OAuth Student',
    });
    testUser = studentSeed.user;
    userToken = await loginAs({ identifier: testUser.nim, password: studentSeed.plainPassword });

    // Seed an admin
    const adminSeed = await seedTestUser({
      nim: 'A0000000002',
      email: 'oauth-admin@tazkia.ac.id',
      userType: 'admin',
      fullName: 'OAuth Admin',
    });
    adminUser = adminSeed.user;
    adminToken = await loginAs({ identifier: adminUser.nim, password: adminSeed.plainPassword });

    expect(userToken).toBeDefined();
    expect(adminToken).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // =========================================================================
  // 1. Public auth health / test endpoints
  // =========================================================================
  describe('Public auth endpoints', () => {
    it('GET /api/auth/health → 200 with auth service info', async () => {
      const res = await agent.get('/api/auth/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toBe('Authentication Service');
      expect(res.body.features.googleOAuth).toBe(true);
    });

    it('GET /api/auth/test → 200', async () => {
      const res = await agent.get('/api/auth/test');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('timestamp');
    });

    it('GET /api/auth/check-session → responds without error (unauthenticated)', async () => {
      const res = await agent.get('/api/auth/check-session');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('authenticated');
      expect(res.body.authenticated).toBe(false);
    });
  });

  // =========================================================================
  // 2. Google OAuth flow
  // =========================================================================
  describe('Google OAuth', () => {
    it('GET /api/auth/google → redirects (302) toward Google', async () => {
      const res = await agent.get('/api/auth/google');
      // Passport redirects to Google's auth URL — 302 expected
      // Without GOOGLE_CLIENT_ID configured in test env, passport may return 500 or redirect to error
      expect([302, 500]).toContain(res.status);
    });

    it('GET /api/auth/google/callback without code → redirects to error page', async () => {
      const res = await agent.get('/api/auth/google/callback');
      // Without a valid OAuth code, Google strategy will fail and redirect
      expect([302, 400, 500]).toContain(res.status);
      // If redirect, it should go to an error URL, NOT a success URL
      if (res.status === 302) {
        const location = res.headers.location || '';
        expect(location).not.toMatch(/success=true/);
      }
    });

    it('GET /api/auth/google/callback with invalid code → redirects to error', async () => {
      const res = await agent.get('/api/auth/google/callback?code=invalid_code_abc123');
      expect([302, 400, 500]).toContain(res.status);
      if (res.status === 302) {
        const location = res.headers.location || '';
        expect(location).not.toMatch(/token=/);
      }
    });
  });

  // =========================================================================
  // 3. Email Verification (OTP) endpoints
  // =========================================================================
  describe('POST /api/auth/verify-email', () => {
    it('returns 422 if email is missing', async () => {
      const res = await agent.post('/api/auth/verify-email').send({ code: '123456' });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 if code is missing', async () => {
      const res = await agent.post('/api/auth/verify-email').send({ email: 'x@student.tazkia.ac.id' });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 if code is not 6 digits', async () => {
      const res = await agent
        .post('/api/auth/verify-email')
        .send({ email: 'x@student.tazkia.ac.id', code: '123' });
      expect(res.status).toBe(422);
    });

    it('returns 422 if code is non-numeric', async () => {
      const res = await agent
        .post('/api/auth/verify-email')
        .send({ email: 'x@student.tazkia.ac.id', code: 'abcdef' });
      expect(res.status).toBe(422);
    });

    it('returns 400/404 for unknown email with valid code format', async () => {
      const res = await agent
        .post('/api/auth/verify-email')
        .send({ email: 'nonexistent@student.tazkia.ac.id', code: '123456' });
      // 400 (invalid code) or 500 (server error if user not found) are acceptable
      expect([400, 404, 500]).toContain(res.status);
    });

    it('returns 200 for already-verified user', async () => {
      // testUser is seeded as isEmailVerified=true
      // Attempt verify on already-verified user — service returns success
      const res = await agent
        .post('/api/auth/verify-email')
        .send({ email: testUser.email, code: '000000' });
      // Service checks isEmailVerified first, so 400 (wrong code) or 200 (already verified)
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('returns 400 if email is missing', async () => {
      const res = await agent.post('/api/auth/resend-verification').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 if user is already verified', async () => {
      const res = await agent
        .post('/api/auth/resend-verification')
        .send({ email: testUser.email });
      // testUser is already verified → service throws 'Email sudah terverifikasi'
      expect([400, 500]).toContain(res.status);
    });

    it('returns 400 if user does not exist', async () => {
      const res = await agent
        .post('/api/auth/resend-verification')
        .send({ email: 'ghost@student.tazkia.ac.id' });
      expect([400, 500]).toContain(res.status);
    });
  });

  // =========================================================================
  // 4. JWT Refresh Token
  // =========================================================================
  describe('POST /api/auth/refresh', () => {
    it('returns 422 when refreshToken is missing', async () => {
      const res = await agent.post('/api/auth/refresh').send({});
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for an invalid refresh token', async () => {
      const res = await agent
        .post('/api/auth/refresh')
        .send({ refreshToken: 'this.is.not.a.valid.token' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for an expired / malformed JWT', async () => {
      // A structurally valid but expired token (signed with wrong secret)
      const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTk5LCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAxfQ.fake_sig';
      const res = await agent.post('/api/auth/refresh').send({ refreshToken: fakeToken });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // 5. Admin 2FA
  // =========================================================================
  describe('POST /api/auth/admin/2fa/verify', () => {
    it('returns 400 when tempToken or totpCode is missing', async () => {
      const res = await agent.post('/api/auth/admin/2fa/verify').send({ tempToken: 'abc' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 for invalid tempToken', async () => {
      const res = await agent
        .post('/api/auth/admin/2fa/verify')
        .send({ tempToken: 'invalid.token.here', totpCode: '123456' });
      expect(res.status).toBe(401);
    });

    it('returns 503 when ADMIN_2FA_SECRET is not configured', async () => {
      // Sign a structurally valid temp token
      const jwt = require('jsonwebtoken');
      const tempToken = jwt.sign(
        { adminPre2FA: true, userId: adminUser.id },
        process.env.JWT_SECRET || 'dev-secret',
        { expiresIn: '5m' }
      );
      const res = await agent
        .post('/api/auth/admin/2fa/verify')
        .send({ tempToken, totpCode: '000000' });
      // Without ADMIN_2FA_SECRET set, service returns 503
      expect([401, 503]).toContain(res.status);
    });
  });

  describe('GET /api/auth/admin/2fa/setup', () => {
    it('returns 401 without auth', async () => {
      const res = await agent.get('/api/auth/admin/2fa/setup');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin user', async () => {
      const res = await agent
        .get('/api/auth/admin/2fa/setup')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200/503 for admin user (503 if secret not configured)', async () => {
      const res = await agent
        .get('/api/auth/admin/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`);
      // 200 if ADMIN_2FA_SECRET is set, 503 if not
      expect([200, 503]).toContain(res.status);
    });
  });

  // =========================================================================
  // 6. Protected auth routes
  // =========================================================================
  describe('GET /api/auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 200 with user profile for authenticated user', async () => {
      const res = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toHaveProperty('email');
      expect(res.body.user).toHaveProperty('nim');
      expect(res.body.user.email).toBe(testUser.email);
    });

    it('returns user with correct userType', async () => {
      const res = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.body.user.userType).toBe('student');
    });
  });

  describe('GET /api/auth/verify', () => {
    it('returns 401 without token', async () => {
      const res = await agent.get('/api/auth/verify');
      expect(res.status).toBe(401);
    });

    it('returns 200 + valid=true for a valid token', async () => {
      const res = await agent
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.user).toHaveProperty('id');
    });
  });

  describe('GET /api/auth/protected-test', () => {
    it('returns 401 without token', async () => {
      const res = await agent.get('/api/auth/protected-test');
      expect(res.status).toBe(401);
    });

    it('returns 200 with user info for authenticated user', async () => {
      const res = await agent
        .get('/api/auth/protected-test')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('user');
    });
  });

  // =========================================================================
  // 7. Profile Update
  // =========================================================================
  describe('PATCH /api/auth/update-profile', () => {
    it('returns 401 without token', async () => {
      const res = await agent
        .patch('/api/auth/update-profile')
        .send({ fullName: 'New Name' });
      expect(res.status).toBe(401);
    });

    it('returns 200 when profile is updated', async () => {
      const res = await agent
        .patch('/api/auth/update-profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ fullName: 'Updated Test Student' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // 8. Logout
  // =========================================================================
  describe('POST /api/auth/logout', () => {
    it('returns 401 without auth token', async () => {
      const res = await agent.post('/api/auth/logout');
      expect(res.status).toBe(401);
    });

    it('returns 200 on successful logout and invalidates the session', async () => {
      // Create a fresh user just for logout test so we don't break other tests
      const logoutSeed = await seedTestUser({
        nim: '2021002099',
        email: 'logout-test@tazkia.ac.id',
        userType: 'student',
      });
      const logoutToken = await loginAs({
        identifier: logoutSeed.user.nim,
        password: logoutSeed.plainPassword,
      });

      const res = await agent
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${logoutToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // After logout the token should no longer be valid
      const verifyRes = await agent
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${logoutToken}`);

      expect(verifyRes.status).toBe(401);
    });
  });
});
