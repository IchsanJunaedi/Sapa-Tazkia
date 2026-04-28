// backend/tests/unit/rateLimitService.test.js
// Unit tests for RateLimitService with redisService fully mocked.
// No real Redis connection is opened → safe for any CI env.

jest.mock('../../src/services/redisService', () => {
  const store = new Map();
  const ttls = new Map();

  return {
    __store: store,
    __ttls: ttls,
    __reset: () => { store.clear(); ttls.clear(); },
    healthCheck: jest.fn(async () => true),
    get: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    set: jest.fn(async (key, val) => { store.set(key, val); return 'OK'; }),
    incr: jest.fn(async (key) => {
      const next = (parseInt(store.get(key) || '0', 10) || 0) + 1;
      store.set(key, String(next));
      return next;
    }),
    incrBy: jest.fn(async (key, delta) => {
      const next = (parseInt(store.get(key) || '0', 10) || 0) + delta;
      store.set(key, String(next));
      return next;
    }),
    expire: jest.fn(async (key, seconds) => { ttls.set(key, seconds); return 1; }),
    ttl: jest.fn(async (key) => (ttls.has(key) ? ttls.get(key) : -1)),
  };
});

const redisServiceMock = require('../../src/services/redisService');
const rateLimitService = require('../../src/services/rateLimitService');

beforeEach(() => {
  redisServiceMock.__reset();
  rateLimitService.isRedisAvailable = true;
});

describe('rateLimitService', () => {
  describe('getLimits()', () => {
    it('returns per-type limits, falling back to guest for unknown types', () => {
      expect(rateLimitService.getLimits('user')).toEqual(
        expect.objectContaining({
          tokenLimitDaily: expect.any(Number),
          spamLimitPerMinute: expect.any(Number),
        })
      );
      expect(rateLimitService.getLimits('premium').tokenLimitDaily).toBeGreaterThan(
        rateLimitService.getLimits('user').tokenLimitDaily
      );
      expect(rateLimitService.getLimits('unknown-type')).toEqual(
        rateLimitService.getLimits('guest')
      );
    });
  });

  describe('getDailyKey()', () => {
    it('includes today\'s ISO date and the identifier', () => {
      const today = new Date().toISOString().split('T')[0];
      const key = rateLimitService.getDailyKey('abc');
      expect(key).toContain(today);
      expect(key.endsWith(':abc')).toBe(true);
    });
  });

  describe('checkRateLimit()', () => {
    it('allows the request when under the spam and token quota', async () => {
      const res = await rateLimitService.checkRateLimit(1, '1.2.3.4', 'user');
      expect(res.allowed).toBe(true);
      expect(res.limit).toBeGreaterThan(0);
      expect(res.remaining).toBeGreaterThan(0);
    });

    it('blocks when the spam window threshold is exceeded', async () => {
      const ip = '9.9.9.9';
      const limits = rateLimitService.getLimits('guest');
      for (let i = 0; i < limits.spamLimitPerMinute; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await rateLimitService.checkRateLimit(null, ip, 'guest');
      }
      const blocked = await rateLimitService.checkRateLimit(null, ip, 'guest');
      expect(blocked.allowed).toBe(false);
      expect(blocked.error).toBe('rate_limit_exceeded');
    });

    it('blocks when the daily token quota is exhausted', async () => {
      const userId = 7;
      const limits = rateLimitService.getLimits('user');
      const usageKey = rateLimitService.getDailyKey(userId);
      // Pre-fill usage right at the limit.
      redisServiceMock.__store.set(usageKey, String(limits.tokenLimitDaily));
      redisServiceMock.__ttls.set(usageKey, 60);

      const res = await rateLimitService.checkRateLimit(userId, '127.0.0.1', 'user');
      expect(res.allowed).toBe(false);
      expect(res.remaining).toBe(0);
      expect(res.limit).toBe(limits.tokenLimitDaily);
    });

    it('fails open (allowed=true) when redis is marked unavailable', async () => {
      rateLimitService.isRedisAvailable = false;
      const res = await rateLimitService.checkRateLimit(1, '1.2.3.4', 'user');
      expect(res).toEqual({ allowed: true });
    });
  });

  describe('trackTokenUsage()', () => {
    it('increments usage, sets a 12h TTL on the first write, and returns total', async () => {
      const out = await rateLimitService.trackTokenUsage(1, '1.2.3.4', 250);
      expect(out).toEqual({ totalUsage: 250, success: true });
      expect(redisServiceMock.expire).toHaveBeenCalledWith(expect.any(String), 43200);
    });

    it('does NOT reset an existing TTL on subsequent writes (fixed window)', async () => {
      await rateLimitService.trackTokenUsage(1, '1.2.3.4', 100);
      redisServiceMock.expire.mockClear();

      // Simulate a running timer.
      const key = rateLimitService.getDailyKey(1);
      redisServiceMock.__ttls.set(key, 3600);

      await rateLimitService.trackTokenUsage(1, '1.2.3.4', 50);
      expect(redisServiceMock.expire).not.toHaveBeenCalled();
    });

    it('returns {totalUsage:0,success:false} when tokenUsed is falsy', async () => {
      const out = await rateLimitService.trackTokenUsage(1, '1.2.3.4', 0);
      expect(out).toEqual({ totalUsage: 0, success: false });
    });

    it('returns {totalUsage:0,success:false} when redis is unavailable', async () => {
      rateLimitService.isRedisAvailable = false;
      const out = await rateLimitService.trackTokenUsage(1, '1.2.3.4', 100);
      expect(out).toEqual({ totalUsage: 0, success: false });
    });
  });

  describe('getQuotaStatus()', () => {
    it('returns limits with full remaining quota for a fresh identifier', async () => {
      const status = await rateLimitService.getQuotaStatus('fresh-ip', 'guest');
      expect(status.userType).toBe('guest');
      expect(status.limit).toBe(rateLimitService.getLimits('guest').tokenLimitDaily);
      expect(status.remaining).toBe(status.limit);
      expect(status.resetTime).toBeGreaterThan(Date.now());
    });

    it('reflects current usage and TTL when keys exist', async () => {
      const identifier = 'tracked-user';
      const key = rateLimitService.getDailyKey(identifier);
      redisServiceMock.__store.set(key, '500');
      redisServiceMock.__ttls.set(key, 1800);

      const status = await rateLimitService.getQuotaStatus(identifier, 'user');
      expect(status.remaining).toBe(
        rateLimitService.getLimits('user').tokenLimitDaily - 500
      );
    });

    it('returns the default response when redis is unavailable', async () => {
      rateLimitService.isRedisAvailable = false;
      const status = await rateLimitService.getQuotaStatus('anon', 'guest');
      expect(status.remaining).toBe(status.limit);
    });
  });
});
