jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({}));
});

let withRetry;

beforeEach(() => {
  jest.resetModules();
  jest.mock('openai', () => jest.fn().mockImplementation(() => ({})));
  ({ withRetry } = require('../../src/services/openaiService'));
});

describe('withRetry', () => {
  it('returns result immediately on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retriable status code (429) and succeeds on 2nd attempt', async () => {
    const err = new Error('rate limited');
    err.status = 429;
    const fn = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, 3, 0); // 0ms delay for tests
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after maxAttempts exhausted on retriable error', async () => {
    const err = new Error('server error');
    err.status = 503;
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, 3, 0)).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on non-retriable error (401)', async () => {
    const err = new Error('unauthorized');
    err.status = 401;
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, 3, 0)).rejects.toThrow('unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
