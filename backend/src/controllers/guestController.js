const ragService = require('../services/ragService');
const rateLimitService = require('../services/rateLimitService');
const { generateAIResponse } = require('../services/openaiService');
const redisService = require('../services/redisService');

// In-memory storage untuk Guest
const guestSessions = new Map();

const guestChat = async (req, res) => {
  const abortController = new AbortController();
  const { message, sessionId, stream = true } = req.body; // Default stream: true
  const ipAddress = req.ip || '127.0.0.1';

  // 🛑 Listener untuk pembatalan
  req.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, message: "Message required" });
  }

  const currentSessionId = sessionId || `guest-${Date.now()}`;
  console.log(`👤 [GUEST] Chat from IP: ${ipAddress} | Stream: ${stream}`);

  try {
    // 1. Prepare History
    let conversationHistory = [];
    if (guestSessions.has(currentSessionId)) {
      const session = guestSessions.get(currentSessionId);
      conversationHistory = session.messages.slice(-6).map(msg => ({
        role: msg.role === 'bot' ? 'assistant' : 'user',
        content: msg.content
      }));
    }

    // 2. Call RAG Service
    const ragResult = await ragService.answerQuestion(
      message,
      conversationHistory,
      { abortSignal: abortController.signal, stream: stream }
    );

    // =================================================================
    // A. STREAMING HANDLER
    // =================================================================
    if (stream && ragResult.isStream) {

      // Set Headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullAnswer = "";
      let tokenUsage = 0;

      // Send Initial Data (Docs Info)
      res.write(`data: ${JSON.stringify({ type: 'meta', docs: ragResult.docsDetail })}\n\n`);

      try {
        for await (const chunk of ragResult.stream) {
          const content = chunk.choices[0]?.delta?.content || "";

          if (content) {
            fullAnswer += content;
            res.write(`data: ${JSON.stringify({ type: 'content', chunk: content })}\n\n`);
          }

          // Beberapa provider mengirim usage di chunk terakhir
          if (chunk.usage) {
            tokenUsage = chunk.usage.total_tokens;
          }
        }
      } catch (streamError) {
        console.error("Stream interrupted", streamError);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`);
      }

      // Estimate Usage if not provided
      if (!tokenUsage) {
        tokenUsage = Math.ceil((message.length + fullAnswer.length) / 4) + 100;
      }

      // ✅ FIX: Calculate remaining tokens real-time for UI
      let remainingTokens = null;
      let limitTokens = null;
      try {
        const quota = await rateLimitService.getQuotaStatus(ipAddress, 'guest');
        remainingTokens = Math.max(0, quota.remaining - tokenUsage);
        limitTokens = quota.limit;
      } catch (e) { }

      // Finalize Request
      res.write(`data: ${JSON.stringify({
        type: 'done',
        usage: tokenUsage,
        remaining: remainingTokens,
        limit: limitTokens
      })}\n\n`);
      res.end();

      // Post-Processing (Async): Save Session & Rate Limit
      await handlePostChat(currentSessionId, message, fullAnswer, ipAddress, tokenUsage, ragResult.cacheKey);
      return;
    }

    // =================================================================
    // B. NON-STREAMING FALLBACK (JSON)
    // =================================================================

    // Send JSON Response
    const finalAnswer = ragResult.answer;
    const realTokenUsage = ragResult.usage ? ragResult.usage.total_tokens : 0;

    res.json({
      success: true,
      reply: finalAnswer,
      sessionId: currentSessionId,
      usage: { tokensUsed: realTokenUsage }
    });

    await handlePostChat(currentSessionId, message, finalAnswer, ipAddress, realTokenUsage);

  } catch (error) {
    console.error('❌ [GUEST ERROR]', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "System Error" });
    } else {
      res.end(); // Close stream if error occurs mid-stream
    }
  }
};

// Helper: Save Session & Track Usage
async function handlePostChat(sessionId, userMsg, botMsg, ip, usage, cacheKey = null) {
  try {
    // 1. Save Session
    if (!guestSessions.has(sessionId)) {
      guestSessions.set(sessionId, { messages: [], createdAt: new Date(), lastActivity: new Date() });
    }
    const session = guestSessions.get(sessionId);
    session.messages.push({ role: 'user', content: userMsg });
    session.messages.push({ role: 'bot', content: botMsg });
    session.lastActivity = new Date();

    // 2. Track Usage
    if (usage > 0) {
      await rateLimitService.trackTokenUsage(null, ip, usage);
    }

    // 3. Cache the full result (If streaming, we construct the cache object manually here)
    if (cacheKey && botMsg) {
      const cachePayload = {
        answer: botMsg,
        usage: { total_tokens: usage },
        docsFound: 0 // We don't have docs info easily here without passing it down, but it's optional for cache display
      };
      //  await redisService.set(cacheKey, cachePayload, 3600 * 6); 
      // Note: Caching streamed response is tricky because we need the docs info too. 
      // For now, we skip caching streamed responses or accept we lose docs info in cache.
    }

  } catch (e) {
    console.error("Post Chat Error:", e.message);
  }
}

// ... (Rest of the controller methods: getGuestConversation, etc. - UNCHANGED) ...
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