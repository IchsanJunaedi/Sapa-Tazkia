// backend/tests/unit/notificationController.test.js
//
// Unit tests for notificationController — fully mocks prisma.

jest.mock('../../src/config/prismaClient', () => ({
  notification: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    createMany: jest.fn(),
  },
  announcement: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
}));

const prisma = require('../../src/config/prismaClient');
const ctrl = require('../../src/controllers/notificationController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

describe('getNotifications', () => {
  it('returns notifications with unreadCount', async () => {
    prisma.notification.findMany.mockResolvedValueOnce([
      { id: 1, isRead: false }, { id: 2, isRead: true },
    ]);
    const res = buildRes();
    await ctrl.getNotifications({ user: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, unreadCount: 1 }),
    );
  });

  it('returns 500 on prisma error', async () => {
    prisma.notification.findMany.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.getNotifications({ user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('markAllRead', () => {
  it('updates and returns count', async () => {
    prisma.notification.updateMany.mockResolvedValueOnce({ count: 5 });
    const res = buildRes();
    await ctrl.markAllRead({ user: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ updated: 5 }));
  });

  it('returns 500 on error', async () => {
    prisma.notification.updateMany.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.markAllRead({ user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('markRead', () => {
  it('returns 404 when notif not owned', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce(null);
    const res = buildRes();
    await ctrl.markRead({ user: { id: 1 }, params: { id: '5' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('marks as read', async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({ id: 5 });
    prisma.notification.update.mockResolvedValueOnce({ id: 5, isRead: true });
    const res = buildRes();
    await ctrl.markRead({ user: { id: 1 }, params: { id: '5' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on error', async () => {
    prisma.notification.findFirst.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.markRead({ user: { id: 1 }, params: { id: '1' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('createAnnouncement', () => {
  it('returns 400 when title missing', async () => {
    const res = buildRes();
    await ctrl.createAnnouncement({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when title too long', async () => {
    const res = buildRes();
    await ctrl.createAnnouncement({ body: { title: 'a'.repeat(201), message: 'm' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when message missing', async () => {
    const res = buildRes();
    await ctrl.createAnnouncement({ body: { title: 'ok' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when message too long', async () => {
    const res = buildRes();
    await ctrl.createAnnouncement({ body: { title: 'ok', message: 'a'.repeat(2001) } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates announcement and fans out to active users', async () => {
    prisma.announcement.create.mockResolvedValueOnce({ id: 7 });
    prisma.user.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    prisma.notification.createMany.mockResolvedValueOnce({ count: 2 });
    const res = buildRes();
    await ctrl.createAnnouncement({ body: { title: 'T', message: 'M' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it('skips fan-out when no active users', async () => {
    prisma.announcement.create.mockResolvedValueOnce({ id: 8 });
    prisma.user.findMany.mockResolvedValueOnce([]);
    const res = buildRes();
    await ctrl.createAnnouncement({ body: { title: 'T', message: 'M' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it('returns 500 on prisma error', async () => {
    prisma.announcement.create.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.createAnnouncement({ body: { title: 'T', message: 'M' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getAnnouncements', () => {
  it('returns list', async () => {
    prisma.announcement.findMany.mockResolvedValueOnce([{ id: 1 }]);
    const res = buildRes();
    await ctrl.getAnnouncements({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on error', async () => {
    prisma.announcement.findMany.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.getAnnouncements({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
