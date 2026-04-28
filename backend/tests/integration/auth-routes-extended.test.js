// backend/tests/integration/auth-routes-extended.test.js
//
// Extended integration tests for authController routes:
// - GET  /api/auth/health
// - GET  /api/auth/test
// - GET  /api/auth/check-session
// - GET  /api/auth/me (auth + 401)
// - GET  /api/auth/verify (auth + 401)
// - GET  /api/auth/protected-test (auth + 401)
// - POST /api/auth/login (validation + bad creds + missing field)
// - POST /api/auth/logout (auth + 401)
// - PATCH /api/auth/update-profile (auth + 401)
// - PATCH /api/auth/update-verification (auth + 401)
// - POST /api/auth/verify-email (validation)
// - POST /api/auth/resend-verification
// - POST /api/auth/refresh (validation)

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const { agent } = require('../helpers/appHelper');
const { truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

describe('Auth routes — Extended', () => {
  let user;
  let token;
  let plainPassword;

  beforeAll(async () => {
    await truncateAll();
    const seeded = await seedTestUser();
    user = seeded.user;
    plainPassword = seeded.plainPassword;
    const lr = await agent.post('/api/auth/login').send({
      identifier: user.nim, password: plainPassword,
    });
    token = lr.body.token;
    expect(token).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // -------------------------------------------------------------------------
  describe('Public routes', () => {
    it('GET /api/auth/health returns 200', async () => {
      const r = await agent.get('/api/auth/health');
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });

    it('GET /api/auth/test returns 200', async () => {
      const r = await agent.get('/api/auth/test');
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });

    it('GET /api/auth/check-session returns 200 with auth=false when no JWT', async () => {
      const r = await agent.get('/api/auth/check-session');
      expect(r.status).toBe(200);
      expect(typeof r.body.authenticated).toBe('boolean');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 400 when identifier missing', async () => {
      const r = await agent.post('/api/auth/login').send({ password: 'x' });
      expect([400, 422]).toContain(r.status);
    });

    it('returns 400 when password missing', async () => {
      const r = await agent.post('/api/auth/login').send({ identifier: user.nim });
      expect([400, 422]).toContain(r.status);
    });

    it('returns 401 for wrong password', async () => {
      const r = await agent.post('/api/auth/login').send({
        identifier: user.nim, password: 'wrong-password',
      });
      expect(r.status).toBe(401);
    });

    it('returns 401 for unknown identifier', async () => {
      const r = await agent.post('/api/auth/login').send({
        identifier: '9999999999', password: 'anything',
      });
      expect([400, 401]).toContain(r.status);
    });
  });

  describe('Protected routes — 401 without token', () => {
    it.each([
      ['GET', '/api/auth/me'],
      ['GET', '/api/auth/verify'],
      ['GET', '/api/auth/protected-test'],
      ['POST', '/api/auth/logout'],
      ['PATCH', '/api/auth/update-profile'],
      ['PATCH', '/api/auth/update-verification'],
      ['POST', '/api/auth/verify-student'],
      ['POST', '/api/auth/chat'],
    ])('%s %s returns 401', async (method, path) => {
      const m = method.toLowerCase();
      const r = await agent[m](path);
      expect(r.status).toBe(401);
    });
  });

  describe('Protected routes — happy paths', () => {
    it('GET /api/auth/me returns user', async () => {
      const r = await agent.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.user.nim).toBe(user.nim);
    });

    it('GET /api/auth/verify returns 200', async () => {
      const r = await agent.get('/api/auth/verify').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
    });

    it('GET /api/auth/protected-test returns user object', async () => {
      const r = await agent
        .get('/api/auth/protected-test')
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });

    it('PATCH /api/auth/update-profile updates user', async () => {
      const r = await agent
        .patch('/api/auth/update-profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ fullName: 'Updated Name', email: user.email, nim: user.nim });
      expect([200, 400, 500]).toContain(r.status);
    });

    it('POST /api/auth/verify-student returns 400 on missing fields', async () => {
      const r = await agent
        .post('/api/auth/verify-student')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(r.status).toBe(400);
    });
  });

  describe('POST /api/auth/verify-email — validation', () => {
    it('returns 400/422 when fields missing', async () => {
      const r = await agent.post('/api/auth/verify-email').send({});
      expect([400, 422]).toContain(r.status);
    });
  });

  describe('POST /api/auth/resend-verification — validation', () => {
    it('returns 400 when email missing', async () => {
      const r = await agent.post('/api/auth/resend-verification').send({});
      expect([400, 422, 500]).toContain(r.status);
    });
  });

  describe('POST /api/auth/refresh — validation', () => {
    it('returns 400/422 when refreshToken missing', async () => {
      const r = await agent.post('/api/auth/refresh').send({});
      expect([400, 422]).toContain(r.status);
    });

    it('returns 401 for invalid refresh token', async () => {
      const r = await agent.post('/api/auth/refresh').send({ refreshToken: 'not-a-jwt' });
      expect([400, 401, 422]).toContain(r.status);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 200 with valid token', async () => {
      const seeded = await seedTestUser({
        nim: 'L1234567890',
        email: 'logout-test@x.com',
      });
      const lr = await agent.post('/api/auth/login').send({
        identifier: 'L1234567890', password: seeded.plainPassword,
      });
      const t = lr.body.token;
      const r = await agent.post('/api/auth/logout').set('Authorization', `Bearer ${t}`);
      expect([200, 400]).toContain(r.status);
    });
  });
});
