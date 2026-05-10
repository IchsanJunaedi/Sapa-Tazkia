
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    del: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    exists: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    incr: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    incrby: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    expire: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    ttl: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    keys: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    decr: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  }));
});

let redisService;

beforeEach(() => {
  jest.resetModules();
  jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      del: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      exists: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      incr: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      incrby: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      expire: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      ttl: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      keys: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      decr: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    }));
  });
  redisService = require('../../src/services/redisService');
  redisService.degradedMode = true; // force degraded mode for tests
});

describe('RedisService degraded mode', () => {
  it('set and get round-trip via memory store', async () => {
    await redisService.set('test:key', 'hello');
    const val = await redisService.get('test:key');
    expect(val).toBe('hello');
  });

  it('returns null for missing key', async () => {
    const val = await redisService.get('test:nonexistent');
    expect(val).toBeNull();
  });

  it('incr increments from 0', async () => {
    const v1 = await redisService.incr('test:counter');
    const v2 = await redisService.incr('test:counter');
    expect(v1).toBe(1);
    expect(v2).toBe(2);
  });

  it('del removes key from memory store', async () => {
    await redisService.set('test:delme', 'value');
    await redisService.del('test:delme');
    const val = await redisService.get('test:delme');
    expect(val).toBeNull();
  });

  it('expired key returns null after TTL', async () => {
    await redisService.set('test:expiry', 'temp', 1);
    // Manually move expiry to past
    const key = 'test:expiry';
    redisService._memoryExpiry.set(key, Date.now() - 1000);
    const val = await redisService.get(key);
    expect(val).toBeNull();
  });
});
