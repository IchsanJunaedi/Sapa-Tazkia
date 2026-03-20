// backend/tests/unit/pdfIngestion.test.js
// Mocks must be declared before any require() — Jest hoists jest.mock() to top of file

jest.mock('../../src/services/ragService', () => ({
  addDocument: jest.fn().mockResolvedValue({ id: 'mock-id' })
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(),
  security: jest.fn(), debug: jest.fn(), redis: jest.fn(), rateLimit: jest.fn()
}));

jest.mock('pdf-parse', () => jest.fn());

// Load modules AFTER mocks are declared
const pdfParse = require('pdf-parse');
const ragService = require('../../src/services/ragService');
const { uploadPdfDoc } = require('../../src/controllers/adminController');

const makeRes = () => {
  const res = { json: jest.fn(), status: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe('uploadPdfDoc', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if no file is uploaded', async () => {
    const req = { file: null, body: {} };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('No file') })
    );
  });

  it('should return 400 if file mimetype is not application/pdf', async () => {
    const req = {
      file: { originalname: 'hack.jpg', mimetype: 'image/jpeg', buffer: Buffer.from('JFIF') },
      body: {}
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('PDF') })
    );
  });

  it('should return 400 if magic bytes check fails (spoofed PDF mimetype)', async () => {
    const req = {
      file: {
        originalname: 'fake.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('NOTAPDF content here')
      },
      body: {}
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('should return 400 if PDF has no extractable text (scanned/image PDF)', async () => {
    pdfParse.mockResolvedValue({ text: '' });
    const req = {
      file: {
        originalname: 'scanned.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 fake content')
      },
      body: {}
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('No text') })
    );
  });

  it('should embed chunks and return 201 with success fields', async () => {
    const longText = 'This is an academic sentence with enough content. '.repeat(100); // ~5000 chars
    pdfParse.mockResolvedValue({ text: longText });
    const req = {
      file: {
        originalname: 'modul.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 content')
      },
      body: { category: 'modul' }
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(ragService.addDocument).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        fileName: 'modul.pdf',
        chunksAdded: expect.any(Number),
        totalChars: expect.any(Number)
      })
    );
    const result = res.json.mock.calls[0][0];
    expect(result.chunksAdded).toBeGreaterThan(0);
  });

  it('should use default category pdf-upload when no category provided', async () => {
    const text = 'Valid text content for embedding purposes only. '.repeat(100);
    pdfParse.mockResolvedValue({ text });
    const req = {
      file: {
        originalname: 'doc.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 content')
      },
      body: {} // no category
    };
    const res = makeRes();
    await uploadPdfDoc(req, res);
    expect(ragService.addDocument).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ category: 'pdf-upload' })
    );
  });
});
