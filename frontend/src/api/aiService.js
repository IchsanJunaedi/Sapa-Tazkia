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

/**
 * Send message untuk guest users
 */
export const sendGuestMessage = async (message, sessionId = null) => {
  try {
    console.log('👤 [AI SERVICE] Sending guest message:', { message, sessionId });
    
    const response = await guestApi.post('/guest/chat', {
      message: message,
      sessionId: sessionId
    });
    
    console.log('✅ [AI SERVICE] Guest response received:', response.data);
    
    // ✅ SIMPAN GUEST SESSION ID KE LOCALSTORAGE (SOLUSI BARU)
    if (response.data.success && response.data.sessionId) {
      localStorage.setItem('guestSessionId', response.data.sessionId);
      console.log('💾 [AI SERVICE] Guest session saved to localStorage:', response.data.sessionId);
    }
    
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Guest message error:', error);
    
    if (error.response?.status === 500) {
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
 * Send message untuk authenticated users
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
      isNewChat: isNewChat, // ✅ PERBAIKAN: Kirim isNewChat ke backend
      conversationId: conversationId
    });
    
    console.log('✅ [AI SERVICE] Authenticated response received:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Authenticated message error:', error);
    
    if (error.response?.status === 401) {
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
 * ✅ NEW: Analyze academic performance untuk authenticated users
 */
export const analyzeAcademicPerformance = async () => {
  try {
    console.log('🧠 [AI SERVICE] Analyzing academic performance');
    
    const response = await api.post('/ai/analyze-academic');
    console.log('✅ [AI SERVICE] Academic analysis received:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Academic analysis error:', error);
    
    if (error.response?.status === 401) {
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
 * ✅ NEW: Get study recommendations untuk authenticated users
 */
export const getStudyRecommendations = async () => {
  try {
    console.log('💡 [AI SERVICE] Getting study recommendations');
    
    const response = await api.post('/ai/study-recommendations');
    console.log('✅ [AI SERVICE] Study recommendations received:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Study recommendations error:', error);
    
    if (error.response?.status === 401) {
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
 * ✅ NEW: Test OpenAI connection
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
 * ✅ NEW: Test AI dengan message
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
 * ✅ NEW: Check AI service health
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
 * ✅ PERBAIKAN UTAMA: Unified function untuk mengirim pesan dengan parameter yang benar
 */
export const sendMessageToAI = async (message, isGuest = false, isNewChat = false, conversationId = null) => {
  console.log('🔄 [AI SERVICE] sendMessageToAI called with:', {
    message,
    isGuest,
    isNewChat,
    conversationId
  });

  if (isGuest) {
    const sessionId = getGuestSessionId();
    return await sendGuestMessage(message, sessionId);
  } else {
    // ✅ PERBAIKAN PENTING: Kirim isNewChat dan conversationId dengan benar
    return await sendAuthenticatedMessage(message, isNewChat, conversationId);
  }
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
  getGuestSessionId
};

export default aiService;