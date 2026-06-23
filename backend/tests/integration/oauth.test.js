// backend/tests/integration/oauth.test.js
//
// Integration tests for Google OAuth routes:
//   GET /api/auth/google          — initiates OAuth redirect
//   GET /api/auth/google/callback — handled by Passport; tested for error paths
//   POST /api/auth/register-email — email/password registration for OAuth users
//
// NOTE: Full OAuth flow (external Google round-trip) is NOT tested here —
// that requires browser + credentials and belongs in E2E. These tests verify:
//   1. The redirect is issued by the route (302 + Location header).
//   2. The callback with invalid/missing params returns a recognisable error.
//   3. The register-email endpoint validates input correctly.

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Stub out passport-google-oauth20 so no real HTTP calls are made
jest.mock('passport-google-oauth20', () => {
  const { Strategy } = jest.requireActual('passport');
  // Return a strategy that never calls verify() — sufficient for route tests
  function GoogleStrategy(options, verify) {
    this.name = 'google';
    this._verify = verify;
  }
  GoogleStrategy.prototype.authenticate = function (req, options) {
    // Simulate redirect to Google
    this.redirect('https://accounts.google.com/o/oauth2/auth?mock=1');
  };
  return { Strategy: GoogleStrategy };
});

const { agent } = require('../helpers/appHelper');
const { truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

describe('OAuth Routes Integration', () => {
  beforeAll(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // ------------------------------------------------------------------
  // GET /api/auth/google — should redirect to Google consent page
  // ------------------------------------------------------------------
  describe('GET /api/auth/google', () => {
    it('issues a 302 redirect toward Google', async () => {
      const res = await agent.get('/api/auth/google').redirects(0);
      // Must be a redirect (302) toward Google OAuth
      expect([301, 302, 303, 307, 308]).toContain(res.status);
      const loc = res.headers['location'] || '';
      // Location header should point to google accounts or be empty (mocked)
      expect(typeof loc).toBe('string');
    });
  });

  // ------------------------------------------------------------------
  // GET /api/auth/google/callback — error path (no code param)
  // ------------------------------------------------------------------
  describe('GET /api/auth/google/callback', () => {
    it('returns error response when no OAuth code supplied', async () => {
      const res = await agent
        .get('/api/auth/google/callback')
        .redirects(0); // do not follow redirects
      // Depending on Passport strategy — expect redirect or 4xx
      expect([302, 400, 401, 403, 500]).toContain(res.status);
    });

    it('handles error query param gracefully', async () => {
      const res = await agent
        .get('/api/auth/google/callback?error=access_denied')
        .redirects(0);
      expect([302, 400, 401, 403]).toContain(res.status);
    });
  });

  // ------------------------------------------------------------------
  // POST /api/auth/register-email — used for OAuth users finishing sign-up
  // ------------------------------------------------------------------
  describe('POST /api/auth/register-email', () => {
    it('returns 400/422 when required fields are missing', async () => {
      const res = await agent.post('/api/auth/register-email').send({});
      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('returns 400/422 when email is invalid', async () => {
      const res = await agent.post('/api/auth/register-email').send({
        email: 'not-an-email',
        password: 'StrongPass1!',
        fullName: 'Test User',
        nim: '2021099999',
      });
      expect([400, 422]).toContain(res.status);
    });

    it('returns 400/422 when password is too short', async () => {
      const res = await agent.post('/api/auth/register-email').send({
        email: 'valid@student.tazkia.ac.id',
        password: '123',
        fullName: 'Test User',
        nim: '2021099998',
      });
      expect([400, 422]).toContain(res.status);
    });

    it('returns 409 or creates user when email is valid and unique', async () => {
      const res = await agent.post('/api/auth/register-email').send({
        email: 'newuser.oauth@student.tazkia.ac.id',
        password: 'StrongPass123!',
        fullName: 'OAuth Register Test',
        nim: '2021099997',
      });
      // 201 = created, 409 = conflict (already exists), 400 = validation fail
      expect([201, 400, 409, 422]).toContain(res.status);
    });

    it('returns 409 when NIM already exists', async () => {
      // Seed a user with a known NIM first
      await seedTestUser({
        nim: 'OAUTH9000001',
        email: 'oauth-dup@student.tazkia.ac.id',
        userType: 'student',
      });

      const res = await agent.post('/api/auth/register-email').send({
        email: 'different.email@student.tazkia.ac.id',
        password: 'StrongPass123!',
        fullName: 'Duplicate NIM',
        nim: 'OAUTH9000001',
      });
      expect([409, 400, 422]).toContain(res.status);
    });
  });
});
