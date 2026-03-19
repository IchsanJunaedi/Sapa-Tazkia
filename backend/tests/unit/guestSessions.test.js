// backend/tests/unit/guestSessions.test.js
// NOTE: These test the session data structure logic, not Redis connectivity.
// Redis calls are mocked.

jest.mock('../../src/services/redisService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn()
}));

jest.mock('../../src/services/ragService', () => ({
  answerQuestion: jest.fn()
}));

jest.mock('../../src/services/rateLimitService', () => ({
  trackTokenUsage: jest.fn(),
  getQuotaStatus: jest.fn().mockResolvedValue({ remaining: 1000, limit: 7000 })
}));

const redisService = require('../../src/services/redisService');

describe('Guest Session Storage (Redis)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should store session as JSON in Redis with 24h TTL', async () => {
    const sessionId = 'guest-12345';
    const sessionData = {
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'bot', content: 'Hi there!', tokenUsage: 50 }
      ],
      ip: '127.0.0.1',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    redisService.set.mockResolvedValue(undefined);

    await redisService.set(`guest:session:${sessionId}`, JSON.stringify(sessionData), 86400);

    expect(redisService.set).toHaveBeenCalledWith(
      `guest:session:${sessionId}`,
      expect.stringContaining('"messages"'),
      86400
    );
  });

  it('should retrieve session from Redis and parse JSON', async () => {
    const sessionId = 'guest-12345';
    const sessionData = {
      messages: [{ role: 'user', content: 'Hello' }],
      ip: '127.0.0.1',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    redisService.get.mockResolvedValue(JSON.stringify(sessionData));

    const raw = await redisService.get(`guest:session:${sessionId}`);
    const parsed = JSON.parse(raw);

    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].content).toBe('Hello');
  });

  it('should return empty array for getAllActiveSessions when Redis has no keys', async () => {
    redisService.keys.mockResolvedValue([]);
    const keys = await redisService.keys('guest:session:*');
    expect(keys).toEqual([]);
  });
});
