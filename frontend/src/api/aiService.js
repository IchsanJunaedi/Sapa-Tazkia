import axios from 'axios';

// 🚀 SYSTEM CHECK: v5.1 LOADED (Gen Z Style Modal)
console.log("%c🚀 AI SERVICE v5.1 LOADED (Catchy UI)", "background: #222; color: #ff00ff; font-size: 12px; padding: 4px;");

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const DEFAULT_LIMIT = 7000;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

const guestApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// State Management
let rateLimitState = {
  remaining: DEFAULT_LIMIT,
  limit: DEFAULT_LIMIT,
  resetTime: Date.now() + 43200000, // 12 jam default
  userType: 'guest',
  lastUpdated: null
};

const rateLimitListeners = new Set();

// ============================================================
// ABORT CONTROLLER - untuk fitur Cancel
// ============================================================
let currentAbortController = null;

/**
 * Cancel request AI yang sedang berjalan
 * @returns {boolean} true jika berhasil cancel, false jika tidak ada request aktif
 */
export const cancelCurrentRequest = () => {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
    console.log('🛑 [AI SERVICE] Request cancelled by user');
    return true;
  }
  return false;
};

/**
 * Check apakah ada request yang sedang berjalan
 */
export const isRequestInProgress = () => {
  return currentAbortController !== null;
};

export const addRateLimitListener = (listener) => {
  rateLimitListeners.add(listener);
  listener(rateLimitState);
  return () => rateLimitListeners.delete(listener);
};

export const removeRateLimitListener = (listener) => {
  rateLimitListeners.delete(listener);
};

const updateRateLimitState = (newState) => {
  rateLimitState = { ...rateLimitState, ...newState, lastUpdated: Date.now() };
  rateLimitListeners.forEach(l => { try { l(rateLimitState) } catch (e) { console.error(e) } });
};

export const getRateLimitState = () => rateLimitState;

// Processor Data
const processRateLimitData = (response) => {
  const headers = response.headers;
  const bodyUsage = response.data?.usage;
  const bodyLimits = response.data?.data?.window_limits;

  // 🔍 DEBUG: Log data yang diterima dari backend
  console.log('📦 [RATE LIMIT] Backend Response:', {
    bodyUsage,
    bodyLimits,
    currentState: rateLimitState
  });

  let newRemaining = rateLimitState.remaining;
  let newLimit = rateLimitState.limit;
  let newReset = rateLimitState.resetTime;
  let newUserType = rateLimitState.userType;
  let hasFreshData = false;

  if (bodyUsage) {
    if (bodyUsage.remaining !== undefined && bodyUsage.remaining !== null) {
      newRemaining = bodyUsage.remaining;
      hasFreshData = true;
      console.log('✅ [RATE LIMIT] Using remaining from server:', newRemaining);
    } else if (bodyUsage.tokensUsed) {
      newRemaining = Math.max(0, newRemaining - bodyUsage.tokensUsed);
      hasFreshData = true;
      console.log('⚠️ [RATE LIMIT] Calculated remaining locally:', newRemaining);
    }
    if (bodyUsage.policy) newUserType = bodyUsage.policy;
  }

  if (bodyLimits) {
    if (bodyLimits.remaining !== undefined) {
      newRemaining = bodyLimits.remaining;
      hasFreshData = true;
    }
    if (bodyLimits.limit) newLimit = bodyLimits.limit;
    if (bodyLimits.reset_time) newReset = bodyLimits.reset_time;
  }

  const headerRemaining = parseInt(headers['x-ratelimit-remaining']);
  const headerLimit = parseInt(headers['x-ratelimit-limit']);
  const headerReset = parseInt(headers['x-ratelimit-reset']);
  const headerPolicy = headers['x-ratelimit-policy'];

  if (!isNaN(headerLimit) && headerLimit > 100) newLimit = headerLimit;
  if (!isNaN(headerRemaining) && !hasFreshData) newRemaining = headerRemaining;
  if (!isNaN(headerReset)) newReset = Date.now() + (headerReset * 1000);
  if (headerPolicy) newUserType = headerPolicy;

  updateRateLimitState({
    remaining: newRemaining,
    limit: newLimit,
    resetTime: newReset,
    userType: newUserType
  });

  return { remaining: newRemaining, limit: newLimit };
};

// ✅ HELPER: Format Jam (contoh: 15:30)
const formatClockTime = (timestamp) => {
  if (!timestamp) return 'nanti';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

// ✅ Handle Error Standard
const handleRateLimitError = (error) => {
  console.error('🚫 [RATE LIMIT] Error:', error.response?.data);

  const errorData = error.response?.data;
  const bodyLimit = errorData?.limit || errorData?.data?.limit;
  const safeLimit = (bodyLimit && bodyLimit > 100) ? bodyLimit : (rateLimitState.limit || DEFAULT_LIMIT);

  const retryAfter = errorData?.retry_after || 60;
  const userType = errorData?.user_type || 'guest';
  const resetTime = errorData?.reset_time || (Date.now() + (retryAfter * 1000));

  // Update state ke 0
  updateRateLimitState({
    remaining: 0,
    limit: safeLimit,
    resetTime: resetTime,
    userType: userType
  });

  const timeString = formatClockTime(resetTime);
  // Pesan fallback standar
  const userMessage = `Oops, kuota habis! Kita lanjut lagi jam ${timeString} ya.`;

  const rateLimitError = new Error(userMessage);
  rateLimitError.isRateLimit = true;
  rateLimitError.retryAfter = retryAfter;
  rateLimitError.resetTime = resetTime;
  rateLimitError.userType = userType;

  return rateLimitError;
};

// ✅ NEW: Modal Catchy & Modern (Tanpa Countdown)
export const showRateLimitModal = (resetTime, userType = 'guest') => {
  if (document.querySelector('.rate-limit-modal-overlay')) return;

  const modal = document.createElement('div');
  modal.className = 'rate-limit-modal-overlay';
  modal.style.cssText = `
    position: fixed; 
    top: 0; left: 0; 
    width: 100%; height: 100%; 
    background: rgba(0, 0, 0, 0.6); 
    backdrop-filter: blur(8px);
    display: flex; 
    justify-content: center; 
    align-items: center; 
    z-index: 10000; 
    font-family: 'Plus Jakarta Sans', sans-serif;
    animation: fadeIn 0.2s ease-out;
  `;

  const timeString = formatClockTime(resetTime);

  // Style CSS Animation dalam JS
  const styleSheet = document.createElement("style");
  styleSheet.innerText = `
    @keyframes modalPop {
      0% { transform: scale(0.95) translateY(10px); opacity: 0; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes fadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
  `;
  document.head.appendChild(styleSheet);

  modal.innerHTML = `
    <div style="
      background: #ffffff;
      padding: 40px 32px;
      border-radius: 24px;
      max-width: 400px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      animation: modalPop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(0,0,0,0.05);
      position: relative;
      overflow: hidden;
    ">
      <!-- Dekorasi Background Blur -->
      <div style="position: absolute; top: -50px; left: -50px; width: 150px; height: 150px; background: #E0F2FE; border-radius: 50%; filter: blur(40px); z-index: 0;"></div>
      <div style="position: absolute; bottom: -50px; right: -50px; width: 150px; height: 150px; background: #FCE7F3; border-radius: 50%; filter: blur(40px); z-index: 0;"></div>

      <div style="position: relative; z-index: 1;">
        <div style="font-size: 56px; margin-bottom: 20px; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.1));">🙅‍♂️</div>
        
        <h3 style="
          margin: 0 0 12px 0; 
          font-size: 24px; 
          font-weight: 800; 
          color: #111827; 
          letter-spacing: -0.02em;
        ">
          Yah, Kuota Habis!
        </h3>
        
        <p style="
          color: #6B7280; 
          margin-bottom: 28px; 
          line-height: 1.6; 
          font-size: 16px;
          font-weight: 500;
        ">
          Kamu terlalu asik ngobrol nih! <br>
          Istirahat dulu yaa, kita lanjut lagi jam:
        </p>

        <div style="
          display: inline-block; 
          margin-bottom: 32px; 
          background: #F3F4F6;
          border: 1px solid #E5E7EB;
          border-radius: 16px;
          padding: 12px 24px;
        ">
          <span style="
            font-size: 32px; 
            font-weight: 800; 
            background: linear-gradient(to right, #2563EB, #7C3AED);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-variant-numeric: tabular-nums;
          ">
            ${timeString}
          </span>
        </div>

        <button onclick="this.closest('.rate-limit-modal-overlay').remove()" style="
          background: #111827; 
          color: white; 
          border: none; 
          padding: 16px 32px; 
          border-radius: 12px; 
          cursor: pointer; 
          font-weight: 700; 
          font-size: 15px; 
          width: 100%;
          transition: transform 0.1s, box-shadow 0.2s;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        "
        onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 10px 15px -3px rgba(0, 0, 0, 0.1)';"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 6px -1px rgba(0, 0, 0, 0.1)';"
        >
          Oke, Siap Ditunggu! 
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

export const getRateLimitStatus = async () => {
  try {
    const token = localStorage.getItem('token');
    const apiInstance = token ? api : guestApi;
    const endpoint = token ? '/ai/rate-limit-status' : '/guest/rate-limit-status';
    const response = await apiInstance.get(endpoint);
    if (response.data.success) processRateLimitData(response);
    return response.data;
  } catch (error) {
    return { success: false };
  }
};

// ✅ NEW: Helper for Streaming Request (Fetch API)
const streamFetch = async (endpoint, payload, onStream, isGuest = false) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && !isGuest ? { 'Authorization': `Bearer ${token}` } : {})
  };

  currentAbortController = new AbortController();

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, stream: true }),
      signal: currentAbortController.signal
    });

    if (!response.ok) {
      const error = new Error(`HTTP Error: ${response.status}`);
      error.status = response.status;
      try {
        const errData = await response.json();
        error.response = { data: errData };
        if (response.status === 429) {
          const rateLimitError = handleRateLimitError({ response: { data: errData, headers: {} } }); // Mock axios error struct
          showRateLimitModal(rateLimitError.resetTime, isGuest ? 'guest' : 'user');
          throw rateLimitError;
        }
      } catch (e) { }
      throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullReply = "";
    let conversationId = null;
    let finalUsage = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            if (jsonStr.trim() === '[DONE]') continue; // Standard SSE done

            const data = JSON.parse(jsonStr);

            if (data.type === 'meta') {
              conversationId = data.conversationId;
              // Could invoke onStream for docs if needed
            } else if (data.type === 'content') {
              fullReply += data.chunk;
              if (onStream) onStream(data.chunk, false);
            } else if (data.type === 'done') {
              finalUsage = { total_tokens: data.usage };
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }

    if (onStream) onStream('', true); // Signal done
    return {
      success: true,
      reply: fullReply,
      conversationId,
      usage: finalUsage,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    if (error.name === 'AbortError') {
      const cancelError = new Error('Request dibatalkan oleh pengguna');
      cancelError.isCancelled = true;
      throw cancelError;
    }
    throw error;
  } finally {
    currentAbortController = null;
  }
};

export const sendGuestMessage = async (message, sessionId = null, onStream = null) => {
  // Use Streaming if callback provided
  if (onStream) {
    const response = await streamFetch('/guest/chat', { message, sessionId }, onStream, true);
    if (response && response.sessionId) {
      localStorage.setItem('guestSessionId', response.sessionId);
    }
    return response;
  }

  // Fallback to Axios (Legacy/No-stream)
  currentAbortController = new AbortController();
  try {
    const response = await guestApi.post('/guest/chat', { message, sessionId, stream: false }, {
      signal: currentAbortController.signal
    });
    processRateLimitData(response);
    if (response.data.success && response.data.sessionId) {
      localStorage.setItem('guestSessionId', response.data.sessionId);
    }
    return response.data;
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      const cancelError = new Error('Request dibatalkan oleh pengguna');
      cancelError.isCancelled = true;
      throw cancelError;
    }
    if (error.response?.status === 429) {
      const rateLimitError = handleRateLimitError(error);
      showRateLimitModal(rateLimitError.resetTime, 'guest');
      throw rateLimitError;
    }
    throw error;
  } finally {
    currentAbortController = null;
  }
};

export const sendAuthenticatedMessage = async (message, isNewChat = false, conversationId = null, onStream = null) => {
  if (onStream) {
    return await streamFetch('/ai/chat', { message, isNewChat, conversationId }, onStream, false);
  }

  currentAbortController = new AbortController();
  try {
    const response = await api.post('/ai/chat', { message, isNewChat, conversationId, stream: false }, {
      signal: currentAbortController.signal
    });
    processRateLimitData(response);
    return response.data;
  } catch (error) {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      const cancelError = new Error('Request dibatalkan oleh pengguna');
      cancelError.isCancelled = true;
      throw cancelError;
    }
    if (error.response?.status === 429) {
      const rateLimitError = handleRateLimitError(error);
      showRateLimitModal(rateLimitError.resetTime, 'user');
      throw rateLimitError;
    }
    throw error;
  } finally {
    currentAbortController = null;
  }
};

export const sendMessageToAI = async (message, isGuest = false, isNewChat = false, conversationId = null, onStream = null) => {
  const currentState = getRateLimitState();
  if (currentState.remaining === 0) {
    if (Date.now() < currentState.resetTime) {
      showRateLimitModal(currentState.resetTime, currentState.userType);
      throw new Error(`Limit habis. Reset pada jam ${formatClockTime(currentState.resetTime)}`);
    }
  }

  if (isGuest) {
    const sessionId = localStorage.getItem('guestSessionId');
    return await sendGuestMessage(message, sessionId, onStream);
  } else {
    return await sendAuthenticatedMessage(message, isNewChat, conversationId, onStream);
  }
};

export const initializeRateLimitState = async () => {
  try { await getRateLimitStatus(); } catch (e) {
    updateRateLimitState({ remaining: DEFAULT_LIMIT, limit: DEFAULT_LIMIT, resetTime: Date.now() + 43200000, userType: 'guest' });
  }
};

export const getConversationHistory = async (id) => (await api.get(`/ai/history/${id}`)).data;
export const getAllConversations = async () => (await api.get('/ai/conversations')).data;
export const deleteConversation = async (id) => (await api.delete(`/ai/conversations/${id}`)).data;
export const getGuestConversation = async (id) => (await guestApi.get(`/guest/conversation/${id}`)).data;
export const analyzeAcademicPerformance = async () => (await api.post('/ai/analyze-academic')).data;
export const getStudyRecommendations = async () => (await api.post('/ai/study-recommendations')).data;
export const testOpenAIConnection = async () => (await guestApi.get('/ai/test-openai')).data;
export const testAI = async (msg) => (await guestApi.post('/ai/test-ai', { message: msg })).data;
export const checkAIHealth = async () => (await guestApi.get('/ai/health')).data;
export const clearGuestSession = () => { localStorage.removeItem('guestSessionId'); };
export const getGuestSessionId = () => { return localStorage.getItem('guestSessionId'); };
export const shouldShowRateLimitWarning = () => {
  const { remaining, limit } = rateLimitState;
  if (remaining !== null && limit !== null) { return remaining <= (limit * 0.2); }
  return false;
};
export const getRateLimitProgress = () => {
  const { remaining, limit } = rateLimitState;
  if (!remaining || !limit) return 0;
  return Math.max(0, ((limit - remaining) / limit) * 100);
};
export const formatTimeUntilReset = (resetTime) => {
  return formatClockTime(resetTime);
};

const aiService = {
  sendGuestMessage,
  sendAuthenticatedMessage,
  sendMessageToAI,
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
  getRateLimitStatus,
  getRateLimitState,
  addRateLimitListener,
  removeRateLimitListener,
  initializeRateLimitState,
  formatTimeUntilReset,
  getRateLimitProgress,
  shouldShowRateLimitWarning,
  showRateLimitModal,
  cancelCurrentRequest,
  isRequestInProgress
};

export default aiService;