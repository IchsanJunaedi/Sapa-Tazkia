// backend/tests/integration/academic.test.js

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

// Mock OpenAI to avoid real API calls
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock AI analysis' } }],
        }),
      },
    },
  }));
});

const { agent } = require('../helpers/appHelper');
const {
  truncateAll,
  seedTestUser,
  seedAcademicSummary,
  seedAcademicGrades,
  disconnect,
} = require('../helpers/dbHelper');

describe('Academic Integration', () => {
  let token;

  beforeAll(async () => {
    await truncateAll();
    const { user, plainPassword } = await seedTestUser();
    await seedAcademicSummary(user.id);
    await seedAcademicGrades(user.id);

    const loginRes = await agent
      .post('/api/auth/login')
      .send({ identifier: user.nim, password: plainPassword });

    token = loginRes.body.token;
    expect(token).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  describe('GET /api/academic/summary', () => {
    it('returns 200 with academic summary for authenticated user', async () => {
      const res = await agent
        .get('/api/academic/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('ipk');
      expect(res.body.data).toHaveProperty('totalSks');
    });

    it('returns 401 without token', async () => {
      const res = await agent.get('/api/academic/summary');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/academic/grades', () => {
    it('returns 200 with grades array for authenticated user', async () => {
      const res = await agent
        .get('/api/academic/grades')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without token', async () => {
      const res = await agent.get('/api/academic/grades');
      expect(res.status).toBe(401);
    });
  });
});
