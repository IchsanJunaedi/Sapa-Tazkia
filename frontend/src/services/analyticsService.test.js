// analyticsService.js uses @prisma/client which isn't installed in frontend.
// Mock it so the module loads, then exercise its public surface for coverage.

const mockGroupBy = jest.fn();
const mockCreate = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    rateLimitLog: {
      create: mockCreate,
      groupBy: mockGroupBy,
    },
  })),
}), { virtual: true });

let analytics;
beforeEach(() => {
  jest.resetModules();
  mockGroupBy.mockReset();
  mockCreate.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  analytics = require('./analyticsService');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('services/analyticsService', () => {
  it('trackRequest persists a successful request log', async () => {
    mockCreate.mockResolvedValue({});
    await analytics.trackRequest(1, '127.0.0.1', '/x', false);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 1,
        ipAddress: '127.0.0.1',
        endpoint: '/x',
        wasBlocked: false,
        statusCode: 200,
      }),
    }));
  });

  it('trackRequest persists a blocked request log with 429 status', async () => {
    mockCreate.mockResolvedValue({});
    await analytics.trackRequest(2, '1.1.1.1', '/y', true);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ wasBlocked: true, statusCode: 429 }),
    }));
  });

  it('trackRequest swallows errors', async () => {
    mockCreate.mockRejectedValue(new Error('boom'));
    await expect(analytics.trackRequest(1, 'ip', '/x')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('getSystemWideStats aggregates by endpoint', async () => {
    mockGroupBy.mockResolvedValue([
      { endpoint: '/a', wasBlocked: false, _count: { id: 5 } },
      { endpoint: '/a', wasBlocked: true, _count: { id: 2 } },
      { endpoint: '/b', wasBlocked: false, _count: { id: 1 } },
    ]);
    const res = await analytics.getSystemWideStats('24h');
    expect(res['/a']).toEqual({ allowed: 5, blocked: 2, total: 7 });
    expect(res['/b']).toEqual({ allowed: 1, blocked: 0, total: 1 });
  });

  it('getSystemWideStats supports 1h and 7d windows', async () => {
    mockGroupBy.mockResolvedValue([]);
    await analytics.getSystemWideStats('1h');
    await analytics.getSystemWideStats('7d');
    expect(mockGroupBy).toHaveBeenCalledTimes(2);
  });

  it('aggregateStats handles empty input', () => {
    expect(analytics.aggregateStats([])).toEqual({});
  });

  it('getTopBlockedIPs queries with default limit', async () => {
    mockGroupBy.mockResolvedValue([{ ipAddress: '1.1.1.1', _count: { id: 3 } }]);
    const out = await analytics.getTopBlockedIPs();
    expect(out).toHaveLength(1);
    expect(mockGroupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it('getTopBlockedIPs respects custom limit', async () => {
    mockGroupBy.mockResolvedValue([]);
    await analytics.getTopBlockedIPs(25);
    expect(mockGroupBy).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });
});
