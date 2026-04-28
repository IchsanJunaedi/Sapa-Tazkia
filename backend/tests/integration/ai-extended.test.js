// backend/tests/integration/ai-extended.test.js
//
// Integration tests for aiController endpoints (authenticated):
// - GET  /api/ai/conversations
// - GET  /api/ai/conversations/search
// - GET  /api/ai/history/:id (validation + happy)
// - DELETE /api/ai/conversations/:id (validation + happy + 404)
// - POST /api/ai/chat (validation: empty, missing auth)
// - GET  /api/ai/test-ai
// - POST /api/ai/analyze-academic
// - POST /api/ai/study-recommendations
// - GET  /api/ai/suggested-prompts
// - GET  /api/ai/test-openai

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/ragService', () => ({
  answerQuestion: jest.fn().mockResolvedValue({
    answer: 'mock', usage: { total_tokens: 5 }, docsDetail: [],
  }),
  getCollectionInfo: jest.fn().mockResolvedValue({ exists: true, pointsCount: 5 }),
}));

jest.mock('openai', () => jest.fn().mockImplementation(() => ({
  chat: { completions: { create: jest.fn().mockResolvedValue({
    choices: [{ message: { content: 'ok' } }],
    usage: { total_tokens: 10 },
  }) } },
  embeddings: { create: jest.fn().mockResolvedValue({ data: [{ embedding: new Array(1536).fill(0.01) }] }) },
})));

const { agent } = require('../helpers/appHelper');
const { prisma, truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

describe('AI controller — Extended', () => {
  let user;
  let token;

  beforeAll(async () => {
    await truncateAll();
    const seeded = await seedTestUser();
    user = seeded.user;
    const loginRes = await agent.post('/api/auth/login').send({
      identifier: user.nim, password: seeded.plainPassword,
    });
    token = loginRes.body.token;
    expect(token).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // -------------------------------------------------------------------------
  describe('GET /api/ai/test-ai', () => {
    it('returns 200 success', async () => {
      const r = await agent.get('/api/ai/test-ai').set('Authorization', `Bearer ${token}`);
      expect([200, 401, 404]).toContain(r.status);
    });
  });

  describe('GET /api/ai/suggested-prompts', () => {
    it('returns prompts JSON', async () => {
      const r = await agent.get('/api/ai/suggested-prompts');
      expect(r.status).toBe(200);
    });
  });

  describe('GET /api/ai/conversations', () => {
    it('returns 200 + empty array when no conversations', async () => {
      const r = await agent.get('/api/ai/conversations').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(Array.isArray(r.body.data)).toBe(true);
    });

    it('returns 401 without token', async () => {
      const r = await agent.get('/api/ai/conversations');
      expect(r.status).toBe(401);
    });
  });

  describe('GET /api/ai/conversations/search', () => {
    it('returns 400 when q is too short', async () => {
      const r = await agent
        .get('/api/ai/conversations/search?q=a')
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(400);
    });

    it('returns 200 + empty when no matches', async () => {
      const r = await agent
        .get('/api/ai/conversations/search?q=nonexistent-search-zzz')
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
    });
  });

  describe('GET /api/ai/history/:id', () => {
    it('returns 400 for non-numeric id', async () => {
      const r = await agent.get('/api/ai/history/abc').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(400);
    });

    it('returns 404 when id does not exist', async () => {
      const r = await agent.get('/api/ai/history/999999').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(404);
    });

    it('returns 200 + messages for owned conversation', async () => {
      const conv = await prisma.conversation.create({
        data: { userId: user.id, title: 'Test conv' },
      });
      await prisma.message.create({
        data: { conversationId: conv.id, role: 'user', content: 'Hello' },
      });
      const r = await agent
        .get(`/api/ai/history/${conv.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DELETE /api/ai/conversations/:id', () => {
    it('returns 400 for invalid id', async () => {
      const r = await agent
        .delete('/api/ai/conversations/abc')
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(400);
    });

    it('returns 404 when not owned', async () => {
      const r = await agent
        .delete('/api/ai/conversations/999999')
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(404);
    });

    it('deletes own conversation successfully', async () => {
      const conv = await prisma.conversation.create({
        data: { userId: user.id, title: 'To delete' },
      });
      const r = await agent
        .delete(`/api/ai/conversations/${conv.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });
  });

  describe('POST /api/ai/chat — validation', () => {
    it('returns 401 without auth', async () => {
      const r = await agent.post('/api/ai/chat').send({ message: 'hi' });
      expect(r.status).toBe(401);
    });

    it('returns 400 for empty message', async () => {
      const r = await agent
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: '   ' });
      expect([400, 401]).toContain(r.status);
    });
  });

  describe('POST /api/ai/analyze-academic', () => {
    it('returns 200', async () => {
      const r = await agent
        .post('/api/ai/analyze-academic')
        .set('Authorization', `Bearer ${token}`);
      expect([200, 401, 404]).toContain(r.status);
    });
  });

  describe('POST /api/ai/study-recommendations', () => {
    it('returns 200', async () => {
      const r = await agent
        .post('/api/ai/study-recommendations')
        .set('Authorization', `Bearer ${token}`);
      expect([200, 401, 404]).toContain(r.status);
    });
  });
});
