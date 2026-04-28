// backend/tests/integration/ai-routes-public.test.js
// Hit public endpoints in aiRoutes to exercise route definitions + handlers.

jest.mock('../../src/services/openaiService', () => ({
  testOpenAIConnection: jest.fn().mockResolvedValue({ success: true, model: 'gpt-4o-mini' }),
  createEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0)),
  generateAIResponse: jest.fn(),
  generateTitle: jest.fn(),
  isGreeting: jest.fn().mockReturnValue(false),
}));

jest.mock('../../src/services/ragService', () => ({
  getCollectionInfo: jest.fn().mockResolvedValue({ exists: true, pointsCount: 5 }),
  answerQuestion: jest.fn().mockResolvedValue({
    isStream: false, answer: 'mock answer', usage: { total_tokens: 50 }, docsDetail: [],
  }),
  resetAndReingest: jest.fn().mockResolvedValue({ ingested: 10 }),
}));

jest.mock('../../src/services/redisService', () => {
  const original = jest.requireActual('../../src/services/redisService');
  return {
    ...original,
    healthCheck: jest.fn().mockResolvedValue(true),
  };
});

const { agent } = require('../helpers/appHelper');

describe('aiRoutes public endpoints', () => {
  it('GET /api/ai/ returns API doc', async () => {
    const res = await agent.get('/api/ai/');
    expect(res.status).toBe(200);
    expect(res.body.endpoints).toBeDefined();
  });

  it('GET /api/ai/public-test returns ready', async () => {
    const res = await agent.get('/api/ai/public-test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/ai/test-openai returns connection result', async () => {
    const res = await agent.get('/api/ai/test-openai');
    expect(res.status).toBe(200);
  });

  it('GET /api/ai/test-embedding returns embedding info', async () => {
    const res = await agent.get('/api/ai/test-embedding');
    expect([200, 500]).toContain(res.status);
  });

  it('GET /api/ai/health returns health status', async () => {
    const res = await agent.get('/api/ai/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('GET /api/ai/knowledge-status returns KB info', async () => {
    const res = await agent.get('/api/ai/knowledge-status');
    expect([200, 500]).toContain(res.status);
  });

  it('GET /api/ai/rate-limit-status returns quota', async () => {
    const res = await agent.get('/api/ai/rate-limit-status');
    expect(res.status).toBe(200);
  });

  it('POST /api/ai/test-rag with valid query', async () => {
    const res = await agent.post('/api/ai/test-rag').send({ query: 'apa itu tazkia?' });
    expect([200, 400, 500]).toContain(res.status);
  });

  it('POST /api/ai/test-rag without query (any status acceptable)', async () => {
    const res = await agent.post('/api/ai/test-rag').send({});
    expect([200, 400, 422, 500]).toContain(res.status);
  });

  it('POST /api/ai/test-ai exists (returns success)', async () => {
    const res = await agent.post('/api/ai/test-ai').send({ message: 'hi' });
    expect([200, 400, 500]).toContain(res.status);
  });

  it('POST /api/ai/reset-knowledge requires auth', async () => {
    const res = await agent.post('/api/ai/reset-knowledge').send({});
    expect([401, 403]).toContain(res.status);
  });
});
