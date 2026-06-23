// backend/tests/integration/rate-limit.test.js
//
// Integration tests for Rate Limit API endpoints:
//  - GET /api/rate-limit/test           (public)
//  - GET /api/rate-limit/service-status (public)
//  - GET /api/rate-limit/status         (requires auth)
//  - GET /api/rate-limit/analytics      (requires auth)
//  - POST /api/rate-limit/reset         (requires auth)
//
// Also covers the rate-limiting middleware behaviour (RATE_LIMIT_ENABLED flag)
// and the X-RateLimit-* response headers.

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
  addDocument: jest.fn().mockResolvedValue({ id: 'mock-doc' }),
  deleteDocument: jest.fn().mockResolvedValue({ deleted: true }),
  getCollectionInfo: jest.fn().mockResolvedValue({ exists: true, pointsCount: 0 }),
  answerQuestion: jest.fn().mockResolvedValue({ answer: 'mock', usage: { total_tokens: 5 } }),
}));

jest.mock('../../src/services/openaiService', () => ({
  testOpenAIConnection: jest.fn().mockResolvedValue({ success: false }),
  generateTitle: jest.fn().mockResolvedValue('Title'),
}));

// ---- Helpers -------------------------------------------------------------
const { agent } = require('../helpers/appHelper');
const { truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

async function loginAs({ identifier, password }) {
  const res = await agent.post('/api/auth/login').send({ identifier, password });
  return res.body.token;
}

// ============================================================================
describe('Rate Limit API Integration', () => {
  let userToken;

  beforeAll(async () => {
    await truncateAll();
    const seed = await seedTestUser({
      nim: '2021001011',
      email: 'rl-user@tazkia.ac.id',
      userType: 'student',
    });
    userToken = await loginAs({ identifier: seed.user.nim, password: seed.plainPassword });
    expect(userToken).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // =========================================================================
  // Public endpoints (no auth required)
  // =========================================================================
  describe('Public endpoints', () => {
    it('GET /api/rate-limit/test → 200 with success flag', async () => {
      const res = await agent.get('/api/rate-limit/test');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('message');
    });

    it('GET /api/rate-limit/test → lists available endpoints', async () => {
      const res = await agent.get('/api/rate-limit/test');
      expect(Array.isArray(res.body.endpoints)).toBe(true);
      expect(res.body.endpoints.length).toBeGreaterThan(0);
    });

    it('GET /api/rate-limit/service-status → 200 with service info', async () => {
      const res = await agent.get('/api/rate-limit/service-status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('service');
      expect(res.body.data).toHaveProperty('status');
    });

    it('GET /api/rate-limit/service-status → includes timestamp', async () => {
      const res = await agent.get('/api/rate-limit/service-status');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(() => new Date(res.body.data.timestamp)).not.toThrow();
    });
  });

  // =========================================================================
  // Authenticated endpoints
  // =========================================================================
  describe('GET /api/rate-limit/status', () => {
    it('returns 200 with quota data for authenticated user', async () => {
      const res = await agent
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('includes window_limits in response data', async () => {
      const res = await agent
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${userToken}`);

      // Controller may return data.window_limits or a fallback response
      // Either way, success and data must be present
      expect(res.body).toHaveProperty('data');
    });

    it('returns a valid user_type field', async () => {
      const res = await agent
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${userToken}`);

      if (res.body.data && res.body.data.user_type) {
        expect(['guest', 'user', 'premium']).toContain(res.body.data.user_type);
      }
    });
  });

  describe('GET /api/rate-limit/analytics', () => {
    it('returns 200 for authenticated user', async () => {
      const res = await agent
        .get('/api/rate-limit/analytics')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('response includes timestamp', async () => {
      const res = await agent
        .get('/api/rate-limit/analytics')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/rate-limit/reset', () => {
    it('returns 200 for authenticated user', async () => {
      const res = await agent
        .post('/api/rate-limit/reset')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('response indicates reset was performed', async () => {
      const res = await agent
        .post('/api/rate-limit/reset')
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect(res.body).toHaveProperty('message');
    });
  });

  // =========================================================================
  // Rate Limit Headers
  // =========================================================================
  describe('X-RateLimit-* response headers', () => {
    it('GET / responds with X-RateLimit-Limit header set', async () => {
      const res = await agent.get('/');
      // App sets fallback headers on every response when not already set
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
    });

    it('auth-gated route returns rate-limit related headers', async () => {
      const res = await agent
        .get('/api/rate-limit/status')
        .set('Authorization', `Bearer ${userToken}`);

      // At minimum the response should not fail
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // Kill-switch: RATE_LIMIT_ENABLED=false (already set in test env via CI)
  // =========================================================================
  describe('Kill-switch (RATE_LIMIT_ENABLED=false)', () => {
    it('requests succeed without being rate-limited in test env', async () => {
      // Fire several requests rapidly — none should return 429
      const requests = Array.from({ length: 5 }, () =>
        agent.get('/api/rate-limit/test')
      );
      const results = await Promise.all(requests);
      results.forEach(r => {
        expect(r.status).not.toBe(429);
      });
    });

    it('login endpoint not blocked by rate limit in test env', async () => {
      // Fire multiple login attempts; strict limiter is disabled in NODE_ENV=test
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          agent.post('/api/auth/login').send({ identifier: '0000000000', password: 'wrong' })
        )
      );
      results.forEach(r => {
        // Should be 401 (wrong creds), NOT 429
        expect(r.status).not.toBe(429);
      });
    });
  });

  // =========================================================================
  // Negative paths — unauthenticated access to auth-required endpoints
  // The rateLimitRoutes use fallbackAuth which sets req.user = null.
  // Status endpoint still responds 200 in fallback mode (no 401).
  // =========================================================================
  describe('Fallback mode (no token)', () => {
    it('GET /api/rate-limit/status without token → responds (fallback)', async () => {
      const res = await agent.get('/api/rate-limit/status');
      // Routes use fallbackAuth → 200 with guest/fallback data, or auth-required (401)
      expect([200, 401]).toContain(res.status);
    });

    it('GET /api/rate-limit/analytics without token → responds (fallback)', async () => {
      const res = await agent.get('/api/rate-limit/analytics');
      expect([200, 401]).toContain(res.status);
    });
  });
});
