// backend/tests/unit/bugReportController.test.js

jest.mock('../../src/config/prismaClient', () => ({
  bugReport: { create: jest.fn() },
}));

const prisma = require('../../src/config/prismaClient');
const { createBugReport } = require('../../src/controllers/bugReportController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('createBugReport', () => {
  it('returns 400 when title < 10 chars', async () => {
    const res = buildRes();
    await createBugReport({ body: { title: 'short' }, headers: {}, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when title > 200 chars', async () => {
    const res = buildRes();
    await createBugReport({ body: { title: 'a'.repeat(201) }, headers: {}, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates report with default severity MEDIUM', async () => {
    prisma.bugReport.create.mockResolvedValueOnce({ id: 7 });
    const res = buildRes();
    await createBugReport(
      {
        body: { title: 'A bug title that is long enough', description: 'desc', pageUrl: '/x' },
        headers: { 'user-agent': 'jest-agent' },
        user: { id: 5 },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.bugReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: 'MEDIUM',
          userId: 5,
          userAgent: 'jest-agent',
        }),
      }),
    );
  });

  it('honors provided severity', async () => {
    prisma.bugReport.create.mockResolvedValueOnce({ id: 8 });
    const res = buildRes();
    await createBugReport(
      {
        body: { title: 'A bug title that is long enough', severity: 'HIGH' },
        headers: {},
        user: { id: 1 },
      },
      res,
    );
    expect(prisma.bugReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ severity: 'HIGH' }) }),
    );
  });

  it('returns 500 on prisma error', async () => {
    prisma.bugReport.create.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await createBugReport(
      { body: { title: 'A bug title that is long enough' }, headers: {}, user: { id: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
