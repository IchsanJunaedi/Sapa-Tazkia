// backend/tests/integration/redisService.live.test.js
//
// Exercises redisService against a REAL Redis (provided by CI/Docker).
// Skips automatically if no REDIS_URL is configured or Redis is unreachable.
//
// Covers:
// - get / set / del / exists / keys
// - incr / incrBy / decr
// - expire / ttl
// - healthCheck / disconnect

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redisService;
let realClient;
let available = false;

beforeAll(async () => {
  // Probe Redis availability with a fresh client.
  realClient = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
  try {
    await realClient.connect();
    await realClient.ping();
    available = true;
  } catch (_e) {
    available = false;
  }

  // Always require fresh module to honor REDIS_URL environment.
  jest.resetModules();
  redisService = require('../../src/services/redisService');

  // Wait briefly for redisService client to connect.
  for (let i = 0; i < 10 && available && !redisService.isConnected; i += 1) {
    await new Promise(r => setTimeout(r, 100));
  }
});

afterAll(async () => {
  try { await realClient?.quit(); } catch (_e) { /* ignore */ }
  try { await redisService?.disconnect(); } catch (_e) { /* ignore */ }
});

const describeIfRedis = available ? describe : describe.skip;

describe('RedisService — live client', () => {
  // Use beforeAll-late guard so describe-level skip is decided after probing.
  beforeAll(() => {
    if (!available) {
      // eslint-disable-next-line no-console
      console.warn('[redisService.live] Redis not available, skipping live tests.');
    }
  });

  it('set + get round-trips a string', async () => {
    if (!available) return;
    await redisService.set('rs:test:str', 'hello');
    const v = await redisService.get('rs:test:str');
    expect(v).toBe('hello');
    await redisService.del('rs:test:str');
  });

  it('set serializes object as JSON string', async () => {
    if (!available) return;
    await redisService.set('rs:test:obj', { a: 1 });
    const v = await redisService.get('rs:test:obj');
    expect(typeof v).toBe('string');
    expect(JSON.parse(v)).toEqual({ a: 1 });
    await redisService.del('rs:test:obj');
  });

  it('set with expireSeconds applies TTL', async () => {
    if (!available) return;
    await redisService.set('rs:test:ttl', 'temp', 60);
    const ttl = await redisService.ttl('rs:test:ttl');
    expect(ttl).toBeGreaterThan(0);
    await redisService.del('rs:test:ttl');
  });

  it('exists returns 1 for present, 0 for absent', async () => {
    if (!available) return;
    await redisService.set('rs:test:exist', '1');
    expect(await redisService.exists('rs:test:exist')).toBe(1);
    await redisService.del('rs:test:exist');
    expect(await redisService.exists('rs:test:exist')).toBe(0);
  });

  it('incr / incrBy / decr work on numeric counter', async () => {
    if (!available) return;
    await redisService.del('rs:test:cnt');
    expect(await redisService.incr('rs:test:cnt')).toBe(1);
    expect(await redisService.incrBy('rs:test:cnt', 5)).toBe(6);
    expect(await redisService.decr('rs:test:cnt')).toBe(5);
    await redisService.del('rs:test:cnt');
  });

  it('keys returns list matching pattern', async () => {
    if (!available) return;
    await redisService.set('rs:test:pat:1', 'a');
    await redisService.set('rs:test:pat:2', 'b');
    const k = await redisService.keys('rs:test:pat:*');
    expect(k.length).toBeGreaterThanOrEqual(2);
    await redisService.del('rs:test:pat:1');
    await redisService.del('rs:test:pat:2');
  });

  it('expire then ttl reflects remaining seconds', async () => {
    if (!available) return;
    await redisService.set('rs:test:exp', 'x');
    expect(await redisService.expire('rs:test:exp', 30)).toBe(1);
    const ttl = await redisService.ttl('rs:test:exp');
    expect(ttl).toBeGreaterThan(0);
    await redisService.del('rs:test:exp');
  });

  it('incrBy with NaN amount returns 0 without throwing', async () => {
    if (!available) return;
    const r = await redisService.incrBy('rs:test:nan', 'not-a-number');
    expect(r).toBe(0);
  });

  it('healthCheck returns true when client is live', async () => {
    if (!available) return;
    expect(await redisService.healthCheck()).toBe(true);
  });
});
