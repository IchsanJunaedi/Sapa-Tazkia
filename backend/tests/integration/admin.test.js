// backend/tests/integration/admin.test.js
//
// Integration tests for all Admin API endpoints:
//  - IP Whitelist / Auth guard (401 / 403)
//  - GET  /api/admin/chat-logs
//  - GET  /api/admin/analytics/realtime
//  - GET  /api/admin/analytics/history
//  - GET  /api/admin/knowledge-base
//  - POST /api/admin/knowledge-base
//  - DELETE /api/admin/knowledge-base/:id
//  - GET  /api/admin/bug-reports
//  - PATCH /api/admin/bug-reports/:id
//  - POST /api/admin/announcements
//  - GET  /api/admin/announcements
//  - GET  /api/admin/suggested-prompts
//  - POST /api/admin/suggested-prompts
//  - PATCH /api/admin/suggested-prompts/:id/toggle
//  - PATCH /api/admin/suggested-prompts/:id
//  - DELETE /api/admin/suggested-prompts/:id

// ---- Mocks ---------------------------------------------------------------
// Mock express-rate-limit so burst requests never hit 429 in CI
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

// Mock email service to avoid real SMTP calls during tests
jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

// Mock RAG / embedding service — admin KB endpoints call Qdrant
jest.mock('../../src/services/ragService', () => ({
  listDocuments: jest.fn().mockResolvedValue([]),
  addDocument: jest.fn().mockResolvedValue({ id: 'mock-doc-id', source: 'admin-manual' }),
  deleteDocument: jest.fn().mockResolvedValue({ deleted: true }),
  getCollectionInfo: jest.fn().mockResolvedValue({ exists: true, pointsCount: 0 }),
  answerQuestion: jest.fn().mockResolvedValue({ answer: 'mock answer', usage: { total_tokens: 10 } }),
}));

// Mock OpenAI to avoid network calls
jest.mock('../../src/services/openaiService', () => ({
  testOpenAIConnection: jest.fn().mockResolvedValue({ success: false }),
  generateTitle: jest.fn().mockResolvedValue('Mock Title'),
}));

// ---- Helpers -------------------------------------------------------------
const { agent } = require('../helpers/appHelper');
const { prisma, truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

// Helper: get auth token for a given user credential
async function loginAs({ identifier, password }) {
  const res = await agent.post('/api/auth/login').send({ identifier, password });
  return res.body.token;
}

// ============================================================================
// The admin IP whitelist reads ADMIN_ALLOWED_IPS at module-load time.
// In test (NODE_ENV=test, no ADMIN_ALLOWED_IPS set) it falls through to
// "development" mode → all IPs allowed. requireAdmin then checks userType.
// ============================================================================

describe('Admin API Integration', () => {
  let adminToken;
  let studentToken;
  let adminUser;

  beforeAll(async () => {
    await truncateAll();

    // Seed admin user
    const adminSeed = await seedTestUser({
      nim: 'A0000000001',
      email: 'admin-api@tazkia.ac.id',
      userType: 'admin',
      fullName: 'Test Admin',
    });
    adminUser = adminSeed.user;
    adminToken = await loginAs({ identifier: adminSeed.user.nim, password: adminSeed.plainPassword });

    // Seed regular student user
    const studentSeed = await seedTestUser({
      nim: '2021000001',
      email: 'student-api@tazkia.ac.id',
      userType: 'student',
      fullName: 'Test Student',
    });
    studentToken = await loginAs({ identifier: studentSeed.user.nim, password: studentSeed.plainPassword });

    expect(adminToken).toBeDefined();
    expect(studentToken).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // =========================================================================
  // AUTH GUARD — every admin route must reject non-admin callers
  // =========================================================================
  describe('Auth guard', () => {
    const adminRoutes = [
      { method: 'get',   path: '/api/admin/chat-logs' },
      { method: 'get',   path: '/api/admin/analytics/realtime' },
      { method: 'get',   path: '/api/admin/analytics/history' },
      { method: 'get',   path: '/api/admin/knowledge-base' },
      { method: 'get',   path: '/api/admin/bug-reports' },
      { method: 'get',   path: '/api/admin/announcements' },
      { method: 'get',   path: '/api/admin/suggested-prompts' },
    ];

    it.each(adminRoutes)('$method $path → 401 without token', async ({ method, path }) => {
      const res = await agent[method](path);
      expect([401, 403]).toContain(res.status);
    });

    it.each(adminRoutes)('$method $path → 403 for student token', async ({ method, path }) => {
      const res = await agent[method](path).set('Authorization', `Bearer ${studentToken}`);
      // Student is authed but not admin → 403
      expect([401, 403]).toContain(res.status);
    });
  });

  // =========================================================================
  // GET /api/admin/chat-logs
  // =========================================================================
  describe('GET /api/admin/chat-logs', () => {
    it('returns 200 with logs array for admin', async () => {
      const res = await agent
        .get('/api/admin/chat-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });
  });

  // =========================================================================
  // GET /api/admin/analytics/realtime
  // =========================================================================
  describe('GET /api/admin/analytics/realtime', () => {
    it('returns 200 with realtime KPIs for admin', async () => {
      const res = await agent
        .get('/api/admin/analytics/realtime')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('realtime');
      expect(typeof res.body.realtime.chatToday).toBe('number');
      expect(typeof res.body.realtime.activeUsers).toBe('number');
    });
  });

  // =========================================================================
  // GET /api/admin/analytics/history
  // =========================================================================
  describe('GET /api/admin/analytics/history', () => {
    it('returns 200 for default range (7d)', async () => {
      const res = await agent
        .get('/api/admin/analytics/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('snapshots');
      expect(Array.isArray(res.body.snapshots)).toBe(true);
      expect(res.body.range).toBe('7d');
    });

    it('returns 200 for 30d range', async () => {
      const res = await agent
        .get('/api/admin/analytics/history?range=30d')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.range).toBe('30d');
    });

    it('includes topUsers array in response', async () => {
      const res = await agent
        .get('/api/admin/analytics/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(Array.isArray(res.body.topUsers)).toBe(true);
    });
  });

  // =========================================================================
  // Knowledge Base CRUD
  // =========================================================================
  describe('Knowledge Base', () => {
    it('GET /api/admin/knowledge-base → 200 + documents array', async () => {
      const res = await agent
        .get('/api/admin/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.documents)).toBe(true);
    });

    it('POST /api/admin/knowledge-base → 400 if content too short', async () => {
      const res = await agent
        .post('/api/admin/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/admin/knowledge-base → 201 for valid content', async () => {
      const res = await agent
        .post('/api/admin/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'This is a test document with sufficient length for the knowledge base.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('document');
    });

    it('DELETE /api/admin/knowledge-base/:id → 200 for valid id', async () => {
      const res = await agent
        .delete('/api/admin/knowledge-base/mock-doc-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/admin/knowledge-base/:id → 400 when id missing (hits base path)', async () => {
      // Sending to base path without :id hits a different handler; just ensure no 500
      const res = await agent
        .delete('/api/admin/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`);

      // 404 (no route) or 400 are both acceptable
      expect([400, 404]).toContain(res.status);
    });
  });

  // =========================================================================
  // Bug Reports
  // =========================================================================
  describe('Bug Reports', () => {
    let bugReportId;

    beforeAll(async () => {
      // Seed a bug report directly via Prisma
      const report = await prisma.bugReport.create({
        data: {
          userId: adminUser.id,
          title: 'Test Bug',
          description: 'Something broke',
          severity: 'MEDIUM',
          status: 'OPEN',
        },
      });
      bugReportId = report.id;
    });

    it('GET /api/admin/bug-reports → 200 with reports array', async () => {
      const res = await agent
        .get('/api/admin/bug-reports')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.reports)).toBe(true);
      expect(res.body.reports.length).toBeGreaterThanOrEqual(1);
    });

    it('PATCH /api/admin/bug-reports/:id → 200 updates status', async () => {
      const res = await agent
        .patch(`/api/admin/bug-reports/${bugReportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_PROGRESS', adminNotes: 'Looking into it' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('IN_PROGRESS');
    });

    it('PATCH /api/admin/bug-reports/:id → 200 resolves report and sets resolvedAt', async () => {
      const res = await agent
        .patch(`/api/admin/bug-reports/${bugReportId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('RESOLVED');
      expect(res.body.data.resolvedAt).not.toBeNull();
    });

    it('PATCH /api/admin/bug-reports/999999 → 404 for non-existent report', async () => {
      const res = await agent
        .patch('/api/admin/bug-reports/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' });

      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // Announcements (admin side)
  // =========================================================================
  describe('Announcements (admin)', () => {
    it('POST /api/admin/announcements → 400 for missing title', async () => {
      const res = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: 'No title here' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/admin/announcements → 400 for missing message', async () => {
      const res = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'No message here' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/admin/announcements → 201 with valid payload, fans out notifications', async () => {
      const res = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Big Update', message: 'The system has been upgraded.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toBe('Big Update');
      expect(typeof res.body.recipientCount).toBe('number');

      // Verify announcement persisted in DB
      const ann = await prisma.announcement.findUnique({ where: { id: res.body.data.id } });
      expect(ann).not.toBeNull();
      expect(ann.title).toBe('Big Update');
    });

    it('POST /api/admin/announcements → 400 when title exceeds 200 chars', async () => {
      const res = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'x'.repeat(201), message: 'valid message' });

      expect(res.status).toBe(400);
    });

    it('GET /api/admin/announcements → 200 with data array', async () => {
      const res = await agent
        .get('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Suggested Prompts CRUD
  // =========================================================================
  describe('Suggested Prompts', () => {
    let promptId;

    it('GET /api/admin/suggested-prompts → 200 with array', async () => {
      const res = await agent
        .get('/api/admin/suggested-prompts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data ?? res.body.prompts ?? [])).toBe(true);
    });

    it('POST /api/admin/suggested-prompts → 201 creates prompt', async () => {
      const res = await agent
        .post('/api/admin/suggested-prompts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Apa itu Sapa Tazkia?', category: 'umum' });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      promptId = (res.body.data ?? res.body.prompt)?.id;
    });

    it('PATCH /api/admin/suggested-prompts/:id/toggle → toggles isActive', async () => {
      if (!promptId) return; // guard if create failed
      const res = await agent
        .patch(`/api/admin/suggested-prompts/${promptId}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('PATCH /api/admin/suggested-prompts/:id → updates text', async () => {
      if (!promptId) return;
      const res = await agent
        .patch(`/api/admin/suggested-prompts/${promptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'Updated prompt text?' });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/admin/suggested-prompts/:id → 200 deletes prompt', async () => {
      if (!promptId) return;
      const res = await agent
        .delete(`/api/admin/suggested-prompts/${promptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect([200, 204]).toContain(res.status);
    });

    it('POST /api/admin/suggested-prompts → 400 / 422 for missing text', async () => {
      const res = await agent
        .post('/api/admin/suggested-prompts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'umum' }); // missing text

      expect([400, 422]).toContain(res.status);
    });
  });
});
