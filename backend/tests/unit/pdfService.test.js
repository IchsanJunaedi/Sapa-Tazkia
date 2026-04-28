// backend/tests/unit/pdfService.test.js
//
// Unit tests for pdfService.generateTranscriptPDF — mocks academicService.getTranscript
// and inspects the returned PDFKit doc for structure.

jest.mock('../../src/services/academicService', () => ({
  getTranscript: jest.fn(),
}));

const academicService = require('../../src/services/academicService');
const { generateTranscriptPDF } = require('../../src/services/pdfService');

beforeEach(() => {
  academicService.getTranscript.mockReset();
});

describe('pdfService.generateTranscriptPDF', () => {
  it('returns failure when getTranscript fails', async () => {
    academicService.getTranscript.mockResolvedValueOnce({ success: false, message: 'no data' });
    const r = await generateTranscriptPDF(123);
    expect(r.success).toBe(false);
    expect(r.message).toBe('no data');
  });

  it('returns success + PDFDocument + filename when transcript present', async () => {
    academicService.getTranscript.mockResolvedValueOnce({
      success: true,
      data: {
        summary: {
          nim: '2021000001',
          fullName: 'Test Student',
          programStudi: 'Akuntansi Syariah',
          angkatan: 2021,
          ipk: 3.45,
          totalSks: 60,
          semesterActive: 5,
        },
        grades: {
          1: [
            {
              courseCode: 'AKU101',
              courseName: 'Pengantar Akuntansi',
              sks: 3,
              grade: 'A',
              gradePoint: 4.0,
            },
            {
              courseCode: 'AKU102',
              courseName: 'Akuntansi Dasar 2',
              sks: 3,
              grade: 'B',
              gradePoint: 3.0,
            },
          ],
        },
      },
    });

    const r = await generateTranscriptPDF(1);
    expect(r.success).toBe(true);
    expect(r.filename).toMatch(/^Transkrip_2021000001_\d+\.pdf$/);
    expect(r.doc).toBeDefined();
    expect(typeof r.doc.pipe).toBe('function');
    // Drain the doc so the test doesn't leak streams
    r.doc.end();
  });

  it('returns failure when getTranscript throws', async () => {
    academicService.getTranscript.mockRejectedValueOnce(new Error('boom'));
    const r = await generateTranscriptPDF(1);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/boom|Gagal/);
  });

  it('handles multiple semesters', async () => {
    academicService.getTranscript.mockResolvedValueOnce({
      success: true,
      data: {
        summary: { nim: '1', fullName: 'X', programStudi: 'Y', angkatan: 2020, ipk: 3.0, totalSks: 30, semesterActive: 3 },
        grades: {
          1: [{ courseCode: 'A', courseName: 'A1', sks: 3, grade: 'A', gradePoint: 4.0 }],
          2: [{ courseCode: 'B', courseName: 'B1', sks: 3, grade: 'B', gradePoint: 3.0 }],
        },
      },
    });
    const r = await generateTranscriptPDF(1);
    expect(r.success).toBe(true);
    r.doc.end();
  });
});
