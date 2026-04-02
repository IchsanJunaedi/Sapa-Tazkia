// Test the PDF magic bytes check logic in isolation
const PDF_MAGIC = Buffer.from('%PDF-');

function isPdfBuffer(buffer) {
  return buffer.length >= 5 && buffer.slice(0, 5).equals(PDF_MAGIC);
}

describe('PDF magic bytes validation', () => {
  it('returns true for a valid PDF buffer', () => {
    const validPdf = Buffer.from('%PDF-1.4 fake content');
    expect(isPdfBuffer(validPdf)).toBe(true);
  });

  it('returns false for a non-PDF buffer', () => {
    const notPdf = Buffer.from('This is a text file, not a PDF');
    expect(isPdfBuffer(notPdf)).toBe(false);
  });

  it('returns false for a buffer shorter than 5 bytes', () => {
    const short = Buffer.from('%PDF');
    expect(isPdfBuffer(short)).toBe(false);
  });
});
