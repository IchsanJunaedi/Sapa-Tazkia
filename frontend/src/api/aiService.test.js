import axios from 'axios';
jest.mock('axios');

// __mocks__/axios.js auto-mocks. axios.create returns the same instance.

import {
  cancelCurrentRequest,
  isRequestInProgress,
  addRateLimitListener,
  removeRateLimitListener,
  getRateLimitState,
  getRateLimitStatus,
  showRateLimitModal,
  sendGuestMessage,
  sendAuthenticatedMessage,
  sendMessageToAI,
  initializeRateLimitState,
  getConversationHistory,
  getAllConversations,
  deleteConversation,
  getGuestConversation,
  analyzeAcademicPerformance,
  getStudyRecommendations,
  testOpenAIConnection,
  testAI,
  checkAIHealth,
  clearGuestSession,
  getGuestSessionId,
  shouldShowRateLimitWarning,
  getRateLimitProgress,
  formatTimeUntilReset,
} from './aiService';
import aiService from './aiService';

beforeEach(() => {
  axios.get.mockReset();
  axios.post.mockReset();
  axios.delete.mockReset();
  localStorage.clear();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('api/aiService — abort controller', () => {
  it('cancelCurrentRequest returns false when no active request', () => {
    expect(cancelCurrentRequest()).toBe(false);
  });

  it('isRequestInProgress returns false initially', () => {
    expect(isRequestInProgress()).toBe(false);
  });
});

describe('api/aiService — rate limit listeners', () => {
  it('addRateLimitListener invokes callback and returns unsubscribe fn', () => {
    const cb = jest.fn();
    const unsub = addRateLimitListener(cb);
    expect(cb).toHaveBeenCalled();
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('removeRateLimitListener removes listener', () => {
    const cb = jest.fn();
    addRateLimitListener(cb);
    removeRateLimitListener(cb);
  });

  it('getRateLimitState returns the current state object', () => {
    const s = getRateLimitState();
    expect(s).toHaveProperty('remaining');
    expect(s).toHaveProperty('limit');
  });
});

describe('api/aiService — rate limit status fetching', () => {
  it('getRateLimitStatus uses /guest endpoint when no token', async () => {
    axios.get.mockResolvedValue({
      data: { success: true, data: { window_limits: { remaining: 50, limit: 100, reset_time: 123 } } },
      headers: {},
    });
    await getRateLimitStatus();
    expect(axios.get).toHaveBeenCalledWith('/guest/rate-limit-status');
  });

  it('getRateLimitStatus uses /ai endpoint when token present', async () => {
    localStorage.setItem('token', 't');
    axios.get.mockResolvedValue({ data: { success: true }, headers: {} });
    await getRateLimitStatus();
    expect(axios.get).toHaveBeenCalledWith('/ai/rate-limit-status');
  });

  it('getRateLimitStatus returns success:false on failure', async () => {
    axios.get.mockRejectedValue(new Error('boom'));
    const out = await getRateLimitStatus();
    expect(out.success).toBe(false);
  });

  it('initializeRateLimitState resolves even on error', async () => {
    axios.get.mockRejectedValue(new Error('boom'));
    await expect(initializeRateLimitState()).resolves.toBeUndefined();
  });
});

describe('api/aiService — showRateLimitModal', () => {
  it('renders modal once into the DOM', () => {
    showRateLimitModal(Date.now() + 60000, 'guest');
    expect(document.querySelector('.rate-limit-modal-overlay')).toBeInTheDocument();
    showRateLimitModal(Date.now() + 60000, 'guest');
    expect(document.querySelectorAll('.rate-limit-modal-overlay')).toHaveLength(1);
  });

  it('renders with no resetTime falls back to "nanti"', () => {
    showRateLimitModal(null, 'guest');
    expect(document.querySelector('.rate-limit-modal-overlay').innerHTML).toMatch(/nanti/);
  });
});

describe('api/aiService — guest & authed messaging (no streaming)', () => {
  it('sendGuestMessage posts and stores sessionId', async () => {
    axios.post.mockResolvedValue({
      data: { success: true, sessionId: 's1', reply: 'hi' },
      headers: {},
    });
    const out = await sendGuestMessage('hello', null);
    expect(axios.post).toHaveBeenCalledWith('/guest/chat', expect.objectContaining({ message: 'hello' }), expect.any(Object));
    expect(localStorage.getItem('guestSessionId')).toBe('s1');
    expect(out.success).toBe(true);
  });

  it('sendGuestMessage on 429 throws rate limit error and shows modal', async () => {
    axios.post.mockRejectedValue({
      response: { status: 429, data: { retry_after: 30, reset_time: Date.now() + 30000 }, headers: {} },
    });
    await expect(sendGuestMessage('hi', null)).rejects.toMatchObject({ isRateLimit: true });
    expect(document.querySelector('.rate-limit-modal-overlay')).toBeInTheDocument();
  });

  it('sendGuestMessage cancellation maps to isCancelled error', async () => {
    axios.post.mockRejectedValue({ name: 'CanceledError', code: 'ERR_CANCELED' });
    await expect(sendGuestMessage('hi', null)).rejects.toMatchObject({ isCancelled: true });
  });

  it('sendAuthenticatedMessage posts to /ai/chat', async () => {
    axios.post.mockResolvedValue({ data: { success: true, reply: 'x' }, headers: {} });
    await sendAuthenticatedMessage('hi', true, null);
    expect(axios.post).toHaveBeenCalledWith('/ai/chat', expect.objectContaining({ isNewChat: true }), expect.any(Object));
  });

  it('sendAuthenticatedMessage on 429 throws rate limit error', async () => {
    axios.post.mockRejectedValue({
      response: { status: 429, data: { retry_after: 30 }, headers: {} },
    });
    await expect(sendAuthenticatedMessage('hi')).rejects.toMatchObject({ isRateLimit: true });
  });

  it('sendAuthenticatedMessage cancellation maps to isCancelled error', async () => {
    axios.post.mockRejectedValue({ code: 'ERR_CANCELED' });
    await expect(sendAuthenticatedMessage('hi')).rejects.toMatchObject({ isCancelled: true });
  });
});

describe('api/aiService — sendMessageToAI dispatcher', () => {
  beforeEach(async () => {
    // Reset rate limit state to non-zero remaining so dispatcher proceeds
    axios.get.mockResolvedValue({
      data: { success: true, data: { window_limits: { remaining: 100, limit: 7000, reset_time: Date.now() + 3600000 } } },
      headers: {},
    });
    await getRateLimitStatus();
  });

  it('routes to authenticated when not guest', async () => {
    axios.post.mockResolvedValue({ data: { success: true }, headers: {} });
    await sendMessageToAI('hi', false, true);
    expect(axios.post).toHaveBeenCalledWith('/ai/chat', expect.any(Object), expect.any(Object));
  });

  it('routes to guest when isGuest true', async () => {
    axios.post.mockResolvedValue({ data: { success: true }, headers: {} });
    await sendMessageToAI('hi', true);
    expect(axios.post).toHaveBeenCalledWith('/guest/chat', expect.any(Object), expect.any(Object));
  });

  it('throws limit-habis when remaining is 0 and resetTime in the future', async () => {
    axios.get.mockResolvedValue({
      data: { success: true, data: { window_limits: { remaining: 0, limit: 7000, reset_time: Date.now() + 3600000 } } },
      headers: {},
    });
    await getRateLimitStatus();
    await expect(sendMessageToAI('hi', true)).rejects.toThrow(/Limit habis/);
  });
});

describe('api/aiService — history & misc endpoints', () => {
  it('getConversationHistory by id', async () => {
    axios.get.mockResolvedValue({ data: { messages: [] } });
    await getConversationHistory('id');
    expect(axios.get).toHaveBeenCalledWith('/ai/history/id');
  });

  it('getAllConversations', async () => {
    axios.get.mockResolvedValue({ data: [] });
    await getAllConversations();
    expect(axios.get).toHaveBeenCalledWith('/ai/conversations');
  });

  it('deleteConversation by id', async () => {
    axios.delete.mockResolvedValue({ data: { ok: true } });
    await deleteConversation('id');
    expect(axios.delete).toHaveBeenCalledWith('/ai/conversations/id');
  });

  it('getGuestConversation by id', async () => {
    axios.get.mockResolvedValue({ data: { messages: [] } });
    await getGuestConversation('gid');
    expect(axios.get).toHaveBeenCalledWith('/guest/conversation/gid');
  });

  it('analyzeAcademicPerformance', async () => {
    axios.post.mockResolvedValue({ data: { ok: true } });
    await analyzeAcademicPerformance();
    expect(axios.post).toHaveBeenCalledWith('/ai/analyze-academic');
  });

  it('getStudyRecommendations', async () => {
    axios.post.mockResolvedValue({ data: { ok: true } });
    await getStudyRecommendations();
    expect(axios.post).toHaveBeenCalledWith('/ai/study-recommendations');
  });

  it('testOpenAIConnection', async () => {
    axios.get.mockResolvedValue({ data: {} });
    await testOpenAIConnection();
    expect(axios.get).toHaveBeenCalledWith('/ai/test-openai');
  });

  it('testAI', async () => {
    axios.post.mockResolvedValue({ data: {} });
    await testAI('hi');
    expect(axios.post).toHaveBeenCalledWith('/ai/test-ai', { message: 'hi' });
  });

  it('checkAIHealth', async () => {
    axios.get.mockResolvedValue({ data: {} });
    await checkAIHealth();
    expect(axios.get).toHaveBeenCalledWith('/ai/health');
  });

  it('guest session helpers', () => {
    localStorage.setItem('guestSessionId', 'g1');
    expect(getGuestSessionId()).toBe('g1');
    clearGuestSession();
    expect(getGuestSessionId()).toBeNull();
  });
});

describe('api/aiService — derived helpers', () => {
  it('shouldShowRateLimitWarning returns boolean', () => {
    expect(typeof shouldShowRateLimitWarning()).toBe('boolean');
  });

  it('getRateLimitProgress returns 0..100', () => {
    const p = getRateLimitProgress();
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(100);
  });

  it('formatTimeUntilReset returns "nanti" for null', () => {
    expect(formatTimeUntilReset(null)).toBe('nanti');
  });

  it('formatTimeUntilReset returns HH:MM string for valid timestamp', () => {
    const out = formatTimeUntilReset(new Date(2024, 0, 1, 15, 30).getTime());
    expect(out).toMatch(/\d{2}:\d{2}/);
  });
});

describe('api/aiService — default export shape', () => {
  it('exposes all expected functions on default export', () => {
    [
      'sendGuestMessage', 'sendAuthenticatedMessage', 'sendMessageToAI',
      'getConversationHistory', 'getAllConversations', 'deleteConversation',
      'getGuestConversation', 'analyzeAcademicPerformance', 'getStudyRecommendations',
      'testOpenAIConnection', 'testAI', 'checkAIHealth', 'clearGuestSession',
      'getGuestSessionId', 'getRateLimitStatus', 'getRateLimitState',
      'addRateLimitListener', 'removeRateLimitListener', 'initializeRateLimitState',
      'formatTimeUntilReset', 'getRateLimitProgress', 'shouldShowRateLimitWarning',
      'showRateLimitModal', 'cancelCurrentRequest', 'isRequestInProgress',
    ].forEach((k) => expect(typeof aiService[k]).toBe('function'));
  });
});
