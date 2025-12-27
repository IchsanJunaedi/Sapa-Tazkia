const ragService = require('../services/ragService');
const rateLimitService = require('../services/rateLimitService');
const { generateAIResponse } = require('../services/openaiService');

// In-memory storage untuk Guest (Hilang saat restart server)
const guestSessions = new Map();

const guestChat = async (req, res) => {
  try {
    const abortController = new AbortController();
    const { message, sessionId } = req.body;
    const ipAddress = req.ip || '127.0.0.1';

    // 🛑 Listener untuk pembatalan (Refresh/Cancel)
    req.on('close', () => {
      if (!res.writableEnded) {
        console.log('⚠️ [GUEST CONTROLLER] Request closed by client before completion. Aborting AI...');
        abortController.abort();
      }
    });

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: "Message required" });
    }

    const currentSessionId = sessionId || `guest-${Date.now()}`;
    console.log(`👤 [GUEST] Chat from IP: ${ipAddress}`);

    // =================================================================
    // 1. 🧠 HISTORY RETRIEVAL (LOGIC BARU)
    // =================================================================
    let conversationHistory = [];

    // Cek apakah ada sesi sebelumnya
    if (guestSessions.has(currentSessionId)) {
      const session = guestSessions.get(currentSessionId);

      // Ambil 6 pesan terakhir agar hemat token & tetap relevan
      const lastMessages = session.messages.slice(-6);

      // Format ulang agar sesuai standar OpenAI (user & assistant)
      conversationHistory = lastMessages.map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : 'user', // Convert 'bot' ke 'assistant'
        content: msg.content
      }));
    }
    // =================================================================

    // 2. RAG Process
    let ragResult;
    let finalAnswer;
    let realTokenUsage = 0;

    try {
      // ✅ PASS HISTORY & ABORT SIGNAL
      ragResult = await ragService.answerQuestion(
        message,
        conversationHistory,
        { abortSignal: abortController.signal }
      );

      finalAnswer = ragResult.answer;

      // Ambil token usage real
      realTokenUsage = ragResult.usage ? ragResult.usage.total_tokens : 0;

      // Fallback estimasi jika null
      if (!realTokenUsage) {
        const inputChars = message.length;
        const outputChars = finalAnswer ? finalAnswer.length : 0;
        realTokenUsage = Math.ceil((inputChars + outputChars) / 4) + 100;
      }

    } catch (ragError) {
      console.error("RAG Error:", ragError.message);
      throw ragError;
    }

    // =================================================================
    // 3. TOKEN TRACKING & BALANCE UPDATE
    // =================================================================
    let currentRemaining = null;

    if (realTokenUsage > 0) {
      // A. Potong Saldo DAN ambil total usage langsung dari hasil operasi
      const trackResult = await rateLimitService.trackTokenUsage(null, ipAddress, realTokenUsage);
      console.log(`📉 [GUEST LIMIT] Deducted REAL usage: ${realTokenUsage} tokens`);

      // B. Hitung remaining LANGSUNG dari hasil trackTokenUsage
      // Ini lebih akurat daripada memanggil getQuotaStatus terpisah
      if (trackResult && trackResult.success) {
        const guestLimits = rateLimitService.getLimits('guest');
        currentRemaining = Math.max(0, guestLimits.tokenLimitDaily - trackResult.totalUsage);
        console.log(`📊 [GUEST LIMIT] Total Usage: ${trackResult.totalUsage} | Remaining: ${currentRemaining}`);
      } else {
        // Fallback ke getQuotaStatus jika trackTokenUsage gagal
        const quotaStatus = await rateLimitService.getQuotaStatus(ipAddress, 'guest');
        currentRemaining = quotaStatus.remaining;
        console.log(`📊 [GUEST LIMIT] (Fallback) Updated Balance: ${currentRemaining}`);
      }
    }

    // =================================================================
    // 4. SAVE SESSION (UPDATE HISTORY)
    // =================================================================

    // 🛑 ABORT CHECK: Jika client sudah batalin (Cancel), jangan simpan ke history
    if (req.socket.destroyed || abortController.signal.aborted) {
      console.log('🛑 [GUEST CONTROLLER] Request aborted. Skipping session update.');
      return;
    }

    // Jika sesi belum ada, buat baru
    if (!guestSessions.has(currentSessionId)) {
      guestSessions.set(currentSessionId, {
        messages: [],
        createdAt: new Date(),
        lastActivity: new Date()
      });
    }

    const session = guestSessions.get(currentSessionId);

    // Simpan pesan baru
    session.messages.push({ role: 'user', content: message });
    session.messages.push({ role: 'bot', content: finalAnswer });
    session.lastActivity = new Date(); // Update activity time

    // Cleanup otomatis
    cleanupOldSessions();

    // 5. Kirim Response
    res.json({
      success: true,
      reply: finalAnswer,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString(),
      usage: {
        tokensUsed: realTokenUsage,
        policy: 'guest',
        remaining: currentRemaining
      }
    });

  } catch (error) {
    console.error('❌ [GUEST ERROR]', error.message);

    // --- FALLBACK LOGIC ---
    // Jika RAG mati total, switch ke OpenAI direct (tetap pakai history)
    if (error.message.includes('Qdrant') || error.message.includes('fetch')) {
      try {
        // Ambil history lagi (karena scope variabel di atas)
        let fallbackHistory = [];
        if (guestSessions.has(req.body.sessionId)) {
          const msgs = guestSessions.get(req.body.sessionId).messages.slice(-6);
          fallbackHistory = msgs.map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }));
        }

        const fallbackResponse = await generateAIResponse(
          message,
          fallbackHistory,
          null,
          { abortSignal: abortController.signal, mode: 'general' }
        );

        const replyText = typeof fallbackResponse === 'object' ? fallbackResponse.content : fallbackResponse;
        const fallbackUsage = fallbackResponse.usage ? fallbackResponse.usage.total_tokens : 0;

        // Track usage fallback dengan pattern yang sama seperti main flow
        let fallbackRemaining = null;
        if (fallbackUsage > 0) {
          const trackResult = await rateLimitService.trackTokenUsage(null, req.ip, fallbackUsage);
          if (trackResult && trackResult.success) {
            const guestLimits = rateLimitService.getLimits('guest');
            fallbackRemaining = Math.max(0, guestLimits.tokenLimitDaily - trackResult.totalUsage);
          } else {
            const fallbackQuota = await rateLimitService.getQuotaStatus(req.ip, 'guest');
            fallbackRemaining = fallbackQuota.remaining;
          }
        }

        return res.json({
          success: true,
          reply: replyText,
          sessionId: req.body.sessionId || `guest-${Date.now()}`,
          fallback: true,
          usage: {
            tokensUsed: fallbackUsage,
            remaining: fallbackRemaining
          }
        });
      } catch (e) { console.error("Fallback error", e); }
    }

    if (error.message.includes('rate_limit')) {
      return res.status(429).json({ success: false, message: "Terlalu banyak permintaan. Kuota habis." });
    }

    res.status(500).json({ success: false, message: "System Error" });
  }
};

// ... (Helper functions getter/cleanup di bawah tidak perlu diubah, tetap sama) ...
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
        createdAt: session.createdAt || new Date(),
        lastActivity: session.lastActivity,
        ageInMinutes: Math.round((new Date() - (session.createdAt || new Date())) / (1000 * 60))
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
  const MAX_AGE = 2 * 60 * 60 * 1000; // 2 Jam
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