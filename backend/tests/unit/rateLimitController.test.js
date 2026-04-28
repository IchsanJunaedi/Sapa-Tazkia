// backend/tests/unit/rateLimitController.test.js

jest.mock('../../src/services/rateLimitService', () => ({
  getQuotaStatus: jest.fn(),
  isRedisAvailable: true,
}));

const rateLimitService = require('../../src/services/rateLimitService');
const ctrl = require('../../src/controllers/rateLimitController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('getRateLimitStatus', () => {
  it('uses user.id when authenticated', async () => {
    rateLimitService.getQuotaStatus.mockResolvedValueOnce({
      remaining: 100, limit: 200, resetTime: 12345,
    });
    const res = buildRes();
    await ctrl.getRateLimitStatus({ user: { id: 7 }, headers: {}, connection: {}, ip: '127.0.0.1' }, res);
    expect(rateLimitService.getQuotaStatus).toHaveBeenCalledWith(7, 'user');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('falls back to IP for guest (strip ::ffff: prefix)', async () => {
    rateLimitService.getQuotaStatus.mockResolvedValueOnce({
      remaining: 50, limit: 100, resetTime: 1,
    });
    const res = buildRes();
    await ctrl.getRateLimitStatus(
      {
        headers: { 'x-forwarded-for': '::ffff:1.2.3.4' },
        connection: {},
        ip: '1.2.3.4',
      },
      res,
    );
    expect(rateLimitService.getQuotaStatus).toHaveBeenCalledWith('1.2.3.4', 'guest');
  });

  it('returns fallback data on service error (user fallback 15000)', async () => {
    rateLimitService.getQuotaStatus.mockRejectedValueOnce(new Error('redis down'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = buildRes();
    await ctrl.getRateLimitStatus({ user: { id: 1 }, headers: {}, connection: {}, ip: '127.0.0.1' }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        data: expect.objectContaining({
          user_type: 'user',
          window_limits: expect.objectContaining({ limit: 15000 }),
        }),
      }),
    );
    errSpy.mockRestore();
  });

  it('returns fallback data on service error (guest fallback 7000)', async () => {
    rateLimitService.getQuotaStatus.mockRejectedValueOnce(new Error('redis down'));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = buildRes();
    await ctrl.getRateLimitStatus({ headers: {}, connection: {}, ip: '127.0.0.1' }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user_type: 'guest',
          window_limits: expect.objectContaining({ limit: 7000 }),
        }),
      }),
    );
    errSpy.mockRestore();
  });
});

describe('getServiceStatus', () => {
  it('returns redis_connected status', async () => {
    const res = buildRes();
    await ctrl.getServiceStatus({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ redis_connected: true }),
      }),
    );
  });
});
