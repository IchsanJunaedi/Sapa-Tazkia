// backend/src/controllers/guestController.js
const ragService = require('../services/ragService');
const rateLimitService = require('../services/rateLimitService');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');

const GUEST_SESSION_PREFIX = 'guest:session:';
const GUEST_SESSION_TTL = 86400; // 24 hours

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getSession(sessionId) {
  const raw = await redisService.get(`${GUEST_SESSION_PREFIX}${sessionId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveSession(sessionId, session) {
  await redisService.set(
    `${GUEST_SESSION_PREFIX}${sessionId}`,
    JSON.stringify(session),
    GUEST_SESSION_TTL
  );
}

// ─── Controllers ───────────────────────────────────────────────────────────

const guestChat = async (req, res) => {
  const abortController = new AbortController();
  const { message, sessionId, stream = true } = req.body;
  const ipAddress = req.ip || '127.0.0.1';

  req.on('close', () => {
    if (!res.writableEnded) abortController.abort();
  });

  if (!message || message.trim() === '') {
    return res.status(400).json({ success: false, message: 'Message required' });
  }

  const currentSessionId = sessionId || `guest-${Date.now()}`;
  logger.info(`[GUEST] Chat from IP: ${ipAddress} | Stream: ${stream}`);

  try {
    // 1. Load history from Redis
    const existingSession = await getSession(currentSessionId);
    const conversationHistory = existingSession
      ? existingSession.messages.slice(-6).map(msg => ({
          role: msg.role === 'bot' ? 'assistant' : 'user',
          content: msg.content
        }))
      : [];

    // 2. Call RAG Service
    const ragResult = await ragService.answerQuestion(
      message,
      conversationHistory,
      { abortSignal: abortController.signal, stream }
    );

    // ─── A. STREAMING ──────────────────────────────────────────────────────
    if (stream && ragResult.isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullAnswer = '';
      let tokenUsage = 0;

      res.write(`data: ${JSON.stringify({ type: 'meta', docs: ragResult.docsDetail })}\n\n`);

      try {
        for await (const chunk of ragResult.stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            fullAnswer += content;
            res.write(`data: ${JSON.stringify({ type: 'content', chunk: content })}\n\n`);
          }
          if (chunk.usage) tokenUsage = chunk.usage.total_tokens;
        }
      } catch (streamError) {
        logger.error('Stream interrupted', streamError.message);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`);
      }

      if (!tokenUsage) {
        tokenUsage = Math.ceil((message.length + fullAnswer.length) / 4) + 100;
      }

      let remainingTokens = null;
      let limitTokens = null;
      try {
        const quota = await rateLimitService.getQuotaStatus(ipAddress, 'guest');
        remainingTokens = Math.max(0, quota.remaining - tokenUsage);
        limitTokens = quota.limit;
      } catch (_) {}

      res.write(`data: ${JSON.stringify({ type: 'done', usage: tokenUsage, remaining: remainingTokens, limit: limitTokens })}\n\n`);
      res.end();

      // NOTE: cacheKey intentionally omitted — the original code had this commented out
      // (the cache write inside handlePostChat was already disabled). Removing it
      // simplifies the signature with no functional change.
      await handlePostChat(currentSessionId, message, fullAnswer, ipAddress, tokenUsage);
      return;
    }

    // ─── B. NON-STREAMING ──────────────────────────────────────────────────
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
    logger.error('[GUEST ERROR]', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'System Error' });
    } else {
      res.end();
    }
  }
};

async function handlePostChat(sessionId, userMsg, botMsg, ip, usage) {
  try {
    const existing = await getSession(sessionId) || {
      messages: [],
      ip,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    existing.messages.push({ role: 'user', content: userMsg });
    existing.messages.push({ role: 'bot', content: botMsg, tokenUsage: usage });
    existing.lastActivity = new Date().toISOString();

    await saveSession(sessionId, existing);

    if (usage > 0) {
      await rateLimitService.trackTokenUsage(null, ip, usage);
    }
  } catch (e) {
    logger.error('Post Chat Error:', e.message);
  }
}

const getGuestConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);
    if (!session) return res.json({ success: true, messages: [] });
    res.json({ success: true, messages: session.messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error getting conversation' });
  }
};

const getGuestSessionInfo = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    res.json({
      success: true,
      data: {
        sessionId,
        messageCount: session.messages.length,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        ageInMinutes: Math.round((Date.now() - new Date(session.createdAt).getTime()) / (1000 * 60))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error info' });
  }
};

const clearGuestSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await redisService.del(`${GUEST_SESSION_PREFIX}${sessionId}`);
    res.json({ success: true, message: 'Cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error clearing' });
  }
};

/**
 * Returns all active guest sessions from Redis.
 * Used by adminController.getChatLogs.
 * Returns array of { sessionId, session } objects.
 */
const getAllActiveSessions = async () => {
  try {
    const keys = await redisService.keys(`${GUEST_SESSION_PREFIX}*`);
    const sessions = [];
    for (const key of keys) {
      const raw = await redisService.get(key);
      if (raw) {
        try {
          const session = JSON.parse(raw);
          const sessionId = key.replace(GUEST_SESSION_PREFIX, '');
          sessions.push({ sessionId, session });
        } catch (_) {}
      }
    }
    return sessions;
  } catch (e) {
    logger.error('getAllActiveSessions error:', e.message);
    return [];
  }
};

module.exports = {
  guestChat,
  getGuestConversation,
  getGuestSessionInfo,
  clearGuestSession,
  getAllActiveSessions
};
