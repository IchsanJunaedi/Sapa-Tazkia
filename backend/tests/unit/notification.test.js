const prisma = require('../../src/config/prismaClient');

jest.mock('../../src/config/prismaClient', () => ({
  notification: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  user: { findMany: jest.fn() },
  announcement: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
}));

const { getNotifications, markRead, markAllRead } =
  require('../../src/controllers/notificationController');

const mockReq = (overrides = {}) => ({ user: { id: 1 }, params: {}, body: {}, ...overrides });
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('notificationController', () => {
  afterEach(() => jest.clearAllMocks());

  test('getNotifications returns user notifications', async () => {
    prisma.notification.findMany.mockResolvedValue([
      { id: 1, isRead: false, announcement: { title: 'Test', message: 'Isi' }, createdAt: new Date() }
    ]);
    const req = mockReq();
    const res = mockRes();
    await getNotifications(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) })
    );
  });

  test('markRead checks ownership before updating', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await markRead(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('markAllRead only updates notifications milik user tersebut', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    const req = mockReq();
    const res = mockRes();
    await markAllRead(req, res);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, isRead: false },
      data: { isRead: true },
    });
  });
});
