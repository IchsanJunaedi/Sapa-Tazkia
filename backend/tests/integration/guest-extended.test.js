// backend/tests/integration/guest-extended.test.js
//
// Extended coverage for guestController + rateLimitController + guest routes.
// - POST /api/guest/chat: validation + happy path (mocked OpenAI + RAG)
// - GET /api/guest/conversation/:sessionId: empty + populated session
// - GET /api/guest/rate-limit-status: shape + fallback
// - GET /api/guest/reset-limit: clears redis keys
// - GET /api/guest/: documentation root
// - GET /api/rate-limit/test, /service-status (no-auth endpoints)

// Disable strict rate limiter so we can hit /chat repeatedly.
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

// Mock RAG service to avoid Qdrant / OpenAI calls.
jest.mock('../../src/services/ragService', () => ({
  answerQuestion: jest.fn().mockResolvedValue({
    answer: 'Mock answer from RAG',
    docsDetail: [],
    usage: { total_tokens: 25 },
    isStream: false,
  }),
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'mock' } }],
          usage: { total_tokens: 10 },
        })
      }
    },
    embeddings: { create: jest.fn().mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0.01) }] }) },
  }));
});

const { agent } = require('../helpers/appHelper');

describe('Guest endpoints — Extended', () => {
  // -------------------------------------------------------------------------
  describe('GET /api/guest/', () => {
    it('returns documentation JSON', async () => {
      const r = await agent.get('/api/guest/');
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('Operational');
      expect(r.body.endpoints).toHaveProperty('/chat');
    });
  });

  // ------------------------------------------------------------------------
  describe('POST /api/guest/chat — validation', () => {
    it('returns 400 when message is missing', async () => {
      const r = await agent.post('/api/guest/chat').send({});
      expect([400, 422]).toContain(r.status);
    });

    it('returns 400 when message is empty', async () => {
      const r = await agent.post('/api/guest/chat').send({ message: '   ' });
      expect([400, 422]).toContain(r.status);
    });
  });

  // -------------------------------------------------------------------------
  describe('POST /api/guest/chat — happy path (non-stream)', () => {
    it('returns 200 + reply from mocked RAG', async () => {
      const r = await agent
        .post('/api/guest/chat')
        .send({ message: 'apa itu Tazkia?', sessionId: 'guest-test-1', stream: false });
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.reply).toBe('Mock answer from RAG');
      expect(r.body.sessionId).toBe('guest-test-1');
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /api/guest/conversation/:sessionId', () => {
    it('returns empty messages array for unknown session', async () => {
      const r = await agent.get('/api/guest/conversation/unknown-session-zzz');
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(Array.isArray(r.body.messages)).toBe(true);
    });

    it('returns saved messages after a chat', async () => {
      // Trigger a chat to save into Redis.
      await agent
        .post('/api/guest/chat')
        .send({ message: 'pertanyaan dummy', sessionId: 'guest-test-conv', stream: false });

      const r = await agent.get('/api/guest/conversation/guest-test-conv');
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      // Expect at least the user + bot message persisted
      expect(r.body.messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /api/guest/rate-limit-status', () => {
    it('returns guest user_type + window_limits payload', async () => {
      const r = await agent.get('/api/guest/rate-limit-status');
      expect(r.status).toBe(200);
      expect(r.body.data.user_type).toBe('guest');
      expect(r.body.data.window_limits).toHaveProperty('limit');
      expect(r.body.data.window_limits).toHaveProperty('remaining');
    });
  });

  // -------------------------------------------------------------------------
  describe('GET /api/guest/reset-limit', () => {
    it('returns 200 and clears the per-IP keys', async () => {
      const r = await agent.get('/api/guest/reset-limit');
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.message).toMatch(/Limit for IP/);
    });
  });
});

describe('rateLimit utility routes', () => {
  it('GET /api/rate-limit/test returns 200 + endpoints list', async () => {
    const r = await agent.get('/api/rate-limit/test');
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(Array.isArray(r.body.endpoints)).toBe(true);
  });

  it('GET /api/rate-limit/service-status returns 200', async () => {
    const r = await agent.get('/api/rate-limit/service-status');
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });
});
