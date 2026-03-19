// backend/tests/unit/bugReport.test.js
jest.mock('../../src/config/prismaClient', () => ({
  bugReport: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(),
  security: jest.fn(), debug: jest.fn()
}));

const prisma = require('../../src/config/prismaClient');

describe('BugReport Admin Endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updateBugReport — should update status and adminNotes, return updated record', async () => {
    // This test imports the actual controller — it will FAIL until Step 6.7
    const adminController = require('../../src/controllers/adminController');

    prisma.bugReport.update.mockResolvedValue({
      id: 1, status: 'RESOLVED', adminNotes: 'Fixed in v1.1',
      resolvedAt: new Date(), user: { fullName: 'Test User', email: 'test@tazkia.ac.id' }
    });

    const req = { params: { id: '1' }, body: { status: 'RESOLVED', adminNotes: 'Fixed in v1.1' } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await adminController.updateBugReport(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
    expect(prisma.bugReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RESOLVED', resolvedAt: expect.any(Date) })
      })
    );
  });

  it('updateBugReport — should return 404 when bug report not found', async () => {
    const adminController = require('../../src/controllers/adminController');

    const prismaError = new Error('Record not found');
    prismaError.code = 'P2025';
    prisma.bugReport.update.mockRejectedValue(prismaError);

    const req = { params: { id: '999' }, body: { status: 'RESOLVED' } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await adminController.updateBugReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
