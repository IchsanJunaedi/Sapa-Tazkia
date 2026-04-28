// backend/tests/unit/aiController.sendChat.test.js
//
// Unit tests for aiController.sendChat — non-streaming paths only.

jest.mock('../../src/config/prismaClient', () => ({
  conversation: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  message: {
    findMany: jest.fn().mockResolvedValue([]),
    createMany: jest.fn(),
  },
  user: { findUnique: jest.fn() },
  academicGrade: { findMany: jest.fn() },
}));

jest.mock('../../src/services/ragService', () => ({
  answerQuestion: jest.fn(),
}));

jest.mock('../../src/services/openaiService', () => ({
  generateAIResponse: jest.fn(),
  testOpenAIConnection: jest.fn(),
  generateTitle: jest.fn().mockResolvedValue('Title'),
  isGreeting: jest.fn().mockReturnValue(false),
}));

jest.mock('../../src/services/rateLimitService', () => ({
  trackTokenUsage: jest.fn().mockResolvedValue({ success: true, totalUsage: 100 }),
  getLimits: jest.fn().mockReturnValue({ tokenLimitDaily: 15000 }),
}));

jest.mock('../../src/services/academicService', () => ({}));

const prisma = require('../../src/config/prismaClient');
const ragService = require('../../src/services/ragService');
const openaiService = require('../../src/services/openaiService');
const ctrl = require('../../src/controllers/aiController');

const buildReq = (overrides = {}) => ({
  body: { message: 'hello there', stream: false, ...overrides },
  user: { id: 1 },
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('aiController.sendChat (non-streaming)', () => {
  it('returns 401 when no user', async () => {
    const res = buildRes();
    const req = buildReq();
    req.user = null;
    await ctrl.sendChat(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 400 when message empty', async () => {
    const res = buildRes();
    const req = buildReq({ message: '' });
    await ctrl.sendChat(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('processes general (RAG) query: non-stream success', async () => {
    ragService.answerQuestion.mockResolvedValueOnce({
      isStream: false,
      answer: 'A general answer',
      usage: { total_tokens: 80 },
      docsDetail: [],
    });
    prisma.conversation.create.mockResolvedValueOnce({ id: 100 });
    const res = buildRes();
    await ctrl.sendChat(buildReq({ isNewChat: true }), res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, reply: 'A general answer' }),
    );
    expect(prisma.conversation.create).toHaveBeenCalled();
  });

  it('processes academic query: returns response with grades', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      fullName: 'A',
      academicSummary: { ipk: '3.5', totalSks: 100 },
      programStudi: { name: 'Informatika' },
    });
    prisma.academicGrade.findMany.mockResolvedValueOnce([
      { semester: 1, course: { name: 'Calculus' }, grade: 'A' },
    ]);
    openaiService.generateAIResponse.mockResolvedValueOnce({
      content: 'Academic answer about your IPK',
    });
    prisma.conversation.create.mockResolvedValueOnce({ id: 200 });
    const res = buildRes();
    await ctrl.sendChat(
      buildReq({ message: 'Berapa nilai IPK saya?', isNewChat: true }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it('handles academic query with no user data found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.academicGrade.findMany.mockResolvedValueOnce([]);
    prisma.conversation.create.mockResolvedValueOnce({ id: 300 });
    const res = buildRes();
    await ctrl.sendChat(
      buildReq({ message: 'lihat ipk saya', isNewChat: true }),
      res,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        reply: expect.stringContaining('tidak ditemukan'),
      }),
    );
  });

  it('saves message to existing conversation when conversationId provided', async () => {
    ragService.answerQuestion.mockResolvedValueOnce({
      isStream: false,
      answer: 'reply',
      usage: { total_tokens: 50 },
      docsDetail: [],
    });
    prisma.message.createMany.mockResolvedValueOnce({ count: 2 });
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: 5, title: 'Percakapan Baru',
    });
    prisma.conversation.update.mockResolvedValueOnce({});
    const res = buildRes();
    await ctrl.sendChat(buildReq({ conversationId: '5' }), res);
    expect(prisma.message.createMany).toHaveBeenCalled();
  });

  it('returns 500 on RAG error', async () => {
    ragService.answerQuestion.mockRejectedValueOnce(new Error('rag down'));
    const res = buildRes();
    await ctrl.sendChat(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('loads history from existing conversation', async () => {
    prisma.message.findMany.mockResolvedValueOnce([
      { role: 'user', content: 'old' },
      { role: 'bot', content: 'reply' },
    ]);
    ragService.answerQuestion.mockResolvedValueOnce({
      isStream: false, answer: 'a', usage: { total_tokens: 10 }, docsDetail: [],
    });
    prisma.message.createMany.mockResolvedValueOnce({});
    prisma.conversation.findUnique.mockResolvedValueOnce({
      id: 9, title: 'real title',
    });
    prisma.conversation.update.mockResolvedValueOnce({});
    const res = buildRes();
    await ctrl.sendChat(buildReq({ conversationId: '9' }), res);
    expect(prisma.message.findMany).toHaveBeenCalled();
  });
});
