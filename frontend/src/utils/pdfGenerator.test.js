// Mock jspdf and jspdf-autotable so the generator can run end-to-end without
// touching the real implementations. Use mock_ prefix to satisfy babel-jest hoisting.

jest.mock('jspdf', () => {
  const inst = {
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    setFont: jest.fn(),
    setLineWidth: jest.fn(),
    setDrawColor: jest.fn(),
    line: jest.fn(),
    text: jest.fn(),
    save: jest.fn(),
    addPage: jest.fn(),
    lastAutoTable: { finalY: 100 },
  };
  function Ctor() {
    return inst;
  }
  Ctor.__instance = inst;
  return { __esModule: true, default: Ctor };
});

jest.mock('jspdf-autotable', () => ({ __esModule: true, default: jest.fn() }));

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateTranscriptPDF } from './pdfGenerator';

beforeEach(() => {
  jest.clearAllMocks();
  jsPDF.__instance.lastAutoTable = { finalY: 100 };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('utils/pdfGenerator', () => {
  it('returns false when data is missing', () => {
    expect(generateTranscriptPDF(null)).toBe(false);
    expect(generateTranscriptPDF({})).toBe(false);
    expect(generateTranscriptPDF({ summary: {} })).toBe(false);
  });

  it('generates PDF for grades passed as array', () => {
    const data = {
      summary: { fullName: 'Alice', nim: '123', programStudi: 'TI', totalSks: 144, ipk: 3.8, status: 'Aktif' },
      grades: [
        { courseCode: 'TI001', courseName: 'Algoritma', sks: 3, grade: 'A', gradePoint: 4.0, semester: 1 },
        { courseCode: 'TI002', courseName: 'Basis Data', sks: 3, grade: 'B', gradePoint: 3.0, semester: 1 },
      ],
    };
    expect(generateTranscriptPDF(data)).toBe(true);
    expect(autoTable).toHaveBeenCalled();
    expect(jsPDF.__instance.save).toHaveBeenCalledWith('Transkrip_123.pdf');
  });

  it('generates PDF for grades passed as object grouped by semester', () => {
    const data = {
      summary: { fullName: 'Bob', nim: '456' },
      grades: {
        '1': [{ courseCode: 'TI001', courseName: 'Algoritma', sks: 3, grade: 'A', gradePoint: 4.0 }],
        '2': [{ courseCode: 'TI002', courseName: 'Basis Data', sks: 3, grade: 'B', gradePoint: 3.0 }],
      },
    };
    expect(generateTranscriptPDF(data)).toBe(true);
    expect(autoTable).toHaveBeenCalled();
    expect(jsPDF.__instance.save).toHaveBeenCalledWith('Transkrip_456.pdf');
  });

  it('handles ipk as string', () => {
    const data = {
      summary: { fullName: 'Carol', nim: '789', ipk: '3.50' },
      grades: [],
    };
    expect(generateTranscriptPDF(data)).toBe(true);
  });

  it('uses code fallback when courseCode is absent and string gradePoint', () => {
    const data = {
      summary: { fullName: 'Dan', nim: '999' },
      grades: [{ code: 'X1', courseName: 'Z', sks: 2, grade: 'A', gradePoint: 'A' }],
    };
    expect(generateTranscriptPDF(data)).toBe(true);
  });

  it('paginates when finalY exceeds 250', () => {
    jsPDF.__instance.lastAutoTable = { finalY: 240 };
    const data = {
      summary: { fullName: 'Ed', nim: '111' },
      grades: [],
    };
    expect(generateTranscriptPDF(data)).toBe(true);
    expect(jsPDF.__instance.addPage).toHaveBeenCalled();
  });
});
