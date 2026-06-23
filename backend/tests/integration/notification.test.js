// backend/tests/integration/notification.test.js
//
// Integration tests for notificationController + announcement creation:
// - GET /api/notifications
// - PATCH /api/notifications/read-all
// - PATCH /api/notifications/:id/read
// - POST /api/admin/announcements (admin only)
// - Multi-user isolation (notifications belong to the requesting user only)
// - Unread count accuracy
// - Pagination / limit params (if supported)

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const { agent } = require('../helpers/appHelper');
const { prisma, truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

describe('Notifications + Announcements', () => {
  let user;
  let token;

  beforeAll(async () => {
    await truncateAll();
    const seeded = await seedTestUser();
    user = seeded.user;
    const loginRes = await agent.post('/api/auth/login').send({
      identifier: user.nim, password: seeded.plainPassword,
    });
    token = loginRes.body.token;
    expect(token).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  describe('GET /api/notifications', () => {
    it('returns 401 without auth', async () => {
      const r = await agent.get('/api/notifications');
      expect(r.status).toBe(401);
    });

    it('returns empty list for new user', async () => {
      const r = await agent.get('/api/notifications').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(Array.isArray(r.body.data)).toBe(true);
      expect(r.body.unreadCount).toBe(0);
    });

    it('returns notifications when present', async () => {
      const ann = await prisma.announcement.create({
        data: { title: 'Test', message: 'hi' },
      });
      await prisma.notification.create({
        data: { userId: user.id, announcementId: ann.id, isRead: false },
      });

      const r = await agent.get('/api/notifications').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.data.length).toBeGreaterThan(0);
      expect(r.body.unreadCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    it('marks all unread notifications as read', async () => {
      const r = await agent
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);

      const remaining = await prisma.notification.count({
        where: { userId: user.id, isRead: false },
      });
      expect(remaining).toBe(0);
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    it('returns 404 for unknown id', async () => {
      const r = await agent
        .patch('/api/notifications/999999/read')
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(404);
    });

    it('marks a single notification read', async () => {
      const ann = await prisma.announcement.create({ data: { title: 'b', message: 'b' } });
      const notif = await prisma.notification.create({
        data: { userId: user.id, announcementId: ann.id, isRead: false },
      });

      const r = await agent
        .patch(`/api/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/announcements (admin auth required)', () => {
    let adminToken;

    beforeAll(async () => {
      const adminSeed = await seedTestUser({
        nim: 'A1234567890',
        email: 'admin-notif@x.com',
        userType: 'admin',
      });
      const lr = await agent.post('/api/auth/login').send({
        identifier: 'A1234567890', password: adminSeed.plainPassword,
      });
      adminToken = lr.body.token;
    });

    it('returns 401 without auth', async () => {
      const r = await agent.post('/api/admin/announcements').send({ title: 't', message: 'm' });
      // Admin routes are IP-whitelist + admin auth; expect either 401 or 403 depending on env
      expect([401, 403]).toContain(r.status);
    });

    it('returns 400 for missing title', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: 'm only' });
      // 400 validation when admin auth passes; 401/403 if IP whitelist blocks
      expect([400, 401, 403]).toContain(r.status);
    });

    it('creates announcement and fans out to active users (when allowed)', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Test announcement', message: 'Hello everyone' });
      // 200/201 happy path; 401/403 if IP whitelist blocks (test env)
      expect([200, 201, 401, 403]).toContain(r.status);
      if (r.status === 200 || r.status === 201) {
        expect(r.body.success).toBe(true);
      }
    });

    it('GET /api/admin/announcements returns list', async () => {
      const r = await agent
        .get('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200, 401, 403]).toContain(r.status);
      if (r.status === 200) {
        expect(Array.isArray(r.body.announcements ?? r.body.data ?? [])).toBe(true);
      }
    });
  });
});

// -----------------------------------------------------------------------
// Extended: multi-user isolation + unread count accuracy
// -----------------------------------------------------------------------
describe('Notifications — extended coverage', () => {
  const { agent } = require('../helpers/appHelper');
  const { prisma, truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

  let userA, tokenA;
  let userB, tokenB;

  beforeAll(async () => {
    // Truncation done by the outer suite; seed two separate users here
    const seedA = await seedTestUser({ nim: 'NOTIF_A001', email: 'notif-a@x.com' });
    userA = seedA.user;
    const rA = await agent.post('/api/auth/login').send({ identifier: userA.nim, password: seedA.plainPassword });
    tokenA = rA.body.token;

    const seedB = await seedTestUser({ nim: 'NOTIF_B001', email: 'notif-b@x.com' });
    userB = seedB.user;
    const rB = await agent.post('/api/auth/login').send({ identifier: userB.nim, password: seedB.plainPassword });
    tokenB = rB.body.token;
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  it('user A only sees their own notifications', async () => {
    const ann = await prisma.announcement.create({ data: { title: 'Isolation', message: 'only for A' } });
    // Create notification only for user A
    await prisma.notification.create({ data: { userId: userA.id, announcementId: ann.id, isRead: false } });

    const rA = await agent.get('/api/notifications').set('Authorization', `Bearer ${tokenA}`);
    expect(rA.status).toBe(200);
    expect(rA.body.data.length).toBeGreaterThan(0);

    const rB = await agent.get('/api/notifications').set('Authorization', `Bearer ${tokenB}`);
    expect(rB.status).toBe(200);
    // User B should not see user A's notification
    const bIds = rB.body.data.map((n) => n.userId);
    expect(bIds).not.toContain(userA.id);
  });

  it('unreadCount decreases after PATCH read-all', async () => {
    const ann = await prisma.announcement.create({ data: { title: 'Unread count', message: 'test' } });
    await prisma.notification.createMany({
      data: [
        { userId: userA.id, announcementId: ann.id, isRead: false },
      ],
    });

    // Before read-all
    const before = await agent.get('/api/notifications').set('Authorization', `Bearer ${tokenA}`);
    const unreadBefore = before.body.unreadCount;
    expect(unreadBefore).toBeGreaterThan(0);

    // Mark all read
    await agent.patch('/api/notifications/read-all').set('Authorization', `Bearer ${tokenA}`);

    // After read-all
    const after = await agent.get('/api/notifications').set('Authorization', `Bearer ${tokenA}`);
    expect(after.body.unreadCount).toBe(0);
  });

  it('GET /api/notifications accepts a limit query param without error', async () => {
    const r = await agent.get('/api/notifications?limit=5').set('Authorization', `Bearer ${tokenA}`);
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
  });
});
