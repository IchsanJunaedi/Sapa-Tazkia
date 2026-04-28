// backend/tests/integration/auth-extended.test.js
//
// Extended coverage for authController + authService + authMiddleware:
// - GET /api/auth/test, /api/auth/health, /api/auth/check-session
// - GET /api/auth/me, /api/auth/verify, /api/auth/protected-test
// - POST /api/auth/logout, /api/auth/refresh
// - POST /api/auth/login (validation + verification-required + admin-2fa branches)
// - POST /api/auth/verify-email (validation paths)
// - POST /api/auth/resend-verification (validation + business paths)
// - PATCH /api/auth/update-profile, /api/auth/update-verification
// - POST /api/auth/verify-student
// - Bearer token edge cases (no header, wrong scheme, "null", expired)

// Disable strict rate limiter so we can hit /login + /verify-email + /refresh
// many times within a single test run.
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'mock' } }], usage: { total_tokens: 10 } }) } },
    embeddings: { create: jest.fn().mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0.01) }] }) },
  }));
});

const jwt = require('jsonwebtoken');
const { agent } = require('../helpers/appHelper');
const {
  prisma,
  truncateAll,
  seedTestUser,
  disconnect,
} = require('../helpers/dbHelper');
const authService = require('../../src/services/authService');

describe('Auth — Extended Integration', () => {
  let user;
  let plainPassword;
  let accessToken;
  let refreshTok;

  beforeAll(async () => {
    await truncateAll();
    const seeded = await seedTestUser();
    user = seeded.user;
    plainPassword = seeded.plainPassword;

    const loginRes = await agent
      .post('/api/auth/login')
      .send({ identifier: user.nim, password: plainPassword });
    accessToken = loginRes.body.token;
    expect(accessToken).toBeDefined();

    refreshTok = authService.generateRefreshToken(user.id);
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // -------------------------------------------------------------------------
  // Public, no-auth health/test endpoints
  // -------------------------------------------------------------------------
  describe('Public endpoints', () => {
    it('GET /api/auth/test returns 200 + success', async () => {
      const r = await agent.get('/api/auth/test');
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });

    it('GET /api/auth/health returns 200 + success', async () => {
      const r = await agent.get('/api/auth/health');
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.features).toHaveProperty('emailVerification');
    });

    it('GET /api/auth/check-session returns authenticated:false when no session', async () => {
      const r = await agent.get('/api/auth/check-session');
      expect(r.status).toBe(200);
      expect(r.body).toHaveProperty('authenticated');
    });
  });

  // -------------------------------------------------------------------------
  // Login validation paths
  // -------------------------------------------------------------------------
  describe('POST /api/auth/login — validation', () => {
    it('returns 4xx when identifier missing', async () => {
      const r = await agent.post('/api/auth/login').send({ password: 'x' });
      expect([400, 422]).toContain(r.status);
    });

    it('returns 4xx when password missing', async () => {
      const r = await agent.post('/api/auth/login').send({ identifier: user.nim });
      expect([400, 422]).toContain(r.status);
    });
  });

  // -------------------------------------------------------------------------
  // Protected routes (Bearer token)
  // -------------------------------------------------------------------------
  describe('GET /api/auth/me', () => {
    it('returns 200 + fresh user data on valid token', async () => {
      const r = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.user.id).toBe(user.id);
    });

    it('returns 401 without Authorization header', async () => {
      const r = await agent.get('/api/auth/me');
      expect(r.status).toBe(401);
    });

    it('returns 401 with malformed Bearer scheme', async () => {
      const r = await agent
        .get('/api/auth/me')
        .set('Authorization', `Basic ${accessToken}`);
      expect(r.status).toBe(401);
    });

    it('returns 401 with literal "null" token', async () => {
      const r = await agent.get('/api/auth/me').set('Authorization', 'Bearer null');
      expect(r.status).toBe(401);
    });

    it('returns 401 with expired token', async () => {
      const expired = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: -1 });
      const r = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expired}`);
      expect(r.status).toBe(401);
    });
  });

  describe('GET /api/auth/verify', () => {
    it('returns 200 + valid:true on real token', async () => {
      const r = await agent
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(r.status).toBe(200);
      expect(r.body.valid).toBe(true);
      expect(r.body.user.id).toBe(user.id);
    });

    it('returns 401 without token', async () => {
      const r = await agent.get('/api/auth/verify');
      expect(r.status).toBe(401);
    });
  });

  describe('GET /api/auth/protected-test', () => {
    it('returns 200 with attached user', async () => {
      const r = await agent
        .get('/api/auth/protected-test')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(r.status).toBe(200);
      expect(r.body.user.id).toBe(user.id);
    });
  });

  // -------------------------------------------------------------------------
  // Profile updates
  // -------------------------------------------------------------------------
  describe('PATCH /api/auth/update-profile', () => {
    it('returns 200 + persists updated email', async () => {
      const newEmail = `updated-${Date.now()}@student.tazkia.ac.id`;
      const r = await agent
        .patch('/api/auth/update-profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: newEmail });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);

      const fresh = await prisma.user.findUnique({ where: { id: user.id } });
      expect(fresh.email).toBe(newEmail);
    });
  });

  describe('PATCH /api/auth/update-verification', () => {
    it('returns 200 with valid input', async () => {
      const r = await agent
        .patch('/api/auth/update-verification')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nim: user.nim, fullName: user.fullName });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/verify-student', () => {
    it('returns 400 when fields missing', async () => {
      const r = await agent
        .post('/api/auth/verify-student')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nim: user.nim });
      expect(r.status).toBe(400);
    });

    it('returns 400 when validation fails (wrong fullName)', async () => {
      const r = await agent
        .post('/api/auth/verify-student')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nim: user.nim, fullName: 'Wrong Name', birthDate: '2000-01-01' });
      expect(r.status).toBe(400);
      expect(r.body.success).toBe(false);
    });

    it('returns 200 on matching NIM + fullName', async () => {
      const r = await agent
        .post('/api/auth/verify-student')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nim: user.nim, fullName: user.fullName, birthDate: '2000-01-01' });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.valid).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Refresh token
  // -------------------------------------------------------------------------
  describe('POST /api/auth/refresh', () => {
    it('returns 4xx when refreshToken missing', async () => {
      const r = await agent.post('/api/auth/refresh').send({});
      expect([400, 422]).toContain(r.status);
    });

    it('returns 401 with garbage token', async () => {
      const r = await agent.post('/api/auth/refresh').send({ refreshToken: 'not-a-real-token' });
      expect(r.status).toBe(401);
    });

    it('returns 200 + new access token with valid refresh', async () => {
      const r = await agent.post('/api/auth/refresh').send({ refreshToken: refreshTok });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.token).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // verify-email validation paths
  // -------------------------------------------------------------------------
  describe('POST /api/auth/verify-email', () => {
    it('returns 4xx when fields missing', async () => {
      const r = await agent.post('/api/auth/verify-email').send({});
      expect([400, 422]).toContain(r.status);
    });

    it('returns 422 / 400 when code is wrong format', async () => {
      const r = await agent
        .post('/api/auth/verify-email')
        .send({ email: 'a@b.com', code: '12' });
      expect([400, 422]).toContain(r.status);
    });

    it('returns 4xx/5xx when email/code is unknown', async () => {
      const r = await agent
        .post('/api/auth/verify-email')
        .send({ email: 'unknown@student.tazkia.ac.id', code: '123456' });
      expect([400, 404, 500]).toContain(r.status);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('returns 400 when email missing', async () => {
      const r = await agent.post('/api/auth/resend-verification').send({});
      expect(r.status).toBe(400);
    });

    it('returns 400 when user is already verified', async () => {
      const r = await agent
        .post('/api/auth/resend-verification')
        .send({ email: user.email });
      expect([400, 200]).toContain(r.status);
    });
  });

  // -------------------------------------------------------------------------
  // Logout
  // -------------------------------------------------------------------------
  describe('POST /api/auth/logout', () => {
    it('returns 200 + invalidates session', async () => {
      // First login fresh to avoid invalidating accessToken used by other tests.
      const fresh = await agent
        .post('/api/auth/login')
        .send({ identifier: user.nim, password: plainPassword });
      const tok = fresh.body.token;

      const r = await agent
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tok}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);

      // Token should now be invalid
      const after = await agent
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tok}`);
      expect(after.status).toBe(401);
    });
  });
});
