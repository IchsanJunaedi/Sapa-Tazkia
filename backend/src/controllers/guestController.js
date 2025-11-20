// controllers/guestController.js
const ragService = require('../services/ragService'); // ✅ IMPORT RAG SERVICE

// Simpan session guest di memory (bukan database)
const guestSessions = new Map();

const guestChat = async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    // Generate session ID jika belum ada
    const currentSessionId = sessionId || `guest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('👤 [GUEST CONTROLLER] Guest chat request:', {
      sessionId: currentSessionId,
      messageLength: message.length
    });

    // ✅ PERBAIKAN UTAMA: GUNAKAN RAG SERVICE SAMA SEPERTI USER LOGIN
    const aiResponse = await ragService.answerQuestion(message, []);

    // Simpan di memory (bukan database)
    if (!guestSessions.has(currentSessionId)) {
      guestSessions.set(currentSessionId, {
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date()
      });
    }

    const session = guestSessions.get(currentSessionId);
    session.messages.push(
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'bot', content: aiResponse, timestamp: new Date() }
    );
    session.lastActivity = new Date();

    // Auto cleanup session lama
    cleanupOldSessions();

    console.log('✅ [GUEST CONTROLLER] Guest response sent:', {
      sessionId: currentSessionId,
      responseLength: aiResponse.length,
      totalMessages: session.messages.length,
      usedRAG: true // ✅ INDIKATOR RAG DIGUNAKAN
    });

    res.json({
      success: true,
      reply: aiResponse,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [GUEST CONTROLLER] Guest Chat Error:', error);
    
    // Error handling untuk RAG Service
    if (error.message.includes('OPENAI_API_KEY')) {
      return res.status(500).json({
        success: false,
        message: "Sistem AI sedang dalam perbaikan. Silakan coba lagi nanti."
      });
    } else if (error.message.includes('rate_limit')) {
      return res.status(429).json({
        success: false,
        message: "Terlalu banyak permintaan. Silakan tunggu sebentar."
      });
    } else if (error.message.includes('Qdrant')) {
      // Fallback ke OpenAI langsung jika RAG error
      console.log('🔄 [GUEST CONTROLLER] RAG error, falling back to direct OpenAI');
      try {
        const { generateAIResponse } = require('../services/openaiService');
        const fallbackResponse = await generateAIResponse(message);
        
        return res.json({
          success: true,
          reply: fallbackResponse,
          sessionId: currentSessionId,
          timestamp: new Date().toISOString(),
          fallback: true // ✅ INDIKATOR FALLBACK MODE
        });
      } catch (fallbackError) {
        console.error('❌ [GUEST CONTROLLER] Fallback also failed:', fallbackError);
      }
    }
    
    // Generic error response
    res.status(500).json({
      success: false,
      message: "Chat service error",
      error: process.env.NODE_ENV === 'development' ? error.message : 'Terjadi kesalahan, silakan coba lagi.'
    });
  }
};

const getGuestConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log('📜 [GUEST CONTROLLER] Get guest conversation:', sessionId);

    if (!guestSessions.has(sessionId)) {
      console.log('ℹ️ [GUEST CONTROLLER] Session not found:', sessionId);
      return res.json({
        success: true,
        messages: []
      });
    }

    const session = guestSessions.get(sessionId);
    
    // Update last activity
    session.lastActivity = new Date();

    console.log('✅ [GUEST CONTROLLER] Guest conversation retrieved:', {
      sessionId: sessionId,
      messageCount: session.messages.length
    });

    res.json({
      success: true,
      messages: session.messages
    });

  } catch (error) {
    console.error('❌ [GUEST CONTROLLER] Get Guest Conversation Error:', error);
    res.status(500).json({
      success: false,
      message: "Error getting conversation",
      error: error.message
    });
  }
};

// ✅ NEW: Get guest session info
const getGuestSessionInfo = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!guestSessions.has(sessionId)) {
      return res.status(404).json({
        success: false,
        message: "Session not found"
      });
    }

    const session = guestSessions.get(sessionId);
    
    res.json({
      success: true,
      data: {
        sessionId: sessionId,
        messageCount: session.messages.length,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        ageInMinutes: Math.round((new Date() - session.createdAt) / (1000 * 60))
      }
    });

  } catch (error) {
    console.error('❌ [GUEST CONTROLLER] Get Session Info Error:', error);
    res.status(500).json({
      success: false,
      message: "Error getting session info",
      error: error.message
    });
  }
};

// ✅ NEW: Clear guest session
const clearGuestSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (guestSessions.has(sessionId)) {
      guestSessions.delete(sessionId);
      console.log('🧹 [GUEST CONTROLLER] Guest session cleared:', sessionId);
    }

    res.json({
      success: true,
      message: "Guest session cleared successfully"
    });

  } catch (error) {
    console.error('❌ [GUEST CONTROLLER] Clear Session Error:', error);
    res.status(500).json({
      success: false,
      message: "Error clearing session",
      error: error.message
    });
  }
};

// Cleanup session yang sudah lama
const cleanupOldSessions = () => {
  const now = new Date();
  const MAX_AGE = 2 * 60 * 60 * 1000; // 2 jam
  
  let cleanedCount = 0;
  
  for (const [sessionId, session] of guestSessions.entries()) {
    if (now - session.lastActivity > MAX_AGE) {
      guestSessions.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 [GUEST CONTROLLER] Cleaned ${cleanedCount} old guest sessions`);
  }
};

// Run cleanup setiap 30 menit
setInterval(cleanupOldSessions, 30 * 60 * 1000);

// Log session stats periodically
setInterval(() => {
  console.log(`📊 [GUEST CONTROLLER] Active guest sessions: ${guestSessions.size}`);
}, 60 * 60 * 1000); // Setiap 1 jam

module.exports = {
  guestChat,
  getGuestConversation,
  getGuestSessionInfo,
  clearGuestSession
};