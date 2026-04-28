// backend/tests/unit/analyticsJob.test.js
//
// Unit tests for analyticsJob.init() — mocks prisma + setInterval and
// verifies the snapshot upsert is called with aggregated values.

jest.mock('../../src/config/prismaClient', () => ({
  message: {
    count: jest.fn(),
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
  conversation: {
    findMany: jest.fn(),
  },
  rateLimitLog: {
    count: jest.fn(),
  },
  analyticsSnapshot: {
    upsert: jest.fn(),
  },
}));

const prisma = require('../../src/config/prismaClient');

let setIntervalSpy;
let originalSetInterval;

beforeEach(() => {
  jest.clearAllMocks();
  // Default: zero data
  prisma.message.count.mockResolvedValue(0);
  prisma.message.aggregate.mockResolvedValue({ _sum: { tokenUsage: 0 }, _avg: { responseTime: null } });
  prisma.message.findMany.mockResolvedValue([]);
  prisma.conversation.findMany.mockResolvedValue([]);
  prisma.rateLimitLog.count.mockResolvedValue(0);
  prisma.analyticsSnapshot.upsert.mockResolvedValue({});

  // Stub setInterval so it doesn't keep Jest alive
  originalSetInterval = global.setInterval;
  setIntervalSpy = jest.fn();
  global.setInterval = setIntervalSpy;
});

afterEach(() => {
  global.setInterval = originalSetInterval;
});

describe('analyticsJob', () => {
  it('init() runs an immediate snapshot + schedules a 30-min interval', async () => {
    jest.isolateModules(() => {
      const { init } = require('../../src/jobs/analyticsJob');
      init();
    });
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));

    expect(prisma.analyticsSnapshot.upsert).toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30 * 60 * 1000);
  });

  it('aggregates metrics correctly with non-zero data', async () => {
    prisma.message.count
      .mockResolvedValueOnce(5)  // userChats
      .mockResolvedValueOnce(2); // errorCount
    prisma.message.aggregate
      .mockResolvedValueOnce({ _sum: { tokenUsage: 1234 } })
      .mockResolvedValueOnce({ _avg: { responseTime: 250.5 } });
    prisma.message.findMany
      .mockResolvedValueOnce([{ conversationId: 1 }, { conversationId: 2 }])
      .mockResolvedValueOnce([
        { createdAt: new Date('2025-01-01T05:00:00Z') },
        { createdAt: new Date('2025-01-01T05:30:00Z') },
        { createdAt: new Date('2025-01-01T07:30:00Z') },
      ])
      .mockResolvedValueOnce([
        { content: 'Apa itu Tazkia?' },
        { content: 'Apa itu Tazkia?' },
        { content: 'Bagaimana mendaftar?' },
        { content: 'hi' }, // skipped
      ]);
    prisma.conversation.findMany.mockResolvedValueOnce([{ userId: 7 }, { userId: 8 }]);
    prisma.rateLimitLog.count.mockResolvedValueOnce(3);

    jest.isolateModules(() => {
      const { init } = require('../../src/jobs/analyticsJob');
      init();
    });
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));

    expect(prisma.analyticsSnapshot.upsert).toHaveBeenCalled();
    const call = prisma.analyticsSnapshot.upsert.mock.calls[0][0];
    expect(call.create.userChats).toBe(5);
    expect(call.create.totalChats).toBe(8);
    expect(call.create.uniqueUsers).toBe(2);
    expect(call.create.topQuestions[0].question).toContain('apa itu tazkia');
  });

  it('swallows runtime errors', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    prisma.message.count.mockRejectedValueOnce(new Error('db down'));

    jest.isolateModules(() => {
      const { init } = require('../../src/jobs/analyticsJob');
      init();
    });
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
