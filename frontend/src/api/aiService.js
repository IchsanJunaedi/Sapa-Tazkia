// src/api/aiService.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Buat instance axios untuk authenticated requests
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Buat instance axios untuk guest requests (tanpa auth header)
const guestApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor untuk menambahkan token ke authenticated requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ NEW: Rate limit state management
let rateLimitState = {
  remaining: null,
  limit: null,
  resetTime: null,
  userType: null,
  lastUpdated: null
};

// ✅ NEW: Rate limit event listeners
const rateLimitListeners = new Set();

// ✅ NEW: Add rate limit listener
export const addRateLimitListener = (listener) => {
  rateLimitListeners.add(listener);
  return () => rateLimitListeners.delete(listener);
};

// ✅ NEW: Remove rate limit listener
export const removeRateLimitListener = (listener) => {
  rateLimitListeners.delete(listener);
};

// ✅ NEW: Update rate limit state and notify listeners
const updateRateLimitState = (newState) => {
  rateLimitState = {
    ...rateLimitState,
    ...newState,
    lastUpdated: Date.now()
  };
  
  // Notify all listeners
  rateLimitListeners.forEach(listener => {
    try {
      listener(rateLimitState);
    } catch (error) {
      console.error('Rate limit listener error:', error);
    }
  });
};

// ✅ NEW: Get current rate limit state
export const getRateLimitState = () => rateLimitState;

// ✅ NEW: Extract rate limit info from response headers
const extractRateLimitInfo = (response) => {
  const headers = response.headers;
  const rateLimitInfo = {
    remaining: parseInt(headers['x-ratelimit-remaining']),
    limit: parseInt(headers['x-ratelimit-limit']),
    resetTime: parseInt(headers['x-ratelimit-reset']),
    userType: headers['x-ratelimit-user-type'] || 'unknown'
  };
  
  if (!isNaN(rateLimitInfo.remaining) && !isNaN(rateLimitInfo.limit)) {
    updateRateLimitState(rateLimitInfo);
    return rateLimitInfo;
  }
  return null;
};

// ✅ NEW: Handle rate limit error dengan retry logic
const handleRateLimitError = (error) => {
  console.error('🚫 [RATE LIMIT] Rate limit error:', error.response?.data);
  
  const errorData = error.response?.data;
  const retryAfter = errorData?.retry_after || errorData?.error?.retryAfter || 60;
  const userType = errorData?.user_type || 'guest';
  const resetTime = errorData?.reset_time || Date.now() + (retryAfter * 1000);
  
  // Update rate limit state
  updateRateLimitState({
    remaining: 0,
    limit: errorData?.limit || 10,
    resetTime: resetTime,
    userType: userType
  });
  
  // Create user-friendly error message
  let userMessage;
  if (retryAfter < 60) {
    userMessage = `Batas percakapan tercapai. Coba lagi dalam ${retryAfter} detik.`;
  } else if (retryAfter < 3600) {
    const minutes = Math.ceil(retryAfter / 60);
    userMessage = `Batas percakapan tercapai. Coba lagi dalam ${minutes} menit.`;
  } else {
    const hours = Math.ceil(retryAfter / 3600);
    userMessage = `Batas percakapan tercapai. Coba lagi dalam ${hours} jam.`;
  }
  
  // Add suggestion for authenticated users
  if (userType === 'guest') {
    userMessage += ' Daftar akun untuk mendapatkan limit yang lebih tinggi.';
  }
  
  const rateLimitError = new Error(userMessage);
  rateLimitError.isRateLimit = true;
  rateLimitError.retryAfter = retryAfter;
  rateLimitError.userType = userType;
  rateLimitError.resetTime = resetTime;
  
  return rateLimitError;
};

// ✅ NEW: Show rate limit modal
export const showRateLimitModal = (retryAfter, userType = 'guest') => {
  // Create modal element
  const modal = document.createElement('div');
  modal.className = 'rate-limit-modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  const minutes = Math.ceil(retryAfter / 60);
  const isGuest = userType === 'guest';
  
  modal.innerHTML = `
    <div class="rate-limit-modal" style="
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      max-width: 400px;
      width: 90%;
      text-align: center;
    ">
      <div style="font-size: 48px; margin-bottom: 16px;">⏳</div>
      <h3 style="margin: 0 0 12px 0; color: #333; font-size: 20px;">
        Batas Percakapan Tercapai
      </h3>
      <p style="color: #666; margin-bottom: 20px; line-height: 1.5;">
        ${isGuest 
          ? `Anda telah mencapai batas percakapan untuk pengguna tamu.` 
          : `Anda telah mencapai batas percakapan harian.`
        }
        <br>
        Silakan coba lagi dalam <strong id="countdown">${retryAfter}</strong> detik.
      </p>
      ${isGuest ? `
        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
          <p style="margin: 0; color: #495057; font-size: 14px;">
            💡 <strong>Daftar akun</strong> untuk mendapatkan limit percakapan yang lebih tinggi!
          </p>
        </div>
      ` : ''}
      <button onclick="this.closest('.rate-limit-modal-overlay').remove()" style="
        background: #007bff;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">
        Mengerti
      </button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Start countdown
  let countdown = retryAfter;
  const countdownElement = modal.querySelector('#countdown');
  const interval = setInterval(() => {
    countdown--;
    if (countdownElement) {
      countdownElement.textContent = countdown;
    }
    if (countdown <= 0) {
      clearInterval(interval);
      modal.remove();
    }
  }, 1000);
  
  // Auto-remove after retry time
  setTimeout(() => {
    if (document.body.contains(modal)) {
      modal.remove();
    }
  }, retryAfter * 1000);
};

// ✅ NEW: Get rate limit status from server
export const getRateLimitStatus = async () => {
  try {
    console.log('📊 [AI SERVICE] Getting rate limit status');
    
    const token = localStorage.getItem('token');
    const apiInstance = token ? api : guestApi;
    const endpoint = token ? '/ai/rate-limit-status' : '/guest/rate-limit-status';
    
    const response = await apiInstance.get(endpoint);
    console.log('✅ [AI SERVICE] Rate limit status received:', response.data);
    
    if (response.data.success) {
      const rateLimitData = response.data.data;
      updateRateLimitState({
        remaining: rateLimitData.window_limits?.remaining || rateLimitData.token_bucket?.tokens,
        limit: rateLimitData.window_limits?.limit,
        resetTime: rateLimitData.window_limits?.reset_time,
        userType: rateLimitData.user_type
      });
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ [AI SERVICE] Get rate limit status error:', error);
    throw error;
  }
};

// ✅ NEW: Check if should show rate limit warning
export const shouldShowRateLimitWarning = () => {
  const { remaining, limit } = rateLimitState;
  if (remaining !== null && limit !== null) {
    const warningThreshold = Math.max(3, Math.floor(limit * 0.2)); // 20% or min 3
    return remaining <= warningThreshold;
  }
  return false;
};

/**
 * Send message untuk guest users dengan rate limit handling
 */
export const sendGuestMessage = async (message, sessionId = null) => {
  try {
    console.log('👤 [AI SERVICE] Sending guest message:', { message, sessionId });
    
    const response = await guestApi.post('/guest/chat', {
      message: message,
      sessionId: sessionId
    });
    
    console.log('✅ [AI SERVICE] Guest response received:', response.data);
    
    // ✅ Extract rate limit info from headers
    const rateLimitInfo = extractRateLimitInfo(response);
    if (rateLimitInfo) {
      console.log('📊 [RATE LIMIT] Guest rate limit:', rateLimitInfo);
    }
    
    // ✅ SIMPAN GUEST SESSION ID KE LOCALSTORAGE (SOLUSI BARU)
    if (response.data.success && response.data.sessionId) {
      localStorage.setItem('guestSessionId', response.data.sessionId);
      console.log('💾 [AI SERVICE] Guest session saved to localStorage:', response.data.sessionId);
    }
    
    // ✅ Add rate limit info to response data
    if (rateLimitInfo && response.data.success) {
      response.data.rate_limit = rateLimitInfo;
    }
    
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Guest message error:', error);
    
    // ✅ Handle rate limit errors specifically
    if (error.response?.status === 429) {
      const rateLimitError = handleRateLimitError(error);
      showRateLimitModal(rateLimitError.retryAfter, 'guest');
      throw rateLimitError;
    } else if (error.response?.status === 500) {
      throw new Error('Server sedang mengalami gangguan. Silakan coba lagi nanti.');
    } else if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else if (error.message === 'Network Error') {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    } else {
      throw new Error('Terjadi kesalahan saat mengirim pesan. Silakan coba lagi.');
    }
  }
};

/**
 * Send message untuk authenticated users dengan rate limit handling
 */
export const sendAuthenticatedMessage = async (message, isNewChat = false, conversationId = null) => {
  try {
    console.log('🔐 [AI SERVICE] Sending authenticated message:', { 
      message, 
      isNewChat, 
      conversationId 
    });
    
    const response = await api.post('/ai/chat', {
      message: message,
      isNewChat: isNewChat,
      conversationId: conversationId
    });
    
    console.log('✅ [AI SERVICE] Authenticated response received:', response.data);
    
    // ✅ Extract rate limit info from headers
    const rateLimitInfo = extractRateLimitInfo(response);
    if (rateLimitInfo) {
      console.log('📊 [RATE LIMIT] User rate limit:', rateLimitInfo);
    }
    
    // ✅ Add rate limit info to response data
    if (rateLimitInfo && response.data.success) {
      response.data.rate_limit = rateLimitInfo;
    }
    
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Authenticated message error:', error);
    
    // ✅ Handle rate limit errors specifically
    if (error.response?.status === 429) {
      const rateLimitError = handleRateLimitError(error);
      showRateLimitModal(rateLimitError.retryAfter, 'user');
      throw rateLimitError;
    } else if (error.response?.status === 401) {
      // Hapus token jika unauthorized
      localStorage.removeItem('token');
      throw new Error('Sesi telah berakhir. Silakan login kembali.');
    } else if (error.response?.status === 500) {
      throw new Error('Server sedang mengalami gangguan. Silakan coba lagi nanti.');
    } else if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else if (error.message === 'Network Error') {
      throw new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.');
    } else {
      throw new Error('Terjadi kesalahan saat mengirim pesan. Silakan coba lagi.');
    }
  }
};

/**
 * Get conversation history untuk authenticated users
 */
export const getConversationHistory = async (conversationId) => {
  try {
    console.log('📚 [AI SERVICE] Getting conversation history:', conversationId);
    
    const response = await api.get(`/ai/history/${conversationId}`);
    console.log('✅ [AI SERVICE] Conversation history received:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Get conversation history error:', error);
    throw error;
  }
};

/**
 * Get all conversations untuk authenticated users
 */
export const getAllConversations = async () => {
  try {
    console.log('📚 [AI SERVICE] Getting all conversations');
    
    const response = await api.get('/ai/conversations');
    console.log('✅ [AI SERVICE] All conversations received:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Get all conversations error:', error);
    throw error;
  }
};

/**
 * Delete conversation untuk authenticated users
 */
export const deleteConversation = async (conversationId) => {
  try {
    console.log('🗑️ [AI SERVICE] Deleting conversation:', conversationId);
    
    const response = await api.delete(`/ai/conversations/${conversationId}`);
    console.log('✅ [AI SERVICE] Conversation deleted:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Delete conversation error:', error);
    throw error;
  }
};

/**
 * Get guest conversation history
 */
export const getGuestConversation = async (sessionId) => {
  try {
    console.log('👤 [AI SERVICE] Getting guest conversation:', sessionId);
    
    const response = await guestApi.get(`/guest/conversation/${sessionId}`);
    console.log('✅ [AI SERVICE] Guest conversation received:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Get guest conversation error:', error);
    throw error;
  }
};

/**
 * Analyze academic performance untuk authenticated users
 */
export const analyzeAcademicPerformance = async () => {
  try {
    console.log('🧠 [AI SERVICE] Analyzing academic performance');
    
    const response = await api.post('/ai/analyze-academic');
    console.log('✅ [AI SERVICE] Academic analysis received:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Academic analysis error:', error);
    
    if (error.response?.status === 429) {
      const rateLimitError = handleRateLimitError(error);
      throw rateLimitError;
    } else if (error.response?.status === 401) {
      localStorage.removeItem('token');
      throw new Error('Sesi telah berakhir. Silakan login kembali.');
    } else if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else {
      throw new Error('Terjadi kesalahan saat menganalisis performa akademik. Silakan coba lagi.');
    }
  }
};

/**
 * Get study recommendations untuk authenticated users
 */
export const getStudyRecommendations = async () => {
  try {
    console.log('💡 [AI SERVICE] Getting study recommendations');
    
    const response = await api.post('/ai/study-recommendations');
    console.log('✅ [AI SERVICE] Study recommendations received:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Study recommendations error:', error);
    
    if (error.response?.status === 429) {
      const rateLimitError = handleRateLimitError(error);
      throw rateLimitError;
    } else if (error.response?.status === 401) {
      localStorage.removeItem('token');
      throw new Error('Sesi telah berakhir. Silakan login kembali.');
    } else if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else {
      throw new Error('Terjadi kesalahan saat mendapatkan rekomendasi belajar. Silakan coba lagi.');
    }
  }
};

/**
 * Test OpenAI connection
 */
export const testOpenAIConnection = async () => {
  try {
    console.log('🔧 [AI SERVICE] Testing OpenAI connection');
    
    const response = await guestApi.get('/ai/test-openai');
    console.log('✅ [AI SERVICE] OpenAI connection test result:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] OpenAI connection test error:', error);
    throw error;
  }
};

/**
 * Test AI dengan message
 */
export const testAI = async (message) => {
  try {
    console.log('🤖 [AI SERVICE] Testing AI with message:', message);
    
    const response = await guestApi.post('/ai/test-ai', { message });
    console.log('✅ [AI SERVICE] AI test result:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] AI test error:', error);
    throw error;
  }
};

/**
 * Check AI service health
 */
export const checkAIHealth = async () => {
  try {
    console.log('🏥 [AI SERVICE] Checking AI service health');
    
    const response = await guestApi.get('/ai/health');
    console.log('✅ [AI SERVICE] AI health check result:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] AI health check error:', error);
    throw error;
  }
};

/**
 * Clear guest session (untuk logout guest)
 */
export const clearGuestSession = () => {
  localStorage.removeItem('guestSessionId');
  sessionStorage.removeItem('guestSessionId');
  console.log('🧹 [AI SERVICE] Guest session cleared');
};

/**
 * Get current guest session ID
 */
export const getGuestSessionId = () => {
  return localStorage.getItem('guestSessionId') || sessionStorage.getItem('guestSessionId');
};

/**
 * ✅ ENHANCED: Unified function untuk mengirim pesan dengan rate limit awareness
 */
export const sendMessageToAI = async (message, isGuest = false, isNewChat = false, conversationId = null) => {
  console.log('🔄 [AI SERVICE] sendMessageToAI called with:', {
    message,
    isGuest,
    isNewChat,
    conversationId
  });

  // ✅ Check rate limit state before sending
  const currentState = getRateLimitState();
  if (currentState.remaining === 0) {
    const retryAfter = Math.ceil((currentState.resetTime - Date.now()) / 1000);
    if (retryAfter > 0) {
      showRateLimitModal(retryAfter, currentState.userType || (isGuest ? 'guest' : 'user'));
      throw new Error(`Rate limit exceeded. Please try again in ${retryAfter} seconds.`);
    }
  }

  if (isGuest) {
    const sessionId = getGuestSessionId();
    return await sendGuestMessage(message, sessionId);
  } else {
    return await sendAuthenticatedMessage(message, isNewChat, conversationId);
  }
};

// ✅ NEW: Initialize rate limit state on module load
export const initializeRateLimitState = async () => {
  try {
    await getRateLimitStatus();
  } catch (error) {
    console.warn('⚠️ [AI SERVICE] Failed to initialize rate limit state:', error.message);
    // Set default state
    updateRateLimitState({
      remaining: 10,
      limit: 10,
      resetTime: Date.now() + 60000,
      userType: 'guest'
    });
  }
};

// ✅ NEW: Format time until reset
export const formatTimeUntilReset = (resetTime) => {
  const now = Date.now();
  const diff = resetTime - now;
  
  if (diff <= 0) return 'sebentar lagi';
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours} jam ${minutes % 60} menit`;
  if (minutes > 0) return `${minutes} menit ${seconds % 60} detik`;
  return `${seconds} detik`;
};

// ✅ NEW: Get rate limit progress percentage
export const getRateLimitProgress = () => {
  const { remaining, limit } = rateLimitState;
  if (remaining === null || limit === null) return 0;
  return Math.max(0, ((limit - remaining) / limit) * 100);
};

// Named export object
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
  
  // ✅ NEW: Rate limit functions
  getRateLimitStatus,
  getRateLimitState,
  addRateLimitListener,
  removeRateLimitListener,
  initializeRateLimitState,
  formatTimeUntilReset,
  getRateLimitProgress,
  shouldShowRateLimitWarning,
  showRateLimitModal
};

export default aiService;