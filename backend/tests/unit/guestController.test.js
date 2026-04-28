// backend/tests/unit/guestController.test.js
//
// Unit tests for guestController — fully mocks redis + ragService + rateLimitService.

jest.mock('../../src/services/redisService', () => ({
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  keys: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/services/ragService', () => ({
  answerQuestion: jest.fn(),
}));

jest.mock('../../src/services/rateLimitService', () => ({
  getQuotaStatus: jest.fn(),
  trackTokenUsage: jest.fn().mockResolvedValue(true),
}));

const redisService = require('../../src/services/redisService');
const ragService = require('../../src/services/ragService');
const ctrl = require('../../src/controllers/guestController');

const buildReq = (body, params = {}) => ({
  body,
  params,
  ip: '1.1.1.1',
  on: jest.fn(),
});

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.setHeader = jest.fn();
  res.write = jest.fn();
  res.end = jest.fn();
  res.headersSent = false;
  res.writableEnded = false;
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('guestChat', () => {
  it('returns 400 when message is empty', async () => {
    const res = buildRes();
    await ctrl.guestChat(buildReq({ message: '', sessionId: 'abc' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('non-streaming: returns reply on success', async () => {
    redisService.get.mockResolvedValueOnce(null);
    ragService.answerQuestion.mockResolvedValueOnce({
      isStream: false,
      answer: 'hello',
      usage: { total_tokens: 50 },
    });
    const res = buildRes();
    await ctrl.guestChat(buildReq({ message: 'hi', stream: false }), res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, reply: 'hello' }),
    );
  });

  it('non-streaming: uses existing session history', async () => {
    redisService.get.mockResolvedValueOnce(JSON.stringify({
      messages: [{ role: 'user', content: 'old' }, { role: 'bot', content: 'reply' }],
      ip: '1.1.1.1',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }));
    ragService.answerQuestion.mockResolvedValueOnce({
      isStream: false, answer: 'h', usage: null,
    });
    const res = buildRes();
    await ctrl.guestChat(buildReq({ message: 'hi', sessionId: 'abc', stream: false }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on rag error', async () => {
    redisService.get.mockResolvedValueOnce(null);
    ragService.answerQuestion.mockRejectedValueOnce(new Error('rag down'));
    const res = buildRes();
    await ctrl.guestChat(buildReq({ message: 'hi', stream: false }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getGuestConversation', () => {
  it('returns empty messages when session not found', async () => {
    redisService.get.mockResolvedValueOnce(null);
    const res = buildRes();
    await ctrl.getGuestConversation({ params: { sessionId: 'x' } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, messages: [] }),
    );
  });

  it('returns messages on success', async () => {
    redisService.get.mockResolvedValueOnce(JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }));
    const res = buildRes();
    await ctrl.getGuestConversation({ params: { sessionId: 'x' } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ messages: expect.any(Array) }),
    );
  });

  it('returns 500 on error', async () => {
    redisService.get.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.getGuestConversation({ params: { sessionId: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getGuestSessionInfo', () => {
  it('returns 404 when session not found', async () => {
    redisService.get.mockResolvedValueOnce(null);
    const res = buildRes();
    await ctrl.getGuestSessionInfo({ params: { sessionId: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns info when found', async () => {
    redisService.get.mockResolvedValueOnce(JSON.stringify({
      messages: [],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    }));
    const res = buildRes();
    await ctrl.getGuestSessionInfo({ params: { sessionId: 'x' } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Object) }),
    );
  });

  it('returns 500 on error', async () => {
    redisService.get.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.getGuestSessionInfo({ params: { sessionId: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('clearGuestSession', () => {
  it('clears successfully', async () => {
    const res = buildRes();
    await ctrl.clearGuestSession({ params: { sessionId: 'x' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on error', async () => {
    redisService.del.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.clearGuestSession({ params: { sessionId: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getAllActiveSessions', () => {
  it('returns array of sessions', async () => {
    redisService.keys.mockResolvedValueOnce(['guest:session:a', 'guest:session:b']);
    redisService.get
      .mockResolvedValueOnce(JSON.stringify({ messages: [] }))
      .mockResolvedValueOnce(JSON.stringify({ messages: [] }));
    const out = await ctrl.getAllActiveSessions();
    expect(out).toHaveLength(2);
  });

  it('skips corrupted sessions', async () => {
    redisService.keys.mockResolvedValueOnce(['guest:session:bad']);
    redisService.get.mockResolvedValueOnce('not-json');
    const out = await ctrl.getAllActiveSessions();
    expect(out).toEqual([]);
  });

  it('returns empty array on redis error', async () => {
    redisService.keys.mockRejectedValueOnce(new Error('boom'));
    const out = await ctrl.getAllActiveSessions();
    expect(out).toEqual([]);
  });
});
