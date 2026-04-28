// backend/tests/unit/adminController.test.js
//
// Unit tests for adminController — fully mocks prisma + ragService + guestController.

jest.mock('../../src/config/prismaClient', () => ({
  conversation: { findMany: jest.fn() },
  bugReport: { findMany: jest.fn(), update: jest.fn() },
  message: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
  rateLimitLog: { count: jest.fn() },
  user: { count: jest.fn() },
  analyticsSnapshot: { findMany: jest.fn() },
}));

jest.mock('../../src/services/ragService', () => ({
  listDocuments: jest.fn(),
  addDocument: jest.fn(),
  deleteDocument: jest.fn(),
}));

jest.mock('../../src/controllers/guestController', () => ({
  getAllActiveSessions: jest.fn(),
}));

const prisma = require('../../src/config/prismaClient');
const ragService = require('../../src/services/ragService');
const guestCtrl = require('../../src/controllers/guestController');
const ctrl = require('../../src/controllers/adminController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('getChatLogs', () => {
  it('returns combined logs from DB + guest sessions', async () => {
    prisma.conversation.findMany.mockResolvedValueOnce([
      {
        user: { fullName: 'Alice', email: 'a@x.com', userType: 'user' },
        messages: [
          { id: 1, role: 'user', content: 'hi', createdAt: new Date() },
          { id: 2, role: 'bot', content: 'hello', createdAt: new Date(), tokenUsage: 10, responseTime: 1.2, isError: false },
        ],
      },
    ]);
    guestCtrl.getAllActiveSessions.mockResolvedValueOnce([
      {
        sessionId: 'g-1',
        session: {
          createdAt: new Date(),
          messages: [
            { role: 'user', content: 'q' },
            { role: 'bot', content: 'a', tokenUsage: 5, responseTime: 0.5, isError: false },
          ],
        },
      },
    ]);
    const res = buildRes();
    await ctrl.getChatLogs({}, res);
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.logs.length).toBeGreaterThanOrEqual(2);
  });

  it('handles guest session error gracefully (still returns DB logs)', async () => {
    prisma.conversation.findMany.mockResolvedValueOnce([]);
    guestCtrl.getAllActiveSessions.mockRejectedValueOnce(new Error('redis down'));
    const res = buildRes();
    await ctrl.getChatLogs({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on prisma failure', async () => {
    prisma.conversation.findMany.mockRejectedValueOnce(new Error('db down'));
    const res = buildRes();
    await ctrl.getChatLogs({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('listKnowledgeBase', () => {
  it('returns documents list', async () => {
    ragService.listDocuments.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    const res = buildRes();
    await ctrl.listKnowledgeBase({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('returns 500 on error', async () => {
    ragService.listDocuments.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.listKnowledgeBase({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('addKnowledgeDoc', () => {
  it('returns 400 when content < 10 chars', async () => {
    const res = buildRes();
    await ctrl.addKnowledgeDoc({ body: { content: 'hi' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when content > 50000 chars', async () => {
    const res = buildRes();
    const big = 'a'.repeat(50001);
    await ctrl.addKnowledgeDoc({ body: { content: big } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates document with provided source/category', async () => {
    ragService.addDocument.mockResolvedValueOnce({ id: 'd1' });
    const res = buildRes();
    await ctrl.addKnowledgeDoc({ body: { content: 'valid content here', source: 's', category: 'c' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(ragService.addDocument).toHaveBeenCalledWith(
      'valid content here',
      expect.objectContaining({ source: 's', category: 'c' }),
    );
  });

  it('returns 500 when ragService throws', async () => {
    ragService.addDocument.mockRejectedValueOnce(new Error('qdrant'));
    const res = buildRes();
    await ctrl.addKnowledgeDoc({ body: { content: 'valid content here' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('deleteKnowledgeDoc', () => {
  it('returns 400 when id missing', async () => {
    const res = buildRes();
    await ctrl.deleteKnowledgeDoc({ params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('deletes successfully', async () => {
    ragService.deleteDocument.mockResolvedValueOnce({ deleted: true });
    const res = buildRes();
    await ctrl.deleteKnowledgeDoc({ params: { id: 'abc' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on error', async () => {
    ragService.deleteDocument.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.deleteKnowledgeDoc({ params: { id: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getBugReports', () => {
  it('returns reports list', async () => {
    prisma.bugReport.findMany.mockResolvedValueOnce([{ id: 1 }]);
    const res = buildRes();
    await ctrl.getBugReports({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on prisma error', async () => {
    prisma.bugReport.findMany.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.getBugReports({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('updateBugReport', () => {
  it('updates status', async () => {
    prisma.bugReport.update.mockResolvedValueOnce({ id: 1, status: 'OPEN' });
    const res = buildRes();
    await ctrl.updateBugReport({ params: { id: '1' }, body: { status: 'OPEN', adminNotes: 'note' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('sets resolvedAt when status RESOLVED', async () => {
    prisma.bugReport.update.mockResolvedValueOnce({ id: 1, status: 'RESOLVED' });
    const res = buildRes();
    await ctrl.updateBugReport({ params: { id: '1' }, body: { status: 'RESOLVED' } }, res);
    expect(prisma.bugReport.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ resolvedAt: expect.any(Date) }) }),
    );
  });

  it('returns 404 on P2025', async () => {
    const e = new Error('not found');
    e.code = 'P2025';
    prisma.bugReport.update.mockRejectedValueOnce(e);
    const res = buildRes();
    await ctrl.updateBugReport({ params: { id: '1' }, body: { status: 'OPEN' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 500 on other errors', async () => {
    prisma.bugReport.update.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.updateBugReport({ params: { id: '1' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('uploadPdfDoc', () => {
  it('returns 400 when no file', async () => {
    const res = buildRes();
    await ctrl.uploadPdfDoc({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 422 when buffer is not a PDF magic bytes', async () => {
    const req = { file: { buffer: Buffer.from('not-a-pdf-file'), originalname: 'fake.pdf' }, body: {} };
    const res = buildRes();
    await ctrl.uploadPdfDoc(req, res);
    expect(res.status).toHaveBeenCalledWith(422);
  });
});
