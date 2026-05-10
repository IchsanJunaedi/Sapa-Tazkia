// backend/tests/unit/academicController.test.js
const {
  getAcademicSummary,
  getGrades,
  getTranscript,
  analyzePerformance,
} = require('../../src/controllers/academicController');

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: { findUnique: jest.fn() },
    academicGrade: { findMany: jest.fn() },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

// Mock openaiService
jest.mock('../../src/services/openaiService', () => ({
  generateAIResponse: jest.fn(),
}));

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const openaiService = require('../../src/services/openaiService');

function buildReqRes(userId = 1, query = {}) {
  const req = { user: { id: userId }, query };
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
  return { req, res };
}

// ─── getAcademicSummary ──────────────────────────────────────────────────────

describe('academicController.getAcademicSummary', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with summary data when user exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      nim: '123',
      fullName: 'Test User',
      programStudi: { name: 'Informatika', faculty: 'Sains' },
      academicSummary: { totalSks: 120, ipk: 3.5, semesterActive: 6 },
      status: 'active',
    });

    const { req, res } = buildReqRes();
    await getAcademicSummary(req, res);

    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.data.nim).toBe('123');
    expect(res._body.data.ipk).toBe(3.5);
  });

  it('returns 404 when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const { req, res } = buildReqRes();
    await getAcademicSummary(req, res);

    expect(res._status).toBe(404);
    expect(res._body.success).toBe(false);
  });

  it('returns 500 on database error', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('DB down'));

    const { req, res } = buildReqRes();
    await getAcademicSummary(req, res);

    expect(res._status).toBe(500);
    expect(res._body.success).toBe(false);
  });

  it('handles missing programStudi gracefully', async () => {
    prisma.user.findUnique.mockResolvedValue({
      nim: '123',
      fullName: 'Test',
      programStudi: null,
      academicSummary: { totalSks: 0, ipk: 0, semesterActive: 1 },
    });

    const { req, res } = buildReqRes();
    await getAcademicSummary(req, res);

    expect(res._status).toBe(200);
    expect(res._body.data.programStudi).toBe('-');
  });
});

// ─── getGrades ───────────────────────────────────────────────────────────────

describe('academicController.getGrades', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with formatted grades', async () => {
    prisma.academicGrade.findMany.mockResolvedValue([
      {
        id: 1,
        semester: '1',
        grade: 'A',
        gradePoint: '4.00',
        course: { code: 'CS101', name: 'Intro CS', sks: 3 },
      },
    ]);

    const { req, res } = buildReqRes(1, {});
    await getGrades(req, res);

    expect(res._status).toBe(200);
    expect(res._body.success).toBe(true);
    expect(res._body.data).toHaveLength(1);
    expect(res._body.data[0].courseName).toBe('Intro CS');
    expect(res._body.data[0].gradePoint).toBe(4.0);
  });

  it('filters by semester when provided', async () => {
    prisma.academicGrade.findMany.mockResolvedValue([]);

    const { req, res } = buildReqRes(1, { semester: '2' });
    await getGrades(req, res);

    expect(prisma.academicGrade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1, semester: '2' },
      })
    );
  });

  it('returns 500 on error', async () => {
    prisma.academicGrade.findMany.mockRejectedValue(new Error('fail'));

    const { req, res } = buildReqRes();
    await getGrades(req, res);

    expect(res._status).toBe(500);
  });
});

// ─── getTranscript ───────────────────────────────────────────────────────────

describe('academicController.getTranscript', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with summary + grades', async () => {
    prisma.user.findUnique.mockResolvedValue({
      nim: '123',
      fullName: 'Test',
      programStudi: { name: 'Akuntansi' },
      academicSummary: { totalSks: 60, ipk: 3.2 },
      status: 'active',
    });
    prisma.academicGrade.findMany.mockResolvedValue([
      {
        semester: '1',
        grade: 'B+',
        gradePoint: '3.50',
        course: { code: 'ACC101', name: 'Akuntansi Dasar', sks: 3 },
      },
    ]);

    const { req, res } = buildReqRes();
    await getTranscript(req, res);

    expect(res._status).toBe(200);
    expect(res._body.data.summary.nim).toBe('123');
    expect(Array.isArray(res._body.data.grades)).toBe(true);
  });

  it('returns 404 when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.academicGrade.findMany.mockResolvedValue([]);

    const { req, res } = buildReqRes();
    await getTranscript(req, res);

    expect(res._status).toBe(404);
  });

  it('returns 500 on error', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('fail'));

    const { req, res } = buildReqRes();
    await getTranscript(req, res);

    expect(res._status).toBe(500);
  });
});

// ─── analyzePerformance ──────────────────────────────────────────────────────

describe('academicController.analyzePerformance', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns 200 with AI analysis', async () => {
    prisma.user.findUnique.mockResolvedValue({
      fullName: 'Test',
      programStudi: { name: 'Informatika' },
      academicSummary: { ipk: 3.8 },
    });
    prisma.academicGrade.findMany.mockResolvedValue([
      { grade: 'A', gradePoint: '4.00', course: { name: 'Algo', code: 'CS1', sks: 3 } },
    ]);
    openaiService.generateAIResponse.mockResolvedValue('Performa sangat baik.');

    const { req, res } = buildReqRes();
    await analyzePerformance(req, res);

    expect(res._status).toBe(200);
    expect(res._body.data.analysis).toBe('Performa sangat baik.');
  });

  it('returns 400 when no grades available', async () => {
    prisma.user.findUnique.mockResolvedValue({
      fullName: 'Test',
      programStudi: null,
      academicSummary: null,
    });
    prisma.academicGrade.findMany.mockResolvedValue([]);

    const { req, res } = buildReqRes();
    await analyzePerformance(req, res);

    expect(res._status).toBe(400);
  });

  it('returns 500 when AI service fails', async () => {
    prisma.user.findUnique.mockResolvedValue({
      fullName: 'Test',
      programStudi: { name: 'X' },
      academicSummary: { ipk: 3.0 },
    });
    prisma.academicGrade.findMany.mockResolvedValue([
      { grade: 'B', gradePoint: '3.00', course: { name: 'Y', code: 'Y1', sks: 2 } },
    ]);
    openaiService.generateAIResponse.mockRejectedValue(new Error('AI timeout'));

    const { req, res } = buildReqRes();
    await analyzePerformance(req, res);

    expect(res._status).toBe(500);
  });
});
