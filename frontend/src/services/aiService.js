import api from './api';

export const aiService = {
  // Send message ke AI
  async sendMessage(message) {
    try {
      const response = await api.post('/test-ai', {
        message: message
      });
      return response.data;
    } catch (error) {
      console.error('❌ AI Service Error:', error);
      throw error;
    }
  },

  // Test koneksi Gemini
  async testConnection() {
    try {
      const response = await api.get('/test-gemini');
      return response.data;
    } catch (error) {
      console.error('❌ AI Connection Test Error:', error);
      throw error;
    }
  }
};

export default aiService;