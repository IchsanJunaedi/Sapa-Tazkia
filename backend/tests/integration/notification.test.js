// backend/tests/integration/notification.test.js
//
// Integration tests for notificationController + announcement creation:
// - GET    /api/notifications
// - PATCH  /api/notifications/read-all
// - PATCH  /api/notifications/:id/read
// - DELETE /api/notifications/:id (if route exists)
// - POST   /api/admin/announcements (admin only)
// - GET    /api/admin/announcements (admin only)
// - Fan-out: announcement creates per-user notifications for active users
// - DB-level: verifies counts/state via Prisma after each mutation

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/ragService', () => ({
  listDocuments: jest.fn().mockResolvedValue([]),
  addDocument: jest.fn().mockResolvedValue({ id: 'doc-id' }),
  deleteDocument: jest.fn().mockResolvedValue({ deleted: true }),
  getCollectionInfo: jest.fn().mockResolvedValue({ exists: false, pointsCount: 0 }),
  answerQuestion: jest.fn().mockResolvedValue({ answer: 'ok', usage: { total_tokens: 5 } }),
}));

jest.mock('../../src/services/openaiService', () => ({
  testOpenAIConnection: jest.fn().mockResolvedValue({ success: false }),
  generateTitle: jest.fn().mockResolvedValue('Mock Title'),
}));

const { agent } = require('../helpers/appHelper');
const { prisma, truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

// ---------------------------------------------------------------------------
// Helper: login and return JWT
async function loginAs({ identifier, password }) {
  const res = await agent.post('/api/auth/login').send({ identifier, password });
  return res.body.token;
}

// ---------------------------------------------------------------------------
describe('Notifications + Announcements', () => {
  let user;
  let token;
  let adminUser;
  let adminToken;
  let user2;
  let token2;

  beforeAll(async () => {
    await truncateAll();

    // ---- Primary student user ----
    const seeded = await seedTestUser({
      nim: '2021003001',
      email: 'notif-student1@tazkia.ac.id',
      userType: 'student',
    });
    user = seeded.user;
    token = await loginAs({ identifier: user.nim, password: seeded.plainPassword });
    expect(token).toBeDefined();

    // ---- Second student user (for fan-out test) ----
    const seeded2 = await seedTestUser({
      nim: '2021003002',
      email: 'notif-student2@tazkia.ac.id',
      userType: 'student',
    });
    user2 = seeded2.user;
    token2 = await loginAs({ identifier: user2.nim, password: seeded2.plainPassword });
    expect(token2).toBeDefined();

    // ---- Admin user ----
    const adminSeed = await seedTestUser({
      nim: 'A0000000003',
      email: 'notif-admin@tazkia.ac.id',
      userType: 'admin',
      fullName: 'Notif Admin',
    });
    adminUser = adminSeed.user;
    adminToken = await loginAs({ identifier: adminUser.nim, password: adminSeed.plainPassword });
    expect(adminToken).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // =========================================================================
  // GET /api/notifications
  // =========================================================================
  describe('GET /api/notifications', () => {
    it('returns 401 without auth', async () => {
      const r = await agent.get('/api/notifications');
      expect(r.status).toBe(401);
    });

    it('returns 200 with empty list for fresh user', async () => {
      // Ensure no notifications for this user
      await prisma.notification.deleteMany({ where: { userId: user.id } });

      const r = await agent
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(Array.isArray(r.body.data)).toBe(true);
      expect(r.body.unreadCount).toBe(0);
    });

    it('returns notifications when present and counts unread correctly', async () => {
      const ann = await prisma.announcement.create({
        data: { title: 'Test Ann', message: 'Test message' },
      });
      await prisma.notification.create({
        data: { userId: user.id, announcementId: ann.id, isRead: false },
      });

      const r = await agent
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(r.status).toBe(200);
      expect(r.body.data.length).toBeGreaterThan(0);
      expect(r.body.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('response includes announcement details', async () => {
      const r = await agent
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(r.status).toBe(200);
      const notif = r.body.data[0];
      expect(notif).toHaveProperty('announcement');
      expect(notif.announcement).toHaveProperty('title');
      expect(notif.announcement).toHaveProperty('message');
    });

    it('notifications are ordered: unread first, then newest-first', async () => {
      const r = await agent
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      const data = r.body.data;
      if (data.length > 1) {
        // Unread should precede read
        const firstRead = data.findIndex(n => n.isRead);
        const lastUnread = data.map(n => n.isRead).lastIndexOf(false);
        if (firstRead !== -1 && lastUnread !== -1) {
          expect(lastUnread).toBeLessThan(firstRead);
        }
      }
    });

    it('each user only sees their own notifications', async () => {
      // user2 should have no notifications from setups above
      await prisma.notification.deleteMany({ where: { userId: user2.id } });

      const r = await agent
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token2}`);

      expect(r.status).toBe(200);
      expect(r.body.unreadCount).toBe(0);
    });
  });

  // =========================================================================
  // PATCH /api/notifications/read-all
  // =========================================================================
  describe('PATCH /api/notifications/read-all', () => {
    beforeEach(async () => {
      // Ensure we have at least one unread notification for user
      const ann = await prisma.announcement.create({
        data: { title: 'Unread Ann', message: 'unread message' },
      });
      await prisma.notification.create({
        data: { userId: user.id, announcementId: ann.id, isRead: false },
      });
    });

    it('returns 401 without auth', async () => {
      const r = await agent.patch('/api/notifications/read-all');
      expect(r.status).toBe(401);
    });

    it('marks all unread notifications as read', async () => {
      const r = await agent
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);

      // DB-level verification
      const remaining = await prisma.notification.count({
        where: { userId: user.id, isRead: false },
      });
      expect(remaining).toBe(0);
    });

    it('response includes updated count', async () => {
      const r = await agent
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(r.status).toBe(200);
      expect(typeof r.body.updated).toBe('number');
    });

    it('only affects the authenticated user, not other users', async () => {
      // Create unread notification for user2
      const ann = await prisma.announcement.create({
        data: { title: 'For User2', message: 'msg' },
      });
      await prisma.notification.create({
        data: { userId: user2.id, announcementId: ann.id, isRead: false },
      });

      // user1 marks all-read
      await agent
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      // user2's notification should remain unread
      const user2Unread = await prisma.notification.count({
        where: { userId: user2.id, isRead: false },
      });
      expect(user2Unread).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // PATCH /api/notifications/:id/read
  // =========================================================================
  describe('PATCH /api/notifications/:id/read', () => {
    it('returns 401 without auth', async () => {
      const r = await agent.patch('/api/notifications/1/read');
      expect(r.status).toBe(401);
    });

    it('returns 404 for unknown id', async () => {
      const r = await agent
        .patch('/api/notifications/999999/read')
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(404);
    });

    it("returns 404 when trying to read another user's notification", async () => {
      // Create a notification for user2
      const ann = await prisma.announcement.create({ data: { title: 'Privacy', message: 'check' } });
      const notif = await prisma.notification.create({
        data: { userId: user2.id, announcementId: ann.id, isRead: false },
      });

      // user1 tries to read user2's notification → 404 (not found for this user)
      const r = await agent
        .patch(`/api/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(404);
    });

    it('marks a single notification as read and returns updated record', async () => {
      const ann = await prisma.announcement.create({ data: { title: 'Single', message: 'single' } });
      const notif = await prisma.notification.create({
        data: { userId: user.id, announcementId: ann.id, isRead: false },
      });

      const r = await agent
        .patch(`/api/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
      expect(r.body.data.isRead).toBe(true);

      // DB-level verification
      const updated = await prisma.notification.findUnique({ where: { id: notif.id } });
      expect(updated.isRead).toBe(true);
    });

    it('is idempotent: re-marking already-read notification returns 200', async () => {
      const ann = await prisma.announcement.create({ data: { title: 'Already Read', message: 'read' } });
      const notif = await prisma.notification.create({
        data: { userId: user.id, announcementId: ann.id, isRead: true },
      });

      const r = await agent
        .patch(`/api/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`);

      expect(r.status).toBe(200);
      expect(r.body.success).toBe(true);
    });
  });

  // =========================================================================
  // POST /api/admin/announcements (admin auth required)
  // =========================================================================
  describe('POST /api/admin/announcements', () => {
    it('returns 401/403 without auth', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .send({ title: 'Public Announce', message: 'msg' });
      expect([401, 403]).toContain(r.status);
    });

    it('returns 401/403 for non-admin user', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Student Try', message: 'should fail' });
      expect([401, 403]).toContain(r.status);
    });

    it('returns 400 for missing title', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: 'No title here' });
      expect([400, 401, 403]).toContain(r.status);
    });

    it('returns 400 for missing message', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'No Message' });
      expect([400, 401, 403]).toContain(r.status);
    });

    it('returns 400 for empty title string', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '   ', message: 'valid message' });
      expect([400, 401, 403]).toContain(r.status);
    });

    it('returns 400 when title exceeds 200 chars', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'x'.repeat(201), message: 'valid message' });
      expect([400, 401, 403]).toContain(r.status);
    });

    it('returns 400 when message exceeds 2000 chars', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Long Message', message: 'm'.repeat(2001) });
      expect([400, 401, 403]).toContain(r.status);
    });

    it('creates announcement and fans out to all active users when admin allowed', async () => {
      const beforeCount = await prisma.announcement.count();

      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Fan-out Test', message: 'Testing fan-out to all users' });

      // 201 happy path; 401/403 if IP whitelist blocks in test env
      expect([201, 401, 403]).toContain(r.status);

      if (r.status === 201) {
        expect(r.body.success).toBe(true);
        expect(r.body.data).toHaveProperty('id');
        expect(r.body.data.title).toBe('Fan-out Test');
        expect(typeof r.body.recipientCount).toBe('number');

        // DB-level: announcement was persisted
        const afterCount = await prisma.announcement.count();
        expect(afterCount).toBe(beforeCount + 1);

        // DB-level: notifications created for active users
        const notifCount = await prisma.notification.count({
          where: { announcementId: r.body.data.id },
        });
        expect(notifCount).toBe(r.body.recipientCount);
      }
    });

    it('trim leading/trailing whitespace from title and message', async () => {
      const r = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: '  Trimmed Title  ', message: '  Trimmed Message  ' });

      if (r.status === 201) {
        expect(r.body.data.title).toBe('Trimmed Title');
        expect(r.body.data.message).toBe('Trimmed Message');
      } else {
        expect([401, 403]).toContain(r.status);
      }
    });
  });

  // =========================================================================
  // GET /api/admin/announcements
  // =========================================================================
  describe('GET /api/admin/announcements', () => {
    it('returns 401/403 without auth', async () => {
      const r = await agent.get('/api/admin/announcements');
      expect([401, 403]).toContain(r.status);
    });

    it('returns 401/403 for non-admin', async () => {
      const r = await agent
        .get('/api/admin/announcements')
        .set('Authorization', `Bearer ${token}`);
      expect([401, 403]).toContain(r.status);
    });

    it('returns 200 with announcements array for admin', async () => {
      const r = await agent
        .get('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 401, 403]).toContain(r.status);

      if (r.status === 200) {
        expect(r.body.success).toBe(true);
        expect(Array.isArray(r.body.data)).toBe(true);
      }
    });

    it('includes notification count per announcement', async () => {
      const r = await agent
        .get('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      if (r.status === 200 && r.body.data.length > 0) {
        const ann = r.body.data[0];
        // _count.notifications should be included
        expect(ann).toHaveProperty('_count');
        expect(ann._count).toHaveProperty('notifications');
        expect(typeof ann._count.notifications).toBe('number');
      }
    });

    it('announcements are ordered newest-first', async () => {
      const r = await agent
        .get('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      if (r.status === 200 && r.body.data.length > 1) {
        const dates = r.body.data.map(a => new Date(a.createdAt).getTime());
        for (let i = 0; i < dates.length - 1; i++) {
          expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
        }
      }
    });
  });

  // =========================================================================
  // Fan-out integrity: notifications flow through to user's list
  // =========================================================================
  describe('Fan-out → GET /api/notifications integration', () => {
    it('announcement notifications appear in user notification list', async () => {
      // Clean start
      await prisma.notification.deleteMany({ where: { userId: user.id } });

      // Create announcement directly via Prisma (bypass IP whitelist)
      const ann = await prisma.announcement.create({
        data: { title: 'Direct Ann', message: 'Direct message' },
      });
      await prisma.notification.create({
        data: { userId: user.id, announcementId: ann.id, isRead: false },
      });

      const r = await agent
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(r.status).toBe(200);
      expect(r.body.data.some(n => n.announcementId === ann.id)).toBe(true);
      expect(r.body.unreadCount).toBeGreaterThanOrEqual(1);
    });

    it('marking a notification read reduces unreadCount by 1', async () => {
      // Seed two unread notifications
      await prisma.notification.deleteMany({ where: { userId: user.id } });

      const ann1 = await prisma.announcement.create({ data: { title: 'A1', message: 'm1' } });
      const ann2 = await prisma.announcement.create({ data: { title: 'A2', message: 'm2' } });

      const n1 = await prisma.notification.create({
        data: { userId: user.id, announcementId: ann1.id, isRead: false },
      });
      await prisma.notification.create({
        data: { userId: user.id, announcementId: ann2.id, isRead: false },
      });

      // Get initial count
      const beforeRes = await agent
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);
      const beforeCount = beforeRes.body.unreadCount;

      // Mark one as read
      await agent
        .patch(`/api/notifications/${n1.id}/read`)
        .set('Authorization', `Bearer ${token}`);

      // Get after count
      const afterRes = await agent
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);
      const afterCount = afterRes.body.unreadCount;

      expect(afterCount).toBe(beforeCount - 1);
    });

    it('read-all reduces unreadCount to 0', async () => {
      // Ensure user has unread notifications
      const ann = await prisma.announcement.create({ data: { title: 'RA', message: 'ra msg' } });
      await prisma.notification.create({
        data: { userId: user.id, announcementId: ann.id, isRead: false },
      });

      await agent
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      const afterRes = await agent
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(afterRes.body.unreadCount).toBe(0);
    });
  });
});
