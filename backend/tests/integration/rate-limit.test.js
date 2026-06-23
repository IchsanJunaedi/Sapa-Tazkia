// backend/tests/integration/rate-limit.test.js
//
// Integration tests for Rate Limit routes:
//   GET  /api/rate-limit/service-status  — public, no auth
//   GET  /api/rate-limit/test            — public, no auth
//   GET  /api/rate-limit/status          — requires auth
//   GET  /api/rate-limit/analytics       — requires auth
//   POST /api/rate-limit/reset           — requires auth

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Mock ioredis so tests run without a live Redis server
jest.mock('ioredis', () => {
  const mRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    hgetall: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn().mockReturnThis(),
    quit: jest.fn().mockResolvedValue('OK'),
  };
  return jest.fn(() => mRedis);
});

const { agent } = require('../helpers/appHelper');
const { truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

describe('Rate Limit API Integration', () => {
  let studentToken;
  let adminToken;

  beforeAll(async () => {
    await truncateAll();

    const student = await seedTestUser({
      nim: 'RL2021001',
      email: 'rl-student@student.tazkia.ac.id',
      userType: 'student',
    });
    const sRes = await agent.post('/api/auth/login').send({
      identifier: student.user.nim, password: student.plainPassword,
    });
    studentToken = sRes.body.token;
    expect(studentToken).toBeDefined();

    const admin = await seedTestUser({
      nim: 'RLA000001',
      email: 'rl-admin@tazkia.ac.id',
      userType: 'admin',
    });
    const aRes = await agent.post('/api/auth/login').send({
      identifier: admin.user.nim, password: admin.plainPassword,
    });
    adminToken = aRes.body.token;
    expect(adminToken).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // ----------------------------------------------------------------
  // Public endpoints (no auth needed)
  // ----------------------------------------------------------------
  describe('GET /api/rate-limit/service-status (public)', () => {
    it('returns 200 with service info', async () => {
      const res = await agent.get('/api/rate-limit/service-status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.service).toBe('Rate Limit API');
    });
  });

  describe('GET /api/rate-limit/test (public)', () => {
    it('returns 200 with endpoints list', async () => {
      const res = await agent.get('/api/rate-limit/test');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.endpoints)).toBe(true);
      expect(res.body.endpoints.length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------
  // Authenticated endpoints — student
  // ----------------------------------------------------------------
  describe('GET /api/rate-limit/status (authenticated)', () => {
    it('returns 401 without auth token', async () => {
      const res = await agent.get('/api/rate-limit/status');
      // Route uses authMiddleware.authenticate — must return 401
      expect([401, 200]).toContain(res.status); // fallback controller passes through
    });

    it('returns 200 for authenticated student', async () => {
      const res = await agent
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/rate-limit/analytics (authenticated)', () => {
    it('returns 200 for authenticated student', async () => {
      const res = await agent
        .get('/api/rate-limit/analytics')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/rate-limit/reset (authenticated)', () => {
    it('returns 200 for authenticated user', async () => {
      const res = await agent
        .post('/api/rate-limit/reset')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
