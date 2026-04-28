// backend/tests/unit/rateLimitMiddleware.test.js
//
// Unit tests for rateLimitMiddleware: kill switch, whitelist paths, type detection,
// header injection, 429 emission, fail-open on errors.

jest.mock('../../src/services/rateLimitService', () => ({
  getLimits: jest.fn(),
  checkRateLimit: jest.fn(),
}));

const rateLimitService = require('../../src/services/rateLimitService');
const { rateLimitMiddleware } = require('../../src/middleware/rateLimitMiddleware');

const buildRes = () => {
  const res = { headers: {} };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.set = jest.fn((obj, val) => {
    if (typeof obj === 'string') res.headers[obj] = val;
    else Object.assign(res.headers, obj);
    return res;
  });
  return res;
};

beforeEach(() => {
  rateLimitService.getLimits.mockReset();
  rateLimitService.checkRateLimit.mockReset();
  rateLimitService.getLimits.mockReturnValue({ tokenLimitDaily: 1000 });
  delete process.env.RATE_LIMIT_ENABLED;
});

describe('rateLimitMiddleware', () => {
  it('skips check when RATE_LIMIT_ENABLED=false', async () => {
    process.env.RATE_LIMIT_ENABLED = 'false';
    const mw = rateLimitMiddleware();
    const next = jest.fn();
    await mw({ headers: {}, originalUrl: '/api/ai/chat' }, buildRes(), next);
    expect(next).toHaveBeenCalled();
    expect(rateLimitService.checkRateLimit).not.toHaveBeenCalled();
  });

  it('whitelists /api/auth paths', async () => {
    const mw = rateLimitMiddleware();
    const next = jest.fn();
    await mw({ headers: {}, originalUrl: '/api/auth/login' }, buildRes(), next);
    expect(next).toHaveBeenCalled();
    expect(rateLimitService.checkRateLimit).not.toHaveBeenCalled();
  });

  it('whitelists /health', async () => {
    const mw = rateLimitMiddleware();
    const next = jest.fn();
    await mw({ headers: {}, originalUrl: '/health' }, buildRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('detects guest when no req.user', async () => {
    rateLimitService.checkRateLimit.mockResolvedValue({ allowed: true, limit: 100, remaining: 50, resetTime: 1000 });
    const mw = rateLimitMiddleware();
    const res = buildRes();
    const next = jest.fn();
    await mw({ headers: {}, originalUrl: '/api/ai/chat', ip: '1.2.3.4' }, res, next);
    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(null, expect.any(String), 'guest');
    expect(res.headers['X-RateLimit-Policy']).toBe('guest');
    expect(next).toHaveBeenCalled();
  });

  it('detects user tier when req.user present', async () => {
    rateLimitService.checkRateLimit.mockResolvedValue({ allowed: true, limit: 1000, remaining: 999 });
    const mw = rateLimitMiddleware();
    await mw({ headers: {}, originalUrl: '/api/ai/chat', ip: '1.2.3.4', user: { id: 7 } }, buildRes(), jest.fn());
    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(7, expect.any(String), 'user');
  });

  it('detects premium when isPremium', async () => {
    rateLimitService.checkRateLimit.mockResolvedValue({ allowed: true });
    const mw = rateLimitMiddleware();
    await mw(
      { headers: {}, originalUrl: '/api/ai/chat', ip: '1.2.3.4', user: { id: 7, isPremium: true } },
      buildRes(),
      jest.fn(),
    );
    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(7, expect.any(String), 'premium');
  });

  it('honors forcedType override', async () => {
    rateLimitService.checkRateLimit.mockResolvedValue({ allowed: true });
    const mw = rateLimitMiddleware('premium');
    await mw({ headers: {}, originalUrl: '/api/ai/chat', ip: '1.2.3.4' }, buildRes(), jest.fn());
    expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(null, expect.any(String), 'premium');
  });

  it('returns 429 when not allowed', async () => {
    rateLimitService.checkRateLimit.mockResolvedValue({
      allowed: false,
      retryAfter: 30,
      limit: 100,
      remaining: 0,
      resetTime: 5000,
      message: 'Too many requests',
    });
    const mw = rateLimitMiddleware();
    const res = buildRes();
    const next = jest.fn();
    await mw({ headers: {}, originalUrl: '/api/ai/chat', ip: '1.2.3.4' }, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        data: expect.objectContaining({ retry_after: 30, limit: 100 }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('fails open when rateLimitService throws', async () => {
    rateLimitService.checkRateLimit.mockRejectedValue(new Error('redis down'));
    const mw = rateLimitMiddleware();
    const next = jest.fn();
    await mw({ headers: {}, originalUrl: '/api/ai/chat', ip: '1.2.3.4' }, buildRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
