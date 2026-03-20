// backend/tests/unit/textChunker.test.js
const { chunkText } = require('../../src/utils/textChunker');

describe('chunkText', () => {
  it('should return single chunk for text shorter than chunkSize', () => {
    const text = 'Hello world. '.repeat(30); // ~390 chars, under 1500
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
  });

  it('should return empty array for text shorter than minimum chunk size (100 chars)', () => {
    const text = 'Too short.';
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(0);
  });

  it('should split long text into multiple chunks', () => {
    const text = 'This is a sentence with enough words. '.repeat(150); // ~5700 chars
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should not produce chunks shorter than 100 characters', () => {
    const text = 'Word '.repeat(2000); // 10000 chars
    const chunks = chunkText(text);
    chunks.forEach((chunk) => {
      expect(chunk.length).toBeGreaterThanOrEqual(100);
    });
  });

  it('should preserve content — first and last unique words appear in output', () => {
    const words = [];
    for (let i = 0; i < 500; i++) words.push(`uniqueword${i}`);
    const text = words.join(' ');
    const chunks = chunkText(text);
    const allText = chunks.join(' ');
    expect(allText).toContain('uniqueword0');
    expect(allText).toContain('uniqueword499');
  });

  it('should include overlap — a unique word near end of chunk[0] also appears in chunk[1]', () => {
    // Build a text with known unique words at predictable positions
    // Section A: 1000 chars of 'alpha' words, Section B: 1000 chars of 'beta' words,
    // Section C: 1000 chars of 'gamma' words — with chunkSize=1500, overlap=200
    // chunk[0] covers ~A+half-B, chunk[1] should start in B (the overlap zone)
    const sectionA = Array.from({ length: 50 }, (_, i) => `alphaword${i}`).join(' '); // ~700 chars
    const sectionB = Array.from({ length: 50 }, (_, i) => `betaword${i}`).join(' ');  // ~700 chars
    const sectionC = Array.from({ length: 50 }, (_, i) => `gammaword${i}`).join(' '); // ~700 chars
    const text = `${sectionA} ${sectionB} ${sectionC}`;

    const chunks = chunkText(text, 1500, 200);
    expect(chunks.length).toBeGreaterThan(1);

    // Due to overlap, at least one word that ends chunk[0] should start chunk[1]
    const lastWordsOfChunk0 = chunks[0].split(' ').slice(-10).filter(Boolean);
    const firstWordsOfChunk1 = new Set(chunks[1].split(' ').slice(0, 30).filter(Boolean));
    const hasOverlap = lastWordsOfChunk0.some((w) => firstWordsOfChunk1.has(w));
    expect(hasOverlap).toBe(true);
  });

  it('should not split on abbreviations — Dr., No., SKS', () => {
    const text =
      'Dr. Budi adalah dosen pengampu mata kuliah. No. 123 adalah nomor ruangan. ' +
      'Nilai SKS 3.75 adalah nilai tertinggi yang bisa dicapai mahasiswa. ' +
      'Mahasiswa wajib memenuhi persyaratan kelulusan yang telah ditetapkan.';
    const chunks = chunkText(text, 80, 10);
    chunks.forEach((chunk) => {
      // No chunk should end with only an abbreviation token
      expect(chunk.trim()).not.toMatch(/\bDr\.?$/);
      expect(chunk.trim()).not.toMatch(/\bNo\.?$/);
    });
  });
});
