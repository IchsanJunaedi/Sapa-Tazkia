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
export const sendAuthenticatedMessage = async (message, conversationId = null) => {
  try {
    console.log('🔐 [AI SERVICE] Sending authenticated message:', { message, conversationId });
    
    const response = await api.post('/ai/chat', {  // ✅ UPDATE: /ai/chat bukan /chat
      message: message,
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
    
    const response = await api.get(`/ai/history/${conversationId}`);  // ✅ UPDATE: /ai/history
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
    
    const response = await api.get('/ai/conversations');  // ✅ UPDATE: /ai/conversations
    console.log('✅ [AI SERVICE] All conversations received:', response.data);
    return response.data;

  } catch (error) {
    console.error('❌ [AI SERVICE] Get all conversations error:', error);
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
 * Unified function untuk mengirim pesan (auto-detect guest/authenticated)
 */
export const sendMessageToAI = async (message, isGuest = false, options = {}) => {
  if (isGuest) {
    return await sendGuestMessage(message, options.sessionId);
  } else {
    return await sendAuthenticatedMessage(message, options.conversationId);
  }
};

// Named export object
const aiService = {
  sendGuestMessage,
  sendAuthenticatedMessage,
  sendMessageToAI,
  getConversationHistory,
  getAllConversations,
  getGuestConversation,
  clearGuestSession,
  getGuestSessionId
};

export default aiService;