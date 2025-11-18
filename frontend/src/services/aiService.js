import api from './api';

export const aiService = {
  // ✅ PERBAIKAN: Send message ke AI dengan parameter lengkap
  async sendMessage(message, isGuestMode = false, isNewChat = false, conversationId = null) {
    try {
      console.log('📤 [AI SERVICE] Sending message to backend:', {
        message: message.substring(0, 50) + '...', // Log sebagian pesan saja
        isGuestMode,
        isNewChat,
        conversationId,
        timestamp: new Date().toISOString()
      });

      // Siapkan payload berdasarkan mode
      const payload = {
        message: message,
        isGuestMode: isGuestMode,
        isNewChat: isNewChat
      };

      // Tambahkan conversationId jika ada (untuk continue chat)
      if (conversationId && !isNewChat) {
        payload.conversationId = conversationId;
      }

      const response = await api.post('/ai/chat', payload);
      
      console.log('✅ [AI SERVICE] Response received:', {
        success: response.data.success,
        hasReply: !!response.data.reply,
        conversationId: response.data.conversationId,
        isNewChat: response.data.isNewChat
      });

      return response.data;
    } catch (error) {
      console.error('❌ [AI SERVICE] Error sending message:', {
        error: error.response?.data || error.message,
        status: error.response?.status,
        url: error.config?.url
      });
      
      // Return error response yang konsisten
      throw {
        message: error.response?.data?.error || 'Terjadi kesalahan saat mengirim pesan',
        status: error.response?.status || 500,
        data: error.response?.data || null
      };
    }
  },

  // ✅ FUNGSI BARU: Send message untuk guest (legacy support)
  async sendGuestMessage(message) {
    try {
      console.log('👤 [AI SERVICE] Sending guest message');
      const response = await api.post('/guest/chat', {
        message: message,
        sessionId: `guest-${Date.now()}` // Generate session ID untuk guest
      });
      return response.data;
    } catch (error) {
      console.error('❌ [AI SERVICE] Guest message error:', error);
      throw {
        message: error.response?.data?.error || 'Terjadi kesalahan pada mode tamu',
        status: error.response?.status || 500
      };
    }
  },

  // ✅ PERBAIKAN: Unified function untuk semua jenis chat
  async sendMessageToAI(message, isGuestMode = false, isNewChat = true, conversationId = null) {
    try {
      if (isGuestMode) {
        console.log('👤 [AI SERVICE] Using guest mode');
        return await this.sendGuestMessage(message);
      } else {
        console.log('🔐 [AI SERVICE] Using authenticated mode');
        return await this.sendMessage(message, false, isNewChat, conversationId);
      }
    } catch (error) {
      console.error('❌ [AI SERVICE] Unified send error:', error);
      throw error;
    }
  },

  // Test koneksi Gemini
  async testConnection() {
    try {
      console.log('🔧 [AI SERVICE] Testing Gemini connection');
      const response = await api.get('/ai/test-gemini');
      console.log('✅ [AI SERVICE] Gemini connection test successful');
      return response.data;
    } catch (error) {
      console.error('❌ [AI SERVICE] Connection test error:', error);
      throw {
        message: error.response?.data?.error || 'Terjadi kesalahan saat test koneksi',
        status: error.response?.status || 500
      };
    }
  },

  // ✅ FUNGSI BARU: Get chat history
  async getChatHistory(chatId) {
    try {
      console.log('📚 [AI SERVICE] Getting chat history:', chatId);
      const response = await api.get(`/ai/history/${chatId}`);
      console.log('✅ [AI SERVICE] Chat history loaded');
      return response.data;
    } catch (error) {
      console.error('❌ [AI SERVICE] History load error:', error);
      throw {
        message: error.response?.data?.error || 'Gagal memuat riwayat chat',
        status: error.response?.status || 500
      };
    }
  },

  // ✅ FUNGSI BARU: Get semua conversations user
  async getConversations() {
    try {
      console.log('📋 [AI SERVICE] Getting user conversations');
      const response = await api.get('/ai/conversations');
      console.log('✅ [AI SERVICE] Conversations loaded:', {
        count: response.data.conversations?.length || 0
      });
      return response.data;
    } catch (error) {
      console.error('❌ [AI SERVICE] Conversations load error:', error);
      throw {
        message: error.response?.data?.error || 'Gagal memuat daftar percakapan',
        status: error.response?.status || 500
      };
    }
  },

  // ✅ FUNGSI BARU: Delete conversation
  async deleteConversation(chatId) {
    try {
      console.log('🗑️ [AI SERVICE] Deleting conversation:', chatId);
      const response = await api.delete(`/ai/conversations/${chatId}`);
      console.log('✅ [AI SERVICE] Conversation deleted successfully');
      return response.data;
    } catch (error) {
      console.error('❌ [AI SERVICE] Delete conversation error:', error);
      throw {
        message: error.response?.data?.error || 'Gagal menghapus percakapan',
        status: error.response?.status || 500
      };
    }
  },

  // ✅ FUNGSI BARU: Create new chat
  async createNewChat() {
    try {
      console.log('🔄 [AI SERVICE] Creating new chat session');
      // Untuk new chat, kita cukup return object kosong
      // Backend akan handle creation ketika pesan pertama dikirim
      return {
        success: true,
        message: 'New chat session ready',
        isNewChat: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ [AI SERVICE] New chat creation error:', error);
      throw {
        message: 'Gagal membuat sesi chat baru',
        status: 500
      };
    }
  }
};

// ✅ EXPORT function individual untuk compatibility
export const sendMessageToAI = aiService.sendMessageToAI.bind(aiService);
export const testAIConnection = aiService.testConnection.bind(aiService);
export const getChatHistory = aiService.getChatHistory.bind(aiService);
export const getUserConversations = aiService.getConversations.bind(aiService);
export const deleteChat = aiService.deleteConversation.bind(aiService);
export const createNewChat = aiService.createNewChat.bind(aiService);

export default aiService;