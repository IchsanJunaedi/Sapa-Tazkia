// controllers/guestController.js
const { generateGeminiResponse } = require('../services/geminiService');

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
    
    // ✅ PANGGIL GEMINI SERVICE
    const aiResponse = await generateGeminiResponse(message);

    // Simpan di memory (bukan database)
    if (!guestSessions.has(currentSessionId)) {
      guestSessions.set(currentSessionId, {
        messages: [],
        createdAt: new Date()
      });
    }

    const session = guestSessions.get(currentSessionId);
    session.messages.push(
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'bot', content: aiResponse, timestamp: new Date() }
    );

    // Auto cleanup session lama (optional)
    cleanupOldSessions();

    res.json({
      success: true,
      reply: aiResponse,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Guest Chat Error:', error);
    res.status(500).json({
      success: false,
      message: "Chat service error",
      error: error.message
    });
  }
};

const getGuestConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!guestSessions.has(sessionId)) {
      return res.json({
        success: true,
        messages: []
      });
    }

    const session = guestSessions.get(sessionId);
    res.json({
      success: true,
      messages: session.messages
    });

  } catch (error) {
    console.error('❌ Get Guest Conversation Error:', error);
    res.status(500).json({
      success: false,
      message: "Error getting conversation",
      error: error.message
    });
  }
};

// Cleanup session yang sudah lama
const cleanupOldSessions = () => {
  const now = new Date();
  const MAX_AGE = 2 * 60 * 60 * 1000; // 2 jam
  
  for (const [sessionId, session] of guestSessions.entries()) {
    if (now - session.createdAt > MAX_AGE) {
      guestSessions.delete(sessionId);
    }
  }
};

module.exports = {
  guestChat,
  getGuestConversation
};