// backend/tests/unit/authMiddleware.test.js
//
// Unit tests for authMiddleware: requireAuth, guestFriendlyAuth, optionalAuth, requireAdmin.
// Stubs authService.verifyToken + verifySession via jest.mock — no DB needed.

jest.mock('../../src/services/authService', () => ({
  verifyToken: jest.fn(),
  verifySession: jest.fn(),
}));

const authService = require('../../src/services/authService');
const middleware = require('../../src/middleware/authMiddleware');

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => {
  authService.verifyToken.mockReset();
  authService.verifySession.mockReset();
});

describe('requireAuth', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = { headers: {} };
    const res = buildRes();
    const next = jest.fn();
    await middleware.requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 with malformed Bearer scheme', async () => {
    const req = { headers: { authorization: 'Basic something' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for placeholder tokens', async () => {
    for (const t of ['null', 'undefined', '']) {
      const req = { headers: { authorization: `Bearer ${t}` } };
      const res = buildRes();
      const next = jest.fn();
      await middleware.requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('attaches user + calls next on valid token', async () => {
    authService.verifyToken.mockReturnValue({ id: 1 });
    authService.verifySession.mockResolvedValue({ valid: true, user: { id: 1, email: 'a@b.com' } });

    const req = { headers: { authorization: 'Bearer goodtoken' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.requireAuth(req, res, next);
    expect(req.user).toEqual({ id: 1, email: 'a@b.com' });
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when verifyToken returns null', async () => {
    authService.verifyToken.mockReturnValue(null);
    const req = { headers: { authorization: 'Bearer abc' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when session not valid', async () => {
    authService.verifyToken.mockReturnValue({ id: 1 });
    authService.verifySession.mockResolvedValue({ valid: false, message: 'expired' });
    const req = { headers: { authorization: 'Bearer abc' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 with friendly message on TokenExpiredError', async () => {
    const err = new Error('jwt expired');
    err.name = 'TokenExpiredError';
    authService.verifyToken.mockImplementation(() => { throw err; });
    const req = { headers: { authorization: 'Bearer expiredtoken' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.requireAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Token Expired') }));
  });

  it('returns 401 on JsonWebTokenError', async () => {
    const err = new Error('invalid');
    err.name = 'JsonWebTokenError';
    authService.verifyToken.mockImplementation(() => { throw err; });
    const req = { headers: { authorization: 'Bearer bad' } };
    const res = buildRes();
    await middleware.requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 500 on unexpected error', async () => {
    authService.verifyToken.mockImplementation(() => { throw new Error('weird'); });
    const req = { headers: { authorization: 'Bearer abc' } };
    const res = buildRes();
    await middleware.requireAuth(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('guestFriendlyAuth', () => {
  it('passes as guest when no header', async () => {
    const req = { headers: {} };
    const res = buildRes();
    const next = jest.fn();
    await middleware.guestFriendlyAuth(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('passes as guest when token format wrong', async () => {
    const req = { headers: { authorization: 'Token x' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.guestFriendlyAuth(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('passes as guest for placeholder tokens', async () => {
    const req = { headers: { authorization: 'Bearer null' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.guestFriendlyAuth(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('attaches user when token + session valid', async () => {
    authService.verifyToken.mockReturnValue({ id: 1 });
    authService.verifySession.mockResolvedValue({ valid: true, user: { id: 1, email: 'a@b.com' } });
    const req = { headers: { authorization: 'Bearer abcdef1234567890' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.guestFriendlyAuth(req, res, next);
    expect(req.user.email).toBe('a@b.com');
    expect(next).toHaveBeenCalled();
  });

  it('passes as guest when session invalid', async () => {
    authService.verifyToken.mockReturnValue({ id: 1 });
    authService.verifySession.mockResolvedValue({ valid: false });
    const req = { headers: { authorization: 'Bearer abcdef1234567890' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.guestFriendlyAuth(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  it('passes as guest when verifyToken throws (expired)', async () => {
    authService.verifyToken.mockImplementation(() => { throw new Error('jwt expired'); });
    const req = { headers: { authorization: 'Bearer abcdef1234567890' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.guestFriendlyAuth(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  it('is alias for guestFriendlyAuth', () => {
    expect(middleware.optionalAuth).toBe(middleware.guestFriendlyAuth);
  });
});

describe('requireAdmin', () => {
  it('returns 403 when user.userType is not admin', async () => {
    authService.verifyToken.mockReturnValue({ id: 1 });
    authService.verifySession.mockResolvedValue({ valid: true, user: { id: 1, userType: 'student' } });
    const req = { headers: { authorization: 'Bearer abc' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when user is admin', async () => {
    authService.verifyToken.mockReturnValue({ id: 1 });
    authService.verifySession.mockResolvedValue({ valid: true, user: { id: 1, userType: 'admin' } });
    const req = { headers: { authorization: 'Bearer abc' } };
    const res = buildRes();
    const next = jest.fn();
    await middleware.requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when no token (cascades from requireAuth)', async () => {
    const req = { headers: {} };
    const res = buildRes();
    const next = jest.fn();
    await middleware.requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
