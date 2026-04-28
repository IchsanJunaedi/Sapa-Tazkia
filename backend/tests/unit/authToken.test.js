// backend/tests/unit/authToken.test.js
// Unit tests for JWT generation / verification functions in authService.
// These are pure functions (no DB, no Redis, no network) → safe for any CI env.

const jwt = require('jsonwebtoken');

// Ensure secrets are set BEFORE requiring authService, since it may read env.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-32-chars-long';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'unit-test-refresh-secret-32-chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const {
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
} = require('../../src/services/authService');

describe('authService — JWT token helpers', () => {
  const userId = 42;

  describe('generateToken()', () => {
    it('returns a verifiable JWT containing the user id and type=access', () => {
      const token = generateToken(userId);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      expect(payload.id).toBe(userId);
      expect(payload.type).toBe('access');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('throws when JWT_SECRET is not configured', () => {
      const previous = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      try {
        expect(() => generateToken(userId)).toThrow(/JWT_SECRET is not configured/);
      } finally {
        process.env.JWT_SECRET = previous;
      }
    });
  });

  describe('generateRefreshToken()', () => {
    it('returns a verifiable JWT signed with the refresh secret', () => {
      const token = generateRefreshToken(userId);
      const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      expect(payload.id).toBe(userId);
      expect(payload.type).toBe('refresh');
    });

    it('falls back to JWT_SECRET when JWT_REFRESH_SECRET is missing', () => {
      const previousRefresh = process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_REFRESH_SECRET;
      try {
        const token = generateRefreshToken(userId);
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        expect(payload.id).toBe(userId);
        expect(payload.type).toBe('refresh');
      } finally {
        process.env.JWT_REFRESH_SECRET = previousRefresh;
      }
    });
  });

  describe('verifyToken()', () => {
    it('returns the decoded payload for a valid access token', () => {
      const token = generateToken(userId);
      const payload = verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload.id).toBe(userId);
      expect(payload.type).toBe('access');
    });

    it('returns null for a token signed with the wrong secret', () => {
      const badToken = jwt.sign({ id: userId, type: 'access' }, 'wrong-secret');
      expect(verifyToken(badToken)).toBeNull();
    });

    it('returns null for an expired token', () => {
      const expired = jwt.sign(
        { id: userId, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: -10 }
      );
      expect(verifyToken(expired)).toBeNull();
    });

    it('returns null for malformed tokens', () => {
      expect(verifyToken('not.a.jwt')).toBeNull();
      expect(verifyToken('')).toBeNull();
    });
  });

  describe('verifyRefreshToken()', () => {
    it('returns the decoded payload for a valid refresh token', () => {
      const token = generateRefreshToken(userId);
      const payload = verifyRefreshToken(token);
      expect(payload).not.toBeNull();
      expect(payload.id).toBe(userId);
      expect(payload.type).toBe('refresh');
    });

    it('returns null for an invalid refresh token', () => {
      expect(verifyRefreshToken('garbage')).toBeNull();
    });
  });
});
