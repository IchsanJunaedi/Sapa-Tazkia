import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - attach token
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

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==================== AUTH API ====================

export const authAPI = {
  login: async (nim, password) => {
    const response = await api.post('/auth/login', { nim, password });
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  verify: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// ==================== ACADEMIC API ====================

export const academicAPI = {
  getSummary: async () => {
    const response = await api.get('/academic/summary');
    return response.data;
  },

  getGrades: async (semester = null) => {
    const url = semester ? `/academic/grades?semester=${semester}` : '/academic/grades';
    const response = await api.get(url);
    return response.data;
  },

  getTranscript: async () => {
    const response = await api.get('/academic/transcript');
    return response.data;
  },

  downloadTranscriptPDF: async () => {
    const response = await api.get('/academic/transcript/pdf', {
      responseType: 'blob'
    });
    return response.data;
  }
};

// ==================== CHAT API ====================

export const chatAPI = {
  sendMessage: async (message, conversationId = null) => {
    const response = await api.post('/chat', {
      message,
      conversationId
    });
    return response.data;
  },

  getHistory: async (conversationId) => {
    const response = await api.get(`/chat/history/${conversationId}`);
    return response.data;
  },

  getConversations: async (userId) => {
    const response = await api.get(`/chat/conversations/${userId}`);
    return response.data;
  },

  deleteConversation: async (conversationId) => {
    const response = await api.delete(`/chat/conversation/${conversationId}`);
    return response.data;
  }
};

export default api;