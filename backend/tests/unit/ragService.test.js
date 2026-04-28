// backend/tests/unit/ragService.test.js
//
// Unit tests for ragService — fully mocks Qdrant, OpenAI, and Redis.
// Covers:
// - generateSearchQueries: typo normalization, context injection, keyword extraction
// - compileContext: empty docs, single doc, token cutoff
// - calculateTextHash + generateDeterministicId determinism
// - answerQuestion: cache hit, cache miss + persists, streaming branch, error
// - ensureCollection: idempotent + create new
// - listDocuments / getSampleDocuments / addDocument / deleteDocument

const mockQdrantInstance = {
  getCollections: jest.fn(),
  createCollection: jest.fn(),
  deleteCollection: jest.fn(),
  scroll: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  search: jest.fn(),
};

jest.mock('@qdrant/js-client-rest', () => ({
  QdrantClient: jest.fn().mockImplementation(() => mockQdrantInstance),
}));

jest.mock('../../src/services/openaiService', () => ({
  generateAIResponse: jest.fn(),
  createEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.01)),
}));

jest.mock('../../src/services/redisService', () => ({
  get: jest.fn(),
  set: jest.fn(),
}));

const ragService = require('../../src/services/ragService');
const openaiService = require('../../src/services/openaiService');
const redisService = require('../../src/services/redisService');

beforeEach(() => {
  Object.values(mockQdrantInstance).forEach(fn => fn.mockReset && fn.mockReset());
  mockQdrantInstance.getCollections.mockResolvedValue({ collections: [{ name: 'sapa_tazkia_knowledge' }] });
  openaiService.generateAIResponse.mockReset();
  openaiService.createEmbedding.mockClear();
  redisService.get.mockReset();
  redisService.set.mockReset();
});

describe('ragService.generateSearchQueries', () => {
  it('returns at least one base normalized query', async () => {
    const queries = await ragService.generateSearchQueries('Apa itu Tazkia?');
    expect(Array.isArray(queries)).toBe(true);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.length).toBeLessThanOrEqual(3);
  });

  it('injects history context when query is short or has trigger word', async () => {
    const history = [{ role: 'user', content: 'Saya ingin tahu prodi Akuntansi.' }];
    const queries = await ragService.generateSearchQueries('biaya', history);
    // At least one query should contain "Konteks:"
    expect(queries.some(q => q.toLowerCase().includes('konteks'))).toBe(true);
  });

  it('extracts keywords from long query', async () => {
    const long = 'apakah benar bahwa biaya pendaftaran di kampus untuk program studi akuntansi syariah adalah lima juta rupiah saja saya ingin tanya';
    const queries = await ragService.generateSearchQueries(long);
    expect(queries.length).toBeGreaterThan(0);
  });
});

describe('ragService.compileContext', () => {
  it('returns empty string for empty docs', () => {
    expect(ragService.compileContext([])).toBe('');
    expect(ragService.compileContext(null)).toBe('');
  });

  it('concatenates payload.title + payload.text', () => {
    const docs = [
      { payload: { title: 'Biaya', text: 'Rp 5jt/semester' } },
      { payload: { title: 'Lokasi', text: 'Sentul, Bogor' } },
    ];
    const ctx = ragService.compileContext(docs);
    expect(ctx).toContain('[[Sumber: Biaya]]');
    expect(ctx).toContain('Rp 5jt/semester');
    expect(ctx).toContain('Sentul');
  });

  it('falls back to "Informasi" title when missing', () => {
    const docs = [{ payload: { text: 'foo' } }];
    expect(ragService.compileContext(docs)).toContain('Informasi');
  });

  it('breaks loop when token budget exceeded', () => {
    // MAX_CONTEXT_TOKENS = 800 (≈3200 chars). Build docs that exceed.
    const big = 'x'.repeat(2000);
    const docs = [
      { payload: { title: 'A', text: big } },
      { payload: { title: 'B', text: big } },
      { payload: { title: 'C', text: big } },
    ];
    const ctx = ragService.compileContext(docs);
    // Third doc shouldn't fit
    expect(ctx).not.toContain('[[Sumber: C]]');
  });
});

describe('ragService.calculateTextHash + generateDeterministicId', () => {
  it('hashes are deterministic for same input', () => {
    const a = ragService.calculateTextHash('Apa itu Tazkia?');
    const b = ragService.calculateTextHash('Apa itu Tazkia?');
    expect(a).toBe(b);
  });

  it('hashes ignore punctuation + case', () => {
    const a = ragService.calculateTextHash('Apa itu, Tazkia?');
    const b = ragService.calculateTextHash('apa  itu tazkia');
    expect(a).toBe(b);
  });

  it('generateDeterministicId returns UUID-like format', () => {
    const id = ragService.generateDeterministicId('seed-text');
    expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]+$/);
  });
});

describe('ragService.answerQuestion', () => {
  it('returns cached response when redis has key', async () => {
    redisService.get.mockResolvedValueOnce(JSON.stringify({ answer: 'cached!', usage: { total_tokens: 10 } }));
    const r = await ragService.answerQuestion('test');
    expect(r.answer).toBe('cached!');
    expect(openaiService.generateAIResponse).not.toHaveBeenCalled();
  });

  it('runs full pipeline + persists cache on miss', async () => {
    redisService.get.mockResolvedValueOnce(null);
    mockQdrantInstance.search.mockResolvedValue([]);
    openaiService.generateAIResponse.mockResolvedValueOnce({
      content: 'fresh answer',
      usage: { total_tokens: 50 },
    });
    const r = await ragService.answerQuestion('berapa biaya kuliah?');
    expect(r.answer).toBe('fresh answer');
    expect(openaiService.generateAIResponse).toHaveBeenCalled();
    expect(redisService.set).toHaveBeenCalled();
  });

  it('returns stream object when stream:true', async () => {
    redisService.get.mockResolvedValueOnce(null);
    mockQdrantInstance.search.mockResolvedValue([]);
    openaiService.generateAIResponse.mockResolvedValueOnce('FakeStreamObj');
    const r = await ragService.answerQuestion('halo', [], { stream: true });
    expect(r.isStream).toBe(true);
    expect(r.stream).toBe('FakeStreamObj');
  });

  it('throws on aborted signal', async () => {
    redisService.get.mockResolvedValueOnce(null);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(ragService.answerQuestion('x', [], { abortSignal: ctrl.signal })).rejects.toThrow();
  });
});

describe('ragService.ensureCollection', () => {
  it('creates collection when not present', async () => {
    mockQdrantInstance.getCollections.mockResolvedValueOnce({ collections: [] });
    mockQdrantInstance.createCollection.mockResolvedValueOnce(true);
    await ragService.ensureCollection();
    expect(mockQdrantInstance.createCollection).toHaveBeenCalled();
  });

  it('skips creation when collection already exists', async () => {
    mockQdrantInstance.getCollections.mockResolvedValueOnce({ collections: [{ name: 'sapa_tazkia_knowledge' }] });
    await ragService.ensureCollection();
    expect(mockQdrantInstance.createCollection).not.toHaveBeenCalled();
  });

  it('swallows error when Qdrant unreachable', async () => {
    mockQdrantInstance.getCollections.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(ragService.ensureCollection()).resolves.toBeUndefined();
  });
});

describe('ragService.listDocuments', () => {
  it('returns array of normalized docs', async () => {
    mockQdrantInstance.scroll.mockResolvedValueOnce({
      points: [
        { id: 'a', payload: { content: 'foo', source: 'doc.json', category: 'general', createdAt: 'today' } },
        { id: 'b', payload: { text: 'bar', filename: 'b.json' } },
      ],
    });
    const docs = await ragService.listDocuments();
    expect(docs.length).toBe(2);
    expect(docs[0].source).toBe('doc.json');
    expect(docs[1].content).toBe('bar');
  });

  it('throws when scroll fails', async () => {
    mockQdrantInstance.scroll.mockRejectedValueOnce(new Error('boom'));
    await expect(ragService.listDocuments()).rejects.toThrow();
  });
});

describe('ragService.getSampleDocuments', () => {
  it('returns sliced + filtered samples', async () => {
    mockQdrantInstance.scroll.mockResolvedValueOnce({
      points: [
        { id: '1', payload: { source: 'biaya.json', content: 'Rp 5jt' } },
        { id: '2', payload: { source: 'unknown', content: 'ABC' } },
      ],
    });
    const samples = await ragService.getSampleDocuments(2);
    expect(samples.length).toBeGreaterThanOrEqual(1);
    expect(samples[0].suggestedQuestion).toBeTruthy();
  });

  it('returns [] when listDocuments throws', async () => {
    mockQdrantInstance.scroll.mockRejectedValueOnce(new Error('down'));
    const r = await ragService.getSampleDocuments();
    expect(r).toEqual([]);
  });
});

describe('ragService.addDocument', () => {
  it('embeds, upserts, returns id + content', async () => {
    mockQdrantInstance.upsert.mockResolvedValueOnce(true);
    const r = await ragService.addDocument('Lorem ipsum', { title: 'Test', source: 'unit-test' });
    expect(r.id).toBeDefined();
    expect(r.content).toBe('Lorem ipsum');
    expect(r.source).toBe('unit-test');
    expect(openaiService.createEmbedding).toHaveBeenCalledWith('Lorem ipsum');
    expect(mockQdrantInstance.upsert).toHaveBeenCalled();
  });

  it('throws when upsert fails', async () => {
    mockQdrantInstance.upsert.mockRejectedValueOnce(new Error('qdrant down'));
    await expect(ragService.addDocument('x')).rejects.toThrow();
  });
});

describe('ragService.deleteDocument', () => {
  it('parses numeric id and calls delete', async () => {
    mockQdrantInstance.delete.mockResolvedValueOnce(true);
    const r = await ragService.deleteDocument('42');
    expect(r.success).toBe(true);
    expect(r.id).toBe(42);
  });

  it('keeps non-numeric id as string', async () => {
    mockQdrantInstance.delete.mockResolvedValueOnce(true);
    const r = await ragService.deleteDocument('uuid-abc');
    expect(r.id).toBe('uuid-abc');
  });

  it('throws on qdrant error', async () => {
    mockQdrantInstance.delete.mockRejectedValueOnce(new Error('boom'));
    await expect(ragService.deleteDocument('x')).rejects.toThrow();
  });
});
