const { describe, it, expect, beforeEach, afterAll, jest } = require('@jest/globals');
// backend/tests/unit/utils.test.js
//
// Unit tests for small utility modules:
// - utils/queryNormalizer
// - utils/errorHandlers
// - utils/rateLimitUtils
// - config/envValidation

const {
  normalizeQuery,
  wasNormalized,
  applyPhoneticPatterns,
  CORRECTION_MAP,
} = require('../../src/utils/queryNormalizer');

describe('queryNormalizer.applyPhoneticPatterns', () => {
  it('iy + vokal → i (kuliyah → kuliah)', () => {
    expect(applyPhoneticPatterns('kuliyah')).toBe('kuliah');
  });

  it('3+ chars repeating → 1 (kampusss → kampus)', () => {
    expect(applyPhoneticPatterns('kampusss')).toBe('kampus');
  });

  it('ii → i', () => {
    expect(applyPhoneticPatterns('kuliiah')).toBe('kuliah');
  });

  it('uu → u', () => {
    expect(applyPhoneticPatterns('ruumah')).toBe('rumah');
  });
});

describe('queryNormalizer.normalizeQuery', () => {
  it('returns input as-is for non-string', () => {
    expect(normalizeQuery(null)).toBeNull();
    expect(normalizeQuery(undefined)).toBeUndefined();
    expect(normalizeQuery(123)).toBe(123);
  });

  it('lowercases + trims', () => {
    expect(normalizeQuery('  HALO  ')).toBe('halo');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeQuery('apa  itu   tazkia')).toBe('apa itu tazkia');
  });

  it('uses CORRECTION_MAP for known typos', () => {
    expect(normalizeQuery('biay')).toBe('biaya');
    expect(normalizeQuery('akutansi')).toBe('akuntansi');
    expect(normalizeQuery('kampas')).toBe('kampus');
  });

  it('handles punctuation around words', () => {
    expect(normalizeQuery('kuliyah,')).toBe('kuliah,');
  });

  it('CORRECTION_MAP contains expected entries', () => {
    expect(CORRECTION_MAP['tazqia']).toBe('tazkia');
  });
});

describe('queryNormalizer.wasNormalized', () => {
  it('returns true when normalization changed input', () => {
    expect(wasNormalized('kuliyah', 'kuliah')).toBe(true);
  });

  it('returns false when content unchanged after lowercase/trim', () => {
    expect(wasNormalized('  Halo  ', 'halo')).toBe(false);
  });
});

// ---------------------------------------------------------------------------

const {
  RateLimitExceededError,
  TokenBucketExhaustedError,
  rateLimitErrorHandler,
} = require('../../src/utils/errorHandlers');

describe('errorHandlers — error classes', () => {
  it('RateLimitExceededError carries status + code + info', () => {
    const e = new RateLimitExceededError('too many', { limit: 100, retryAfter: 30 });
    expect(e.status).toBe(429);
    expect(e.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(e.rateLimitInfo.limit).toBe(100);
    expect(e.name).toBe('RateLimitExceededError');
  });

  it('TokenBucketExhaustedError carries retryAfter', () => {
    const e = new TokenBucketExhaustedError('drained', 60);
    expect(e.status).toBe(429);
    expect(e.retryAfter).toBe(60);
  });
});

describe('errorHandlers.rateLimitErrorHandler', () => {
  const buildRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  it('responds 429 for RateLimitExceededError', () => {
    const res = buildRes();
    const next = jest.fn();
    rateLimitErrorHandler(
      new RateLimitExceededError('boom', { limit: 5, retryAfter: 10 }),
      {},
      res,
      next,
    );
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED', limit: 5 }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 429 for TokenBucketExhaustedError', () => {
    const res = buildRes();
    const next = jest.fn();
    rateLimitErrorHandler(new TokenBucketExhaustedError('x', 30), {}, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through non-rate-limit errors', () => {
    const res = buildRes();
    const next = jest.fn();
    const err = new Error('something else');
    rateLimitErrorHandler(err, {}, res, next);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

const RateLimitUtils = require('../../src/utils/rateLimitUtils');

describe('rateLimitUtils', () => {
  it('estimateTokenCount: ~4 chars per token', () => {
    expect(RateLimitUtils.estimateTokenCount('1234')).toBe(1);
    expect(RateLimitUtils.estimateTokenCount('12345678')).toBe(2);
  });

  it('calculateCostEstimate: known model', () => {
    expect(RateLimitUtils.calculateCostEstimate(1000, 'gpt-4')).toBeCloseTo(0.03);
  });

  it('calculateCostEstimate: unknown model falls back to gpt-3.5-turbo', () => {
    expect(RateLimitUtils.calculateCostEstimate(1000, 'sonnet'))
      .toBeCloseTo(RateLimitUtils.calculateCostEstimate(1000, 'gpt-3.5-turbo'));
  });

  it('getRetryAfterTime returns window seconds', () => {
    expect(RateLimitUtils.getRetryAfterTime('minute')).toBe(60);
    expect(RateLimitUtils.getRetryAfterTime('hour')).toBe(3600);
    expect(RateLimitUtils.getRetryAfterTime('day')).toBe(86400);
    expect(RateLimitUtils.getRetryAfterTime('eternity')).toBe(60); // fallback
  });

  it('generateRateLimitKey assembles parts', () => {
    const k = RateLimitUtils.generateRateLimitKey('rl', 'user-1', 'minute');
    expect(k).toMatch(/^rl:user-1:minute:\d+$/);
  });

  it('isRateLimitError detects via status', () => {
    expect(RateLimitUtils.isRateLimitError({ status: 429 })).toBe(true);
  });

  it('isRateLimitError detects via code', () => {
    expect(RateLimitUtils.isRateLimitError({ code: 'RATE_LIMIT_EXCEEDED' })).toBe(true);
  });

  it('isRateLimitError detects via message', () => {
    expect(RateLimitUtils.isRateLimitError({ message: 'rate limit hit' })).toBe(true);
  });

  it('isRateLimitError returns false for unrelated', () => {
    expect(RateLimitUtils.isRateLimitError({ status: 500, message: 'oops' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('config/envValidation', () => {
  const ORIG = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIG };
  });
  afterAll(() => {
    process.env = ORIG;
  });

  it('passes in test mode when DATABASE_URL/JWT/SESSION present', () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'mysql://x';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.SESSION_SECRET = 'b'.repeat(32);
    const { validateEnv } = require('../../src/config/envValidation');
    expect(() => validateEnv()).not.toThrow();
  });

  it('throws in test mode when DATABASE_URL is missing', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.SESSION_SECRET = 'b'.repeat(32);
    const { validateEnv } = require('../../src/config/envValidation');
    expect(() => validateEnv()).toThrow(/Missing required/);
  });

  it('throws in production when REDIS_URL missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'mysql://x';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.SESSION_SECRET = 'b'.repeat(32);
    delete process.env.REDIS_URL;
    const { validateEnv } = require('../../src/config/envValidation');
    expect(() => validateEnv()).toThrow(/REDIS_URL/);
  });

  it('warns (not throws) for optional vars in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'mysql://x';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.SESSION_SECRET = 'b'.repeat(32);
    process.env.REDIS_URL = 'redis://x';
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.EMAIL_USER;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { validateEnv } = require('../../src/config/envValidation');
    expect(() => validateEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
