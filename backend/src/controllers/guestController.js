const ragService = require('../services/ragService'); 
const rateLimitService = require('../services/rateLimitService'); 
const { generateAIResponse } = require('../services/openaiService'); 

const guestSessions = new Map();

const guestChat = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const ipAddress = req.ip || '127.0.0.1';

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: "Message required" });
    }

    const currentSessionId = sessionId || `guest-${Date.now()}`;
    console.log(`👤 [GUEST] Chat from IP: ${ipAddress}`);

    // 1. RAG Process
    let ragResult; 
    let finalAnswer;
    let usedRAG = false;
    let realTokenUsage = 0; 

    try {
       // Panggil RAG 
       ragResult = await ragService.answerQuestion(message, []);
       
       finalAnswer = ragResult.answer; 
       usedRAG = true;
       
       // ✅ AMBIL TOKEN ASLI DARI DATA OPENAI
       realTokenUsage = ragResult.usage ? ragResult.usage.total_tokens : 0;

       // Fallback jika usage tidak ada
       if (!realTokenUsage) {
         const inputChars = message.length;
         const outputChars = finalAnswer ? finalAnswer.length : 0;
         realTokenUsage = Math.ceil((inputChars + outputChars) / 4) + 1400;
       }

    } catch (ragError) {
       console.error("RAG Error:", ragError.message);
       throw ragError;
    }

    // =================================================================
    // 2. ✅ TOKEN TRACKING & REALTIME BALANCE UPDATE
    // =================================================================
    let currentRemaining = null; // Variabel untuk menyimpan sisa saldo terbaru

    if (realTokenUsage > 0) {
        // A. Potong Saldo
        await rateLimitService.trackTokenUsage(null, ipAddress, realTokenUsage);
        console.log(`📉 [GUEST LIMIT] Deducted REAL usage: ${realTokenUsage} tokens`);

        // B. ✅ FIX: Ambil Sisa Saldo TERBARU setelah pemotongan
        // Middleware mengirim saldo "sebelum" dipotong. Kita butuh saldo "sesudah" dipotong.
        const quotaStatus = await rateLimitService.getQuotaStatus(ipAddress, 'guest');
        currentRemaining = quotaStatus.remaining;
        console.log(`📊 [GUEST LIMIT] Updated Balance: ${currentRemaining}`);
    }
    // =================================================================

    // Session Management
    if (!guestSessions.has(currentSessionId)) {
        guestSessions.set(currentSessionId, { messages: [], lastActivity: new Date() });
    }
    const session = guestSessions.get(currentSessionId);
    session.messages.push({ role: 'user', content: message }, { role: 'bot', content: finalAnswer });
    
    // Auto cleanup
    cleanupOldSessions();

    // Response
    res.json({
      success: true,
      reply: finalAnswer, 
      sessionId: currentSessionId,
      timestamp: new Date().toISOString(),
      // ✅ Kirim data usage DAN remaining terbaru ke frontend
      // Frontend akan memprioritaskan 'remaining' di sini daripada di Header
      usage: {
        tokensUsed: realTokenUsage, 
        policy: 'guest',
        remaining: currentRemaining // <-- KUNCI PERBAIKANNYA
      }
    });

  } catch (error) {
    console.error('❌ [GUEST ERROR]', error.message);
    
    // Fallback Logic (Direct OpenAI)
    if (error.message.includes('Qdrant') || error.message.includes('fetch')) {
        try {
            const fallbackResponse = await generateAIResponse(message, [], 'general');
            
            const replyText = typeof fallbackResponse === 'object' ? fallbackResponse.content : fallbackResponse;
            const usageData = typeof fallbackResponse === 'object' ? fallbackResponse.usage : null;
            
            let fallbackTokens = 0;
            if (usageData) {
                fallbackTokens = usageData.total_tokens;
            } else {
                fallbackTokens = Math.ceil((message.length + replyText.length) / 4);
            }

            let fallbackRemaining = null;

            if (fallbackTokens > 0) {
                await rateLimitService.trackTokenUsage(null, req.ip, fallbackTokens);
                // Ambil saldo terbaru juga di sini
                const quotaStatus = await rateLimitService.getQuotaStatus(req.ip, 'guest');
                fallbackRemaining = quotaStatus.remaining;
            }

            return res.json({
                success: true,
                reply: replyText,
                sessionId: req.body.sessionId || `guest-${Date.now()}`,
                fallback: true,
                usage: { 
                    tokensUsed: fallbackTokens, 
                    policy: 'guest',
                    remaining: fallbackRemaining // <-- Kirim sisa saldo terbaru
                }
            });
        } catch (e) { console.error("Fallback error", e); }
    }

    if (error.message.includes('rate_limit')) {
        return res.status(429).json({ success: false, message: "Terlalu banyak permintaan." });
    }

    res.status(500).json({ success: false, message: "System Error" });
  }
};

// ... (fungsi getter lain tidak berubah) ...
const getGuestConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!guestSessions.has(sessionId)) return res.json({ success: true, messages: [] });
    const session = guestSessions.get(sessionId);
    session.lastActivity = new Date();
    res.json({ success: true, messages: session.messages });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error getting conversation" });
  }
};

const getGuestSessionInfo = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!guestSessions.has(sessionId)) return res.status(404).json({ success: false, message: "Session not found" });
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
    res.status(500).json({ success: false, message: "Error info" });
  }
};

const clearGuestSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (guestSessions.has(sessionId)) guestSessions.delete(sessionId);
    res.json({ success: true, message: "Cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error clearing" });
  }
};

const cleanupOldSessions = () => {
  const now = new Date();
  const MAX_AGE = 2 * 60 * 60 * 1000; 
  for (const [sessionId, session] of guestSessions.entries()) {
    if (now - session.lastActivity > MAX_AGE) guestSessions.delete(sessionId);
  }
};

setInterval(cleanupOldSessions, 30 * 60 * 1000);

module.exports = {
  guestChat,
  getGuestConversation,
  getGuestSessionInfo,
  clearGuestSession
};