// backend/tests/unit/adminController.analytics.test.js
//
// Unit tests for adminController analytics handlers (heavy gap area).

jest.mock('../../src/config/prismaClient', () => ({
  conversation: { findMany: jest.fn(), groupBy: jest.fn() },
  bugReport: { findMany: jest.fn(), update: jest.fn() },
  message: { count: jest.fn(), aggregate: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
  rateLimitLog: { count: jest.fn() },
  user: { count: jest.fn(), findMany: jest.fn() },
  analyticsSnapshot: { findFirst: jest.fn(), findMany: jest.fn() },
}));

jest.mock('../../src/services/ragService', () => ({
  listDocuments: jest.fn(),
  addDocument: jest.fn(),
  deleteDocument: jest.fn(),
}));

jest.mock('../../src/controllers/guestController', () => ({
  getAllActiveSessions: jest.fn().mockResolvedValue([]),
}));

const prisma = require('../../src/config/prismaClient');
const ctrl = require('../../src/controllers/adminController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('getRealtimeAnalytics', () => {
  it('returns realtime metrics with deltas', async () => {
    prisma.message.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
    prisma.message.aggregate
      .mockResolvedValueOnce({ _sum: { tokenUsage: 500 } })
      .mockResolvedValueOnce({ _avg: { responseTime: 1.5 } });
    prisma.conversation.groupBy.mockResolvedValueOnce([{ userId: 1 }, { userId: 2 }]);
    prisma.rateLimitLog.count.mockResolvedValueOnce(5);
    prisma.analyticsSnapshot.findFirst.mockResolvedValueOnce({
      totalChats: 10, uniqueUsers: 1, totalTokens: 200, errorCount: 1,
    });
    const res = buildRes();
    await ctrl.getRealtimeAnalytics({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        realtime: expect.objectContaining({
          chatToday: 15,
          activeUsers: 2,
        }),
      }),
    );
  });

  it('returns null deltas when no yesterday snapshot', async () => {
    prisma.message.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.message.aggregate
      .mockResolvedValueOnce({ _sum: { tokenUsage: null } })
      .mockResolvedValueOnce({ _avg: { responseTime: null } });
    prisma.conversation.groupBy.mockResolvedValueOnce([]);
    prisma.rateLimitLog.count.mockResolvedValueOnce(0);
    prisma.analyticsSnapshot.findFirst.mockResolvedValueOnce(null);
    const res = buildRes();
    await ctrl.getRealtimeAnalytics({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        realtime: expect.objectContaining({
          delta: expect.objectContaining({ chatToday: null, activeUsers: null }),
        }),
      }),
    );
  });

  it('returns 500 on prisma error', async () => {
    prisma.message.count.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.getRealtimeAnalytics({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getHistoryAnalytics', () => {
  it('returns 7d default with empty data', async () => {
    prisma.analyticsSnapshot.findMany.mockResolvedValueOnce([]);
    prisma.message.groupBy.mockResolvedValueOnce([]);
    const res = buildRes();
    await ctrl.getHistoryAnalytics({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        range: '7d',
        topUsers: [],
      }),
    );
  });

  it('returns 30d range when requested', async () => {
    prisma.analyticsSnapshot.findMany.mockResolvedValueOnce([]);
    prisma.message.groupBy.mockResolvedValueOnce([]);
    const res = buildRes();
    await ctrl.getHistoryAnalytics({ query: { range: '30d' } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ range: '30d' }),
    );
  });

  it('builds topUsers correctly with grouped data', async () => {
    prisma.analyticsSnapshot.findMany.mockResolvedValueOnce([
      { date: new Date(), totalChats: 5, hourlyData: { '10': 3 }, topQuestions: ['q1'] },
    ]);
    prisma.message.groupBy.mockResolvedValueOnce([
      { conversationId: 1, _count: { id: 5 }, _sum: { tokenUsage: 100 } },
    ]);
    prisma.conversation.findMany.mockResolvedValueOnce([
      { id: 1, userId: 7 },
    ]);
    prisma.user.findMany.mockResolvedValueOnce([
      { id: 7, fullName: 'User Seven', email: 'seven@x.com' },
    ]);
    const res = buildRes();
    await ctrl.getHistoryAnalytics({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        topUsers: expect.arrayContaining([
          expect.objectContaining({ name: 'User Seven', chats: 5 }),
        ]),
      }),
    );
  });

  it('returns 500 on prisma error', async () => {
    prisma.analyticsSnapshot.findMany.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.getHistoryAnalytics({ query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
