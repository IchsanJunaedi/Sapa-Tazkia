// backend/tests/integration/academic-extended.test.js
//
// Extended coverage for academicController + academicService:
// - GET /api/academic/transcript (success, no user, missing data)
// - POST /api/academic/analyze   (success with mocked OpenAI, no data)
// - Service-level: validateStudent, getAcademicSummary, getGradesBySemester,
//   getTranscript, getStudyRecommendations, normalizeName.

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock AI analysis content' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      },
    },
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.01) }],
      }),
    },
  }));
});

const { agent } = require('../helpers/appHelper');
const {
  prisma,
  truncateAll,
  seedTestUser,
  seedAcademicSummary,
  seedAcademicGrades,
  disconnect,
} = require('../helpers/dbHelper');

const academicService = require('../../src/services/academicService');

describe('Academic — Extended', () => {
  let token;
  let testUser;

  beforeAll(async () => {
    await truncateAll();
    const seeded = await seedTestUser();
    testUser = seeded.user;
    await seedAcademicSummary(testUser.id);
    await seedAcademicGrades(testUser.id);

    const loginRes = await agent
      .post('/api/auth/login')
      .send({ identifier: testUser.nim, password: seeded.plainPassword });
    token = loginRes.body.token;
    expect(token).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  describe('GET /api/academic/transcript', () => {
    it('returns 200 with summary + grades array', async () => {
      const res = await agent
        .get('/api/academic/transcript')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(Array.isArray(res.body.data.grades)).toBe(true);
    });

    it('returns 401 without token', async () => {
      const res = await agent.get('/api/academic/transcript');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/academic/grades — with ?semester filter', () => {
    it('returns 200 filtered by semester=1', async () => {
      const res = await agent
        .get('/api/academic/grades?semester=1')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 200 with empty array for non-existing semester', async () => {
      const res = await agent
        .get('/api/academic/grades?semester=99')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('POST /api/academic/analyze', () => {
    it('returns 200 with analysis when grades exist (mocked OpenAI)', async () => {
      const res = await agent
        .post('/api/academic/analyze')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('analysis');
    });

    it('returns 401 without token', async () => {
      const res = await agent.post('/api/academic/analyze');
      expect(res.status).toBe(401);
    });

    it('returns 400 when user has no grades', async () => {
      const otherUser = await seedTestUser({
        nim: '2021004444',
        email: 'no-grades@student.tazkia.ac.id',
        fullName: 'No Grades Student',
      });

      const otherLogin = await agent
        .post('/api/auth/login')
        .send({ identifier: otherUser.user.nim, password: otherUser.plainPassword });

      const res = await agent
        .post('/api/academic/analyze')
        .set('Authorization', `Bearer ${otherLogin.body.token}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      await prisma.session.deleteMany({ where: { userId: otherUser.user.id } });
      await prisma.user.delete({ where: { id: otherUser.user.id } });
    });
  });
});

describe('AcademicService — Unit', () => {
  let user;

  beforeAll(async () => {
    await truncateAll();
    const seeded = await seedTestUser({
      fullName: 'Asep Sunandar',
      nim: '2021005555',
      email: 'asep@student.tazkia.ac.id',
    });
    user = seeded.user;
    await seedAcademicSummary(user.id);
    await seedAcademicGrades(user.id);
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  it('normalizeName lowercases and collapses whitespace', () => {
    expect(academicService.normalizeName('  Asep   Sunandar  ')).toBe('asep sunandar');
    expect(academicService.normalizeName('ASEP\tSUNANDAR')).toBe('asep sunandar');
  });

  it('validateStudent returns success=true when NIM + name match', async () => {
    const r = await academicService.validateStudent(user.nim, user.fullName, '2000-01-01');
    expect(r.success).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.data.userId).toBe(user.id);
  });

  it('validateStudent returns success=false when name mismatches', async () => {
    const r = await academicService.validateStudent(user.nim, 'Wrong Name', '2000-01-01');
    expect(r.success).toBe(false);
    expect(r.valid).toBe(false);
  });

  it('validateStudent returns success=false when NIM not found', async () => {
    const r = await academicService.validateStudent('0000000000', user.fullName, '2000-01-01');
    expect(r.success).toBe(false);
    expect(r.valid).toBe(false);
  });

  it('getAcademicSummary returns success with IPK data for seeded user', async () => {
    const r = await academicService.getAcademicSummary(user.id);
    expect(r.success).toBe(true);
    expect(r.data).toHaveProperty('ipk');
    expect(r.data.nim).toBe(user.nim);
  });

  it('getAcademicSummary returns success=false for unknown userId', async () => {
    const r = await academicService.getAcademicSummary(999999);
    expect(r.success).toBe(false);
  });

  it('getGradesBySemester returns grouped data when grades exist', async () => {
    const r = await academicService.getGradesBySemester(user.id);
    expect(r.success).toBe(true);
    expect(typeof r.data).toBe('object');
  });

  it('getGradesBySemester accepts semester filter', async () => {
    const r = await academicService.getGradesBySemester(user.id, 1);
    expect(r.success).toBe(true);
  });

  it('getGradesBySemester returns success=false when user has no grades', async () => {
    const noGradesSeed = await seedTestUser({
      fullName: 'No Grades',
      nim: '2021006666',
      email: 'no@student.tazkia.ac.id',
    });
    const r = await academicService.getGradesBySemester(noGradesSeed.user.id);
    expect(r.success).toBe(false);
  });

  it('getTranscript composes summary + grades on success', async () => {
    const r = await academicService.getTranscript(user.id);
    expect(r.success).toBe(true);
    expect(r.data).toHaveProperty('summary');
    expect(r.data).toHaveProperty('grades');
  });

  it('getTranscript propagates summary failure', async () => {
    const r = await academicService.getTranscript(999998);
    expect(r.success).toBe(false);
  });

  it('analyzeAcademicPerformance returns success with mocked AI response', async () => {
    const r = await academicService.analyzeAcademicPerformance(user.id);
    expect(r.success).toBe(true);
    expect(r.data).toHaveProperty('analysis');
  });

  it('analyzeAcademicPerformance returns success=false when transcript missing', async () => {
    const r = await academicService.analyzeAcademicPerformance(999997);
    expect(r.success).toBe(false);
  });

  it('getStudyRecommendations returns success with mocked AI', async () => {
    const r = await academicService.getStudyRecommendations(user.id);
    expect(r.success).toBe(true);
    expect(r.data).toHaveProperty('recommendations');
  });

  it('getStudyRecommendations returns success=false when transcript missing', async () => {
    const r = await academicService.getStudyRecommendations(999996);
    expect(r.success).toBe(false);
  });
});
