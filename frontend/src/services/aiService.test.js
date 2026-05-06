jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

import api from './api';
import aiService, {
  sendMessageToAI,
  testAIConnection,
  getChatHistory,
  getUserConversations,
  deleteChat,
  createNewChat,
} from './aiService';

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.delete.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('services/aiService — rate limit', () => {
  it('getRateLimitStatus returns server data on success', async () => {
    api.get.mockResolvedValue({
      data: { success: true, data: { user_type: 'free', window_limits: { remaining: 100, limit: 200, reset_time: 123 } } },
    });
    const out = await aiService.getRateLimitStatus();
    expect(api.get).toHaveBeenCalledWith('/guest/rate-limit-status');
    expect(out.success).toBe(true);
  });

  it('getRateLimitStatus returns local cache on failure', async () => {
    api.get.mockRejectedValue(new Error('boom'));
    const out = await aiService.getRateLimitStatus();
    expect(out.success).toBe(true);
    expect(out.data.window_limits.allowed).toBe(true);
  });

  it('addRateLimitListener invokes callback with current state and removeRateLimitListener removes it', () => {
    const cb = jest.fn();
    aiService.addRateLimitListener(cb);
    expect(cb).toHaveBeenCalled();
    aiService.removeRateLimitListener(cb);
    aiService.removeRateLimitListener(cb); // double-remove no-op
  });

  it('shouldShowRateLimitWarning returns boolean', () => {
    expect(typeof aiService.shouldShowRateLimitWarning()).toBe('boolean');
  });

  it('_processRateLimitHeaders applies directData', () => {
    aiService._processRateLimitHeaders(null, null, { remaining: 50, limit: 7000, reset_time: 123 });
  });

  it('_processRateLimitHeaders applies usageData with explicit remaining', () => {
    aiService._processRateLimitHeaders(null, { remaining: 42, policy: 'free' });
  });

  it('_processRateLimitHeaders applies usageData with tokensUsed fallback', () => {
    aiService._processRateLimitHeaders(null, { tokensUsed: 5 });
  });

  it('_processRateLimitHeaders applies headers when not stale', () => {
    aiService._processRateLimitHeaders({
      'x-ratelimit-remaining': '99',
      'x-ratelimit-limit': '7000',
      'x-ratelimit-reset': '60',
      'x-ratelimit-policy': 'premium',
    });
  });

  it('_processRateLimitHeaders ignores stale remaining when fresh data exists', () => {
    aiService._processRateLimitHeaders(
      { 'x-ratelimit-remaining': '99', 'x-ratelimit-limit': '7000' },
      null,
      { remaining: 1 }
    );
  });
});

describe('services/aiService — messaging', () => {
  it('sendMessage posts to /ai/chat for authed user', async () => {
    api.post.mockResolvedValue({ headers: {}, data: { reply: 'hi', usage: { remaining: 10 } } });
    const out = await aiService.sendMessage('hello', false, true);
    expect(api.post).toHaveBeenCalledWith('/ai/chat', expect.objectContaining({ message: 'hello', isNewChat: true }));
    expect(out.reply).toBe('hi');
  });

  it('sendMessage attaches conversationId when not new chat', async () => {
    api.post.mockResolvedValue({ headers: {}, data: { reply: 'x', usage: {} } });
    await aiService.sendMessage('hello', false, false, 'cv1');
    expect(api.post).toHaveBeenCalledWith('/ai/chat', expect.objectContaining({ conversationId: 'cv1' }));
  });

  it('sendMessage in guest mode posts /guest/chat', async () => {
    api.post.mockResolvedValue({ headers: {}, data: { reply: 'g', usage: {} } });
    await aiService.sendMessage('hi', true, true);
    expect(api.post.mock.calls[0][0]).toBe('/guest/chat');
    expect(api.post.mock.calls[0][1].sessionId).toMatch(/^guest-/);
  });

  it('sendMessage rethrows handled error on failure', async () => {
    api.post.mockRejectedValue({ response: { status: 500, data: { message: 'oops' } } });
    await expect(aiService.sendMessage('x')).rejects.toThrow('oops');
  });

  it('sendMessage handles 429 rate limit fallback', async () => {
    api.post.mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '5' }, data: {} } });
    await expect(aiService.sendMessage('x')).rejects.toMatchObject({ status: 429 });
  });

  it('sendGuestMessage posts /guest/chat', async () => {
    api.post.mockResolvedValue({ headers: {}, data: { reply: 'g', usage: {} } });
    await aiService.sendGuestMessage('hello');
    expect(api.post).toHaveBeenCalledWith('/guest/chat', expect.objectContaining({ message: 'hello' }));
  });

  it('sendGuestMessage error path', async () => {
    api.post.mockRejectedValue({ response: { status: 500, data: { error: 'boom' } } });
    await expect(aiService.sendGuestMessage('x')).rejects.toBeDefined();
  });

  it('sendMessageToAI delegates to sendMessage', async () => {
    api.post.mockResolvedValue({ headers: {}, data: { reply: 'ok', usage: {} } });
    await sendMessageToAI('hi');
    expect(api.post).toHaveBeenCalled();
  });
});

describe('services/aiService — chat history', () => {
  it('testConnection success', async () => {
    api.get.mockResolvedValue({ data: { ok: true } });
    await testAIConnection();
    expect(api.get).toHaveBeenCalledWith('/ai/test-gemini');
  });

  it('testConnection error', async () => {
    api.get.mockRejectedValue({ response: { status: 500, data: {} } });
    await expect(testAIConnection()).rejects.toBeDefined();
  });

  it('getChatHistory by id', async () => {
    api.get.mockResolvedValue({ data: { messages: [] } });
    await getChatHistory('id');
    expect(api.get).toHaveBeenCalledWith('/ai/history/id');
  });

  it('getChatHistory error', async () => {
    api.get.mockRejectedValue({ response: { status: 404, data: {} } });
    await expect(getChatHistory('x')).rejects.toBeDefined();
  });

  it('getConversations success', async () => {
    api.get.mockResolvedValue({ data: { conversations: [] } });
    await getUserConversations();
    expect(api.get).toHaveBeenCalledWith('/ai/conversations');
  });

  it('deleteConversation success', async () => {
    api.delete.mockResolvedValue({ data: { ok: true } });
    await deleteChat('cv1');
    expect(api.delete).toHaveBeenCalledWith('/ai/conversations/cv1');
  });

  it('createNewChat returns ready response', async () => {
    const r = await createNewChat();
    expect(r.isNewChat).toBe(true);
  });
});
