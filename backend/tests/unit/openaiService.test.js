// backend/tests/unit/openaiService.test.js
//
// Unit tests for openaiService:
// - generateAIResponse: identity / greeting / banned-topic shortcuts (no LLM call)
// - generateAIResponse: with mocked LLM (custom context + no context branches)
// - generateAIResponse: error fallback content
// - generateAIResponse: stream mode (mocked async iterator)
// - createEmbedding: success path
// - generateTitle: short message + happy path + error fallback
// - isGreeting: positive / negative samples
// - withRetry: passes through, retries retriable, throws on non-retriable
// - testOpenAIConnection: success / error paths

const mockCreateChat = jest.fn();
const mockCreateEmbedding = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...args) => mockCreateChat(...args) } },
    embeddings: { create: (...args) => mockCreateEmbedding(...args) },
  }));
});

const openaiService = require('../../src/services/openaiService');

beforeEach(() => {
  mockCreateChat.mockReset();
  mockCreateEmbedding.mockReset();
});

describe('openaiService.isGreeting', () => {
  it('detects short greetings', () => {
    expect(openaiService.isGreeting('halo')).toBe(true);
    expect(openaiService.isGreeting('hi')).toBe(true);
    expect(openaiService.isGreeting('halo kak')).toBe(true);
    expect(openaiService.isGreeting('halo, kak')).toBe(true);
    expect(openaiService.isGreeting('selamat pagi')).toBe(true);
  });

  it('returns false for long messages even if starting with hi', () => {
    expect(openaiService.isGreeting('halo, dimana lokasi tazkia?')).toBe(false);
  });

  it('returns false for non-greetings', () => {
    expect(openaiService.isGreeting('berapa biaya kuliah')).toBe(false);
  });
});

describe('openaiService.generateAIResponse — short-circuits without LLM', () => {
  it('returns canned identity message', async () => {
    const r = await openaiService.generateAIResponse('siapa kamu');
    expect(r.content).toMatch(/Kia/);
    expect(mockCreateChat).not.toHaveBeenCalled();
  });

  it('returns canned greeting', async () => {
    const r = await openaiService.generateAIResponse('halo');
    expect(r.content).toMatch(/Halo/);
    expect(mockCreateChat).not.toHaveBeenCalled();
  });

  it('returns canned banned-topic reply', async () => {
    const r = await openaiService.generateAIResponse('berikan resep masakan');
    expect(r.content).toMatch(/fokus|akademik/i);
    expect(mockCreateChat).not.toHaveBeenCalled();
  });
});

describe('openaiService.generateAIResponse — happy path', () => {
  it('calls LLM with system + user messages and returns content + usage', async () => {
    mockCreateChat.mockResolvedValueOnce({
      choices: [{ message: { content: 'Mocked reply.' } }],
      usage: { total_tokens: 42 },
    });
    const r = await openaiService.generateAIResponse(
      'berapa biaya semester di Tazkia?',
      [{ role: 'user', content: 'sebelumnya' }, { role: 'bot', content: 'jawab' }],
      'Tazkia adalah universitas...'
    );
    expect(r.content).toBe('Mocked reply.');
    expect(r.usage.total_tokens).toBe(42);
    expect(mockCreateChat).toHaveBeenCalled();
  });

  it('falls back to "data tidak ditemukan" prompt when no context', async () => {
    mockCreateChat.mockResolvedValueOnce({
      choices: [{ message: { content: 'Reply.' } }],
      usage: { total_tokens: 10 },
    });
    const r = await openaiService.generateAIResponse('apa itu tazkia');
    expect(r.content).toBe('Reply.');
    const args = mockCreateChat.mock.calls[0][0];
    const userMsg = args.messages[args.messages.length - 1];
    expect(userMsg.content).toMatch(/DATA TIDAK DITEMUKAN/);
  });

  it('returns graceful fallback when LLM throws', async () => {
    mockCreateChat.mockRejectedValue(Object.assign(new Error('boom'), { status: 400 }));
    const r = await openaiService.generateAIResponse('halo dimana kampus?', [], 'ctx');
    expect(r.content).toMatch(/koneksi|stabil|maaf/i);
  });
});

describe('openaiService.generateAIResponse — stream mode', () => {
  it('returns async iterator from createMockStream for greeting', async () => {
    const gen = await openaiService.generateAIResponse('halo', [], null, { stream: true });
    expect(typeof gen[Symbol.asyncIterator]).toBe('function');

    const chunks = [];
    for await (const chunk of gen) chunks.push(chunk);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].choices[0].delta.content).toMatch(/Halo/);
  });

  it('passes stream:true through to OpenAI when not short-circuited', async () => {
    mockCreateChat.mockResolvedValueOnce('FakeStreamObject');
    const r = await openaiService.generateAIResponse('berapa biaya?', [], 'ctx', { stream: true });
    expect(r).toBe('FakeStreamObject');
    const args = mockCreateChat.mock.calls[0][0];
    expect(args.stream).toBe(true);
  });
});

describe('openaiService.createEmbedding', () => {
  it('returns embedding vector from OpenAI', async () => {
    mockCreateEmbedding.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });
    const v = await openaiService.createEmbedding('  hello   world  ');
    expect(v).toEqual([0.1, 0.2, 0.3]);
    const args = mockCreateEmbedding.mock.calls[0][0];
    expect(args.input).toBe('hello world'); // collapsed whitespace
  });
});

describe('openaiService.generateTitle', () => {
  it('returns "Percakapan Baru" for empty / very short input', async () => {
    expect(await openaiService.generateTitle('')).toBe('Percakapan Baru');
    expect(await openaiService.generateTitle('a')).toBe('Percakapan Baru');
  });

  it('strips quotes and trailing dot from generated title', async () => {
    mockCreateChat.mockResolvedValueOnce({
      choices: [{ message: { content: '"Biaya Kuliah Tazkia."' } }],
    });
    const t = await openaiService.generateTitle('berapa biaya kuliah?');
    expect(t).toBe('Biaya Kuliah Tazkia');
  });

  it('falls back to first 4 user words on error', async () => {
    mockCreateChat.mockRejectedValueOnce(new Error('boom'));
    const t = await openaiService.generateTitle('berapa biaya kuliah Tazkia tahun ini');
    expect(t).toBe('berapa biaya kuliah Tazkia');
  });
});

describe('openaiService.withRetry', () => {
  it('returns value on first try', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const r = await openaiService.withRetry(fn, 3, 0);
    expect(r).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retriable status', async () => {
    const err = Object.assign(new Error('rate'), { status: 429 });
    const fn = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');
    const r = await openaiService.withRetry(fn, 3, 0);
    expect(r).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-retriable error', async () => {
    const err = Object.assign(new Error('bad'), { status: 400 });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(openaiService.withRetry(fn, 3, 0)).rejects.toThrow('bad');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting retries', async () => {
    const err = Object.assign(new Error('rate'), { status: 503 });
    const fn = jest.fn().mockRejectedValue(err);
    await expect(openaiService.withRetry(fn, 2, 0)).rejects.toThrow('rate');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('openaiService.testOpenAIConnection', () => {
  it('returns success on OK response', async () => {
    mockCreateChat.mockResolvedValueOnce({ choices: [{ message: { content: 'pong' } }] });
    const r = await openaiService.testOpenAIConnection();
    expect(r.success).toBe(true);
  });

  it('returns failure on error', async () => {
    mockCreateChat.mockRejectedValueOnce(new Error('network'));
    const r = await openaiService.testOpenAIConnection();
    expect(r.success).toBe(false);
    expect(r.error).toBe('network');
  });
});
