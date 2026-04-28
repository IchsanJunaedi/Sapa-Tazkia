// backend/tests/unit/suggestedPromptController.test.js
//
// Unit tests for suggestedPromptController — fully mocks prisma + redis + ragService.

jest.mock('../../src/config/prismaClient', () => ({
  suggestedPrompt: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('../../src/services/redisService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

jest.mock('../../src/services/ragService', () => ({
  getSampleDocuments: jest.fn(),
}));

const prisma = require('../../src/config/prismaClient');
const redisService = require('../../src/services/redisService');
const ragService = require('../../src/services/ragService');
const ctrl = require('../../src/controllers/suggestedPromptController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  redisService.get.mockResolvedValue(null);
  redisService.set.mockResolvedValue('OK');
  redisService.del.mockResolvedValue(1);
});

describe('getPublicPrompts', () => {
  it('returns cached data when Redis hit', async () => {
    redisService.get.mockResolvedValueOnce(JSON.stringify([{ id: 1, text: 'cached' }]));
    const res = buildRes();
    await ctrl.getPublicPrompts({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ fromCache: true }));
  });

  it('queries DB and caches when no Redis hit', async () => {
    prisma.suggestedPrompt.findMany.mockResolvedValueOnce([{ id: 1, text: 'a' }]);
    const res = buildRes();
    await ctrl.getPublicPrompts({}, res);
    expect(prisma.suggestedPrompt.findMany).toHaveBeenCalled();
    expect(redisService.set).toHaveBeenCalled();
  });

  it('falls back to empty data on error', async () => {
    redisService.get.mockRejectedValueOnce(new Error('redis down'));
    prisma.suggestedPrompt.findMany.mockRejectedValueOnce(new Error('db down'));
    const res = buildRes();
    await ctrl.getPublicPrompts({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [] }));
  });
});

describe('getRagPrompts', () => {
  it('returns cached when present', async () => {
    redisService.get.mockResolvedValueOnce(JSON.stringify([{ text: 'q' }]));
    const res = buildRes();
    await ctrl.getRagPrompts({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ fromCache: true }));
  });

  it('builds prompts from RAG docs', async () => {
    ragService.getSampleDocuments.mockResolvedValueOnce([
      { suggestedQuestion: 'Apa itu Tazkia ya nih?' },
      { text: 'Konten dokumen panjang yang akan jadi pertanyaan bro' },
    ]);
    const res = buildRes();
    await ctrl.getRagPrompts({}, res);
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('handles RAG service failure gracefully', async () => {
    ragService.getSampleDocuments.mockRejectedValueOnce(new Error('qdrant down'));
    const res = buildRes();
    await ctrl.getRagPrompts({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('getAllPrompts', () => {
  it('returns all prompts', async () => {
    prisma.suggestedPrompt.findMany.mockResolvedValueOnce([{ id: 1 }]);
    const res = buildRes();
    await ctrl.getAllPrompts({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [{ id: 1 }] }));
  });

  it('returns 500 on prisma failure', async () => {
    prisma.suggestedPrompt.findMany.mockRejectedValueOnce(new Error('db'));
    const res = buildRes();
    await ctrl.getAllPrompts({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('createPrompt', () => {
  it('returns 400 when text missing', async () => {
    const res = buildRes();
    await ctrl.createPrompt({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates prompt and invalidates cache', async () => {
    prisma.suggestedPrompt.create.mockResolvedValueOnce({ id: 5, text: 'x' });
    const res = buildRes();
    await ctrl.createPrompt({ body: { text: 'hello', order: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(redisService.del).toHaveBeenCalled();
  });

  it('returns 500 on prisma error', async () => {
    prisma.suggestedPrompt.create.mockRejectedValueOnce(new Error('db'));
    const res = buildRes();
    await ctrl.createPrompt({ body: { text: 'hello' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('updatePrompt', () => {
  it('returns 400 when no fields provided', async () => {
    const res = buildRes();
    await ctrl.updatePrompt({ params: { id: '1' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates and returns 200', async () => {
    prisma.suggestedPrompt.update.mockResolvedValueOnce({ id: 1, text: 'new' });
    const res = buildRes();
    await ctrl.updatePrompt({ params: { id: '1' }, body: { text: 'new' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 404 on P2025', async () => {
    const e = new Error('not found');
    e.code = 'P2025';
    prisma.suggestedPrompt.update.mockRejectedValueOnce(e);
    const res = buildRes();
    await ctrl.updatePrompt({ params: { id: '1' }, body: { text: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on other errors', async () => {
    prisma.suggestedPrompt.update.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.updatePrompt({ params: { id: '1' }, body: { text: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('togglePrompt', () => {
  it('returns 404 when prompt not found', async () => {
    prisma.suggestedPrompt.findUnique.mockResolvedValueOnce(null);
    const res = buildRes();
    await ctrl.togglePrompt({ params: { id: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('toggles isActive', async () => {
    prisma.suggestedPrompt.findUnique.mockResolvedValueOnce({ id: 1, isActive: true });
    prisma.suggestedPrompt.update.mockResolvedValueOnce({ id: 1, isActive: false });
    const res = buildRes();
    await ctrl.togglePrompt({ params: { id: '1' } }, res);
    expect(prisma.suggestedPrompt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('returns 500 on error', async () => {
    prisma.suggestedPrompt.findUnique.mockRejectedValueOnce(new Error('db'));
    const res = buildRes();
    await ctrl.togglePrompt({ params: { id: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('deletePrompt', () => {
  it('deletes successfully', async () => {
    prisma.suggestedPrompt.delete.mockResolvedValueOnce({ id: 1 });
    const res = buildRes();
    await ctrl.deletePrompt({ params: { id: '1' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 404 on P2025', async () => {
    const e = new Error('not found');
    e.code = 'P2025';
    prisma.suggestedPrompt.delete.mockRejectedValueOnce(e);
    const res = buildRes();
    await ctrl.deletePrompt({ params: { id: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on other errors', async () => {
    prisma.suggestedPrompt.delete.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.deletePrompt({ params: { id: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
