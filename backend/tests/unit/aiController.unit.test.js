// backend/tests/unit/aiController.unit.test.js
//
// Unit tests for aiController helper handlers.

jest.mock('../../src/config/prismaClient', () => ({
  conversation: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    deleteMany: jest.fn(),
  },
  message: { findMany: jest.fn() },
}));

jest.mock('../../src/services/ragService', () => ({
  answerQuestion: jest.fn(),
}));
jest.mock('../../src/services/openaiService', () => ({
  generateAIResponse: jest.fn(),
  testOpenAIConnection: jest.fn(),
  generateTitle: jest.fn(),
  isGreeting: jest.fn(),
}));
jest.mock('../../src/services/academicService', () => ({}));
jest.mock('../../src/services/rateLimitService', () => ({}));

const prisma = require('../../src/config/prismaClient');
const openaiService = require('../../src/services/openaiService');
const ctrl = require('../../src/controllers/aiController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('triggerIngestion', () => {
  it('returns dummy success', async () => {
    const res = buildRes();
    await ctrl.triggerIngestion({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('getConversations', () => {
  it('returns user conversations', async () => {
    prisma.conversation.findMany.mockResolvedValueOnce([
      { id: 1, title: 'a', updatedAt: new Date(), createdAt: new Date() },
    ]);
    const res = buildRes();
    await ctrl.getConversations({ user: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on error', async () => {
    prisma.conversation.findMany.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.getConversations({ user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getChatHistory', () => {
  it('returns 400 when id missing', async () => {
    const res = buildRes();
    await ctrl.getChatHistory({ params: {}, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when id is non-numeric', async () => {
    const res = buildRes();
    await ctrl.getChatHistory({ params: { id: 'abc' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when conversation not owned', async () => {
    prisma.conversation.findFirst.mockResolvedValueOnce(null);
    const res = buildRes();
    await ctrl.getChatHistory({ params: { id: '1' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 with messages', async () => {
    prisma.conversation.findFirst.mockResolvedValueOnce({ id: 1 });
    prisma.message.findMany.mockResolvedValueOnce([{ id: 1, content: 'hi' }]);
    const res = buildRes();
    await ctrl.getChatHistory({ params: { id: '1' }, user: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on error', async () => {
    prisma.conversation.findFirst.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.getChatHistory({ params: { id: '1' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('deleteConversation', () => {
  it('returns 400 when id invalid', async () => {
    const res = buildRes();
    await ctrl.deleteConversation({ params: { id: 'abc' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when nothing deleted', async () => {
    prisma.conversation.deleteMany.mockResolvedValueOnce({ count: 0 });
    const res = buildRes();
    await ctrl.deleteConversation({ params: { id: '1' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 on delete success', async () => {
    prisma.conversation.deleteMany.mockResolvedValueOnce({ count: 1 });
    const res = buildRes();
    await ctrl.deleteConversation({ params: { id: '1' }, user: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on prisma error', async () => {
    prisma.conversation.deleteMany.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.deleteConversation({ params: { id: '1' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('searchConversations', () => {
  it('returns 400 when q < 2 chars', async () => {
    const res = buildRes();
    await ctrl.searchConversations({ query: { q: 'a' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 with results', async () => {
    prisma.conversation.findMany.mockResolvedValueOnce([{ id: 1, title: 'hi' }]);
    const res = buildRes();
    await ctrl.searchConversations({ query: { q: 'hello' }, user: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on prisma error', async () => {
    prisma.conversation.findMany.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.searchConversations({ query: { q: 'hello' }, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('placeholder handlers', () => {
  it('analyzeAcademicPerformance returns success', async () => {
    const res = buildRes();
    await ctrl.analyzeAcademicPerformance({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('getStudyRecommendations returns success', async () => {
    const res = buildRes();
    await ctrl.getStudyRecommendations({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('testAI returns success', async () => {
    const res = buildRes();
    await ctrl.testAI({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('testOpenAIConnection invokes service', async () => {
    openaiService.testOpenAIConnection.mockResolvedValueOnce({ success: true, model: 'gpt-4o' });
    const res = buildRes();
    await ctrl.testOpenAIConnection({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
