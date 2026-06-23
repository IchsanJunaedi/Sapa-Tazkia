// backend/tests/integration/admin.test.js
//
// Integration tests for admin controller + admin routes:
// - Access Control: Admin vs Student vs Unauthenticated
// - Chat Logs: GET /api/admin/chat-logs
// - Analytics: GET /api/admin/analytics/realtime, GET /api/admin/analytics/history
// - Knowledge Base: GET /api/admin/knowledge-base, POST /api/admin/knowledge-base, DELETE /api/admin/knowledge-base/:id
// - PDF Ingestion: POST /api/admin/knowledge-base/upload-pdf
// - Bug Reports: GET /api/admin/bug-reports, PATCH /api/admin/bug-reports/:id
// - Announcements: POST /api/admin/announcements, GET /api/admin/announcements
// - Suggested Prompts: GET, POST, PATCH, DELETE /api/admin/suggested-prompts

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/ragService', () => ({
  listDocuments: jest.fn().mockResolvedValue([
    { id: 'doc-1', payload: { content: 'mock doc 1', source: 'admin-manual' } }
  ]),
  addDocument: jest.fn().mockResolvedValue({ id: 'doc-new', content: 'new content' }),
  deleteDocument: jest.fn().mockResolvedValue({ success: true, message: 'Document deleted' }),
  getCollectionInfo: jest.fn().mockResolvedValue({ exists: true, pointsCount: 1 }),
}));

const { agent } = require('../helpers/appHelper');
const { prisma, truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

describe('Admin API Integration', () => {
  let adminUser;
  let adminToken;
  let studentUser;
  let studentToken;

  beforeAll(async () => {
    await truncateAll();

    // Seed Admin
    const seededAdmin = await seedTestUser({
      nim: 'A0000000001',
      email: 'admin-test@tazkia.ac.id',
      userType: 'admin',
      fullName: 'Super Admin',
    });
    adminUser = seededAdmin.user;
    const adminLoginRes = await agent.post('/api/auth/login').send({
      identifier: adminUser.nim, password: seededAdmin.plainPassword,
    });
    adminToken = adminLoginRes.body.token;

    // Seed Student
    const seededStudent = await seedTestUser({
      nim: 'S0000000001',
      email: 'student-test@student.tazkia.ac.id',
      userType: 'student',
      fullName: 'John Student',
    });
    studentUser = seededStudent.user;
    const studentLoginRes = await agent.post('/api/auth/login').send({
      identifier: studentUser.nim, password: seededStudent.plainPassword,
    });
    studentToken = studentLoginRes.body.token;
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  describe('Access Control', () => {
    it('returns 401 without auth token', async () => {
      const res = await agent.get('/api/admin/chat-logs');
      expect(res.status).toBe(401);
    });

    it('returns 403 for student token', async () => {
      const res = await agent.get('/api/admin/chat-logs').set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 for admin token', async () => {
      const res = await agent.get('/api/admin/chat-logs').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/admin/chat-logs', () => {
    it('returns unified chat logs', async () => {
      const res = await agent.get('/api/admin/chat-logs').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });
  });

  describe('GET /api/admin/analytics/realtime', () => {
    it('returns realtime analytics snapshot', async () => {
      const res = await agent.get('/api/admin/analytics/realtime').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.realtime).toBeDefined();
    });
  });

  describe('GET /api/admin/analytics/history', () => {
    it('returns analytics history', async () => {
      const res = await agent.get('/api/admin/analytics/history?range=7d').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.snapshots)).toBe(true);
    });
  });

  describe('Knowledge Base API', () => {
    it('lists knowledge base documents', async () => {
      const res = await agent.get('/api/admin/knowledge-base').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.documents)).toBe(true);
    });

    it('adds a knowledge document', async () => {
      const res = await agent
        .post('/api/admin/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'This is a test knowledge document content containing more than ten characters.',
          source: 'manual-test',
          category: 'testing'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.document).toBeDefined();
    });

    it('returns 400 when content is too short', async () => {
      const res = await agent
        .post('/api/admin/knowledge-base')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ content: 'short' });
      expect(res.status).toBe(400);
    });

    it('deletes a knowledge document', async () => {
      const res = await agent
        .delete('/api/admin/knowledge-base/doc-1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/admin/knowledge-base/upload-pdf', () => {
    it('returns 400 when no file is uploaded', async () => {
      const res = await agent
        .post('/api/admin/knowledge-base/upload-pdf')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('rejects non-PDF files', async () => {
      const res = await agent
        .post('/api/admin/knowledge-base/upload-pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('hello world'), 'test.txt');
      expect(res.status).toBe(400);
    });

    it('rejects PDF file with invalid signature', async () => {
      const res = await agent
        .post('/api/admin/knowledge-base/upload-pdf')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('not-a-pdf-signature-here'), 'test.pdf');
      expect(res.status).toBe(422);
    });
  });

  describe('Bug Reports API', () => {
    let report;

    beforeEach(async () => {
      report = await prisma.bugReport.create({
        data: {
          title: 'UI bug',
          description: 'Login button overlapping',
          userId: studentUser.id,
          severity: 'MEDIUM',
          status: 'OPEN',
        }
      });
    });

    it('lists bug reports', async () => {
      const res = await agent.get('/api/admin/bug-reports').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.reports)).toBe(true);
    });

    it('updates a bug report status', async () => {
      const res = await agent
        .patch(`/api/admin/bug-reports/${report.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED', adminNotes: 'fixed' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('RESOLVED');
    });

    it('returns 404 for unknown bug report ID', async () => {
      const res = await agent
        .patch('/api/admin/bug-reports/999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED' });
      expect(res.status).toBe(404);
    });
  });

  describe('Announcements API', () => {
    it('creates announcement and fans out to users', async () => {
      const res = await agent
        .post('/api/admin/announcements')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'New System Update', message: 'Announcing version 4.2.0!' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('lists announcements', async () => {
      const res = await agent.get('/api/admin/announcements').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Suggested Prompts CRUD', () => {
    let prompt;

    beforeEach(async () => {
      prompt = await prisma.suggestedPrompt.create({
        data: { text: 'How do I pay tuition?', category: 'finance', order: 1 }
      });
    });

    it('gets suggested prompts list', async () => {
      const res = await agent.get('/api/admin/suggested-prompts').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('creates a suggested prompt', async () => {
      const res = await agent
        .post('/api/admin/suggested-prompts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'What is SIAKAD?', category: 'general', order: 2 });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('toggles a suggested prompt status', async () => {
      const res = await agent
        .patch(`/api/admin/suggested-prompts/${prompt.id}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isActive).toBe(false);
    });

    it('updates a suggested prompt text/details', async () => {
      const res = await agent
        .patch(`/api/admin/suggested-prompts/${prompt.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ text: 'How do I pay tuition online?' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.text).toBe('How do I pay tuition online?');
    });

    it('deletes a suggested prompt', async () => {
      const res = await agent
        .delete(`/api/admin/suggested-prompts/${prompt.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
