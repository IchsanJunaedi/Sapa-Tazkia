import api from './api';

// State Internal
let rateLimitState = {
  remaining: 7000, 
  limit: 7000,
  resetTime: Date.now() + 86400000, 
  userType: 'guest'
};

const rateLimitListeners = [];

export const aiService = {
  // ============================================================
  // 1. RATE LIMIT MANAGEMENT
  // ============================================================
  
  async getRateLimitStatus() {
    try {
      const response = await api.get('/guest/rate-limit-status'); 
      if (response.data?.data) {
        aiService._processRateLimitHeaders(null, null, response.data.data.window_limits);
      }
      return response.data;
    } catch (error) {
      console.warn("⚠️ [AI SERVICE] Gagal load status, pakai cache lokal.");
      return {
        success: true,
        data: {
          user_type: rateLimitState.userType,
          window_limits: {
            remaining: rateLimitState.remaining,
            limit: rateLimitState.limit || 7000,
            reset_time: rateLimitState.resetTime,
            allowed: true
          }
        }
      };
    }
  },

  addRateLimitListener(callback) {
    rateLimitListeners.push(callback);
    callback(rateLimitState);
  },

  removeRateLimitListener(callback) {
    const index = rateLimitListeners.indexOf(callback);
    if (index > -1) rateLimitListeners.splice(index, 1);
  },

  /**
   * ✅ CORE FIX: SMART DATA MERGING
   * Prioritas: Direct Data > Usage Data (Fresh) > Headers (Stale)
   */
  _processRateLimitHeaders(headers, usageData = null, directData = null) {
    let hasFreshData = false;

    // 1. Direct Data (Paling Eksplisit - biasanya dari endpoint status)
    if (directData) {
        if (directData.remaining !== undefined) rateLimitState.remaining = directData.remaining;
        if (directData.limit && directData.limit > 100) rateLimitState.limit = directData.limit;
        
        const newResetTime = directData.reset_time || directData.resetTime;
        if (newResetTime) rateLimitState.resetTime = newResetTime;
        
        rateLimitState.lastUpdated = new Date();
        hasFreshData = true;
    }

    // 2. Usage Data (Dari Response Chat)
    // ✅ FIX: Baca 'remaining' langsung dari Backend (karena backend sekarang kirim data real-time)
    if (usageData) {
        // A. Jika Backend kirim remaining terbaru, PAKAI ITU. Abaikan hitungan manual.
        if (usageData.remaining !== undefined && usageData.remaining !== null) {
            rateLimitState.remaining = usageData.remaining;
            console.log(`⚡ [AI SERVICE] Updated Balance from Backend: ${rateLimitState.remaining}`);
            hasFreshData = true; 
        } 
        // B. Fallback: Hitung manual jika backend lupa kirim remaining
        else if (usageData.tokensUsed) {
            const current = rateLimitState.remaining;
            rateLimitState.remaining = Math.max(0, current - usageData.tokensUsed);
            hasFreshData = true; // Kita anggap ini fresh karena hasil deduksi
        }

        if (usageData.policy) rateLimitState.userType = usageData.policy;
    }

    // 3. Headers (Middleware)
    // ⚠️ HATI-HATI: Data header ini seringkali "basi" (state sebelum token dipotong)
    // Kita HANYA pakai header jika kita BELUM punya data fresh dari Usage/Direct.
    if (headers) {
      const remaining = headers['x-ratelimit-remaining'];
      const limit = headers['x-ratelimit-limit'];
      const reset = headers['x-ratelimit-reset'];
      const policy = headers['x-ratelimit-policy'];

      const headerLimit = parseInt(limit);

      // Filter Limit: Hanya terima jika masuk akal (> 100)
      if (limit && headerLimit > 100) {
           rateLimitState.limit = headerLimit; 
      } else if (!rateLimitState.limit) {
           rateLimitState.limit = 7000;
      }

      // Filter Remaining: 
      // JANGAN update remaining dari header jika kita baru saja update dari UsageData (hasFreshData).
      // Header berisi nilai LAMA, UsageData berisi nilai BARU.
      if (remaining !== undefined && !directData && !hasFreshData) {
          rateLimitState.remaining = parseInt(remaining);
          // console.log("⚠️ [AI SERVICE] Using Header Balance (Might be Stale)");
      }

      if (reset) rateLimitState.resetTime = (parseInt(reset) * 1000) + Date.now();
      if (policy) rateLimitState.userType = policy;
      rateLimitState.lastUpdated = new Date();
    }

    // Broadcast ke UI
    rateLimitListeners.forEach(listener => listener({ ...rateLimitState }));
  },

  shouldShowRateLimitWarning() {
    return (rateLimitState.remaining / rateLimitState.limit) < 0.2;
  },

  _handleError(error, context = 'Operation') {
    const errorBody = error.response?.data;
    const errorHeaders = error.response?.headers;
    
    let limitsFromBody = null;
    
    // Recovery dari Error Body (Priority 1)
    if (errorBody && (errorBody.limit !== undefined || errorBody.remaining !== undefined)) {
        limitsFromBody = {
            limit: errorBody.limit,
            remaining: errorBody.remaining,
            resetTime: errorBody.resetTime || errorBody.reset_time
        };
    } 
    // Fallback Error 429
    else if (error.response?.status === 429) {
        limitsFromBody = {
            limit: rateLimitState.limit || 7000, 
            remaining: 0,
            resetTime: rateLimitState.resetTime
        };
    }

    this._processRateLimitHeaders(errorHeaders, null, limitsFromBody);

    console.error(`❌ [AI SERVICE] ${context} Error:`, error.response?.data || error.message);

    const message = error.response?.data?.message || 
                    error.response?.data?.error || 
                    error.message || 
                    'Terjadi kesalahan sistem';

    const standardError = new Error(message);
    standardError.status = error.response?.status || 500;
    standardError.code = error.response?.data?.error; 
    standardError.retryAfter = error.response?.headers ? error.response.headers['retry-after'] : null;

    throw standardError;
  },

  // ============================================================
  // 2. CORE MESSAGING
  // ============================================================

  async sendMessage(message, isGuestMode = false, isNewChat = false, conversationId = null) {
    try {
      const payload = { message, isNewChat };
      if (conversationId && !isNewChat) payload.conversationId = conversationId;

      let response;
      if (isGuestMode) {
        payload.sessionId = `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        response = await api.post('/guest/chat', payload);
      } else {
        response = await api.post('/ai/chat', payload);
      }

      this._processRateLimitHeaders(response.headers, response.data.usage);
      
      return response.data;
    } catch (error) {
      this._handleError(error, 'sendMessage');
    }
  },

  async sendGuestMessage(message) {
    try {
      const response = await api.post('/guest/chat', {
        message: message,
        sessionId: `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });
      // ✅ Pass usage data agar diproses oleh logika baru
      this._processRateLimitHeaders(response.headers, response.data.usage);
      return response.data;
    } catch (error) {
      this._handleError(error, 'sendGuestMessage');
    }
  },

  async sendMessageToAI(message, isGuestMode = false, isNewChat = true, conversationId = null) {
    return await this.sendMessage(message, isGuestMode, isNewChat, conversationId);
  },

  // ... (Sisa fungsi lain sama persis) ...
  async testConnection() {
    try { const response = await api.get('/ai/test-gemini'); return response.data; } 
    catch (error) { this._handleError(error, 'testConnection'); }
  },
  async getChatHistory(chatId) {
    try { const response = await api.get(`/ai/history/${chatId}`); return response.data; } 
    catch (error) { this._handleError(error, 'getChatHistory'); }
  },
  async getConversations() {
    try { const response = await api.get('/ai/conversations'); return response.data; } 
    catch (error) { this._handleError(error, 'getConversations'); }
  },
  async deleteConversation(chatId) {
    try { const response = await api.delete(`/ai/conversations/${chatId}`); return response.data; } 
    catch (error) { this._handleError(error, 'deleteConversation'); }
  },
  async createNewChat() {
    return { success: true, message: 'New chat session ready', isNewChat: true, timestamp: new Date().toISOString() };
  }
};

export const sendMessageToAI = aiService.sendMessageToAI.bind(aiService);
export const testAIConnection = aiService.testConnection.bind(aiService);
export const getChatHistory = aiService.getChatHistory.bind(aiService);
export const getUserConversations = aiService.getConversations.bind(aiService);
export const deleteChat = aiService.deleteConversation.bind(aiService);
export const createNewChat = aiService.createNewChat.bind(aiService);

export default aiService;