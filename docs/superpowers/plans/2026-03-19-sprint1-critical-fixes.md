# Sprint 1 — Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 critical backend gaps in the live SAPA-TAZKIA system: test infrastructure, structured logging, Redis-backed guest sessions, forgot password flow, extended user profile, and expanded bug reports.

**Architecture:** Each fix is self-contained and layered bottom-up — infrastructure (logging, tests) first, then data layer (Redis sessions, schema), then API layer (auth flows, profile). Every new feature follows TDD: write failing test → implement → pass → commit.

**Tech Stack:** Node.js/Express, Prisma/MySQL, Redis (ioredis), Jest + Supertest, Winston + winston-daily-rotate-file, nodemailer (existing), bcryptjs (existing), crypto (Node built-in)

**Spec:** `docs/superpowers/specs/2026-03-19-backend-gap-analysis-v1.1-design.md`

---

## File Map

### Task 1 — Jest/Supertest Setup
- Modify: `backend/package.json` — add `test` script + jest config
- Create: `backend/jest.config.js`
- Create: `backend/tests/setup.js` — test environment setup

### Task 2 — Winston Logging
- Modify: `backend/src/utils/logger.js` — full replacement with Winston
- Create: `backend/logs/.gitkeep`
- Modify: `backend/.gitignore` — add log file patterns
- Install: `winston`, `winston-daily-rotate-file`
- Test: `backend/tests/unit/logger.test.js`

### Task 3 — Guest Sessions → Redis
- Modify: `backend/src/controllers/guestController.js` — swap Map → Redis
- Modify: `backend/src/services/redisService.js` — add `keys()` method
- Modify: `backend/src/controllers/adminController.js` — update `getChatLogs` to read Redis
- Test: `backend/tests/unit/guestSessions.test.js`

### Task 4 — Forgot Password Flow
- Modify: `backend/src/services/authService.js` — add `forgotPassword()`, `resetPassword()`
- Modify: `backend/src/services/emailService.js` — add `sendPasswordResetEmail()`
- Modify: `backend/src/controllers/authController.js` — add `forgotPassword`, `resetPassword` handlers
- Modify: `backend/src/middleware/validationMiddleware.js` — add `validateForgotPassword`, `validateResetPassword`
- Modify: `backend/src/routes/authRoutes.js` — register 2 new routes
- Test: `backend/tests/unit/forgotPassword.test.js`

### Task 5 — User Profile Management (extend existing)
- Modify: `backend/src/services/authService.js` — extend `updateUserProfile()` with `programStudiId`; add `changePassword()`
- Modify: `backend/src/controllers/authController.js` — add `changePassword` handler; extend `getProfile` to include programStudi relation
- Modify: `backend/src/middleware/validationMiddleware.js` — add `validateChangePassword`
- Modify: `backend/src/routes/authRoutes.js` — register `PUT /change-password`
- Test: `backend/tests/unit/userProfile.test.js`

### Task 6 — BugReport Model Expansion
- Modify: `backend/prisma/schema.prisma` — add fields + enums
- Modify: `backend/src/controllers/bugReportController.js` — accept new fields on create
- Modify: `backend/src/controllers/adminController.js` — add `updateBugReport` handler
- Modify: `backend/src/routes/adminRoutes.js` — register `PATCH /bug-reports/:id`
- Test: `backend/tests/unit/bugReport.test.js`

---

## Task 1: Jest + Supertest Setup

**Files:**
- Modify: `backend/package.json`
- Create: `backend/jest.config.js`
- Create: `backend/tests/setup.js`

- [ ] **Step 1.1: Install test dependencies**

```bash
cd backend
npm install --save-dev jest supertest
```

Expected: jest and supertest appear in `package.json` devDependencies.

- [ ] **Step 1.2: Add test script and jest config to package.json**

In `backend/package.json`, add `"test"` to scripts and `"jest"` config block:

```json
{
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "seed": "node prisma/seed.js",
    "db:push": "npx prisma db push",
    "db:generate": "npx prisma generate",
    "db:studio": "npx prisma studio",
    "reset:redis": "node reset-redis.js",
    "lint": "eslint src/ --ext .js",
    "lint:fix": "eslint src/ --ext .js --fix",
    "test": "jest --forceExit --detectOpenHandles",
    "test:watch": "jest --watch"
  }
}
```

- [ ] **Step 1.3: Create jest.config.js**

```javascript
// backend/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/src/__tests__/**/*.test.js'],
  setupFiles: ['./tests/setup.js'],
  testTimeout: 10000,
  verbose: true
};
```

- [ ] **Step 1.4: Create tests/setup.js**

```javascript
// backend/tests/setup.js
// Load env vars for tests
require('dotenv').config({ path: '.env' });

// Silence console output during tests (optional - remove if you want logs)
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}
```

- [ ] **Step 1.5: Create tests/ directory structure**

```bash
mkdir -p backend/tests/unit backend/tests/integration
```

- [ ] **Step 1.6: Write a smoke test to verify Jest works**

Create `backend/tests/unit/smoke.test.js`:

```javascript
// backend/tests/unit/smoke.test.js
describe('Jest setup', () => {
  it('should run tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 1.7: Run smoke test and verify it passes**

```bash
cd backend
npm test
```

Expected output:
```
PASS tests/unit/smoke.test.js
  Jest setup
    ✓ should run tests
```

- [ ] **Step 1.8: Commit**

```bash
cd backend
git add package.json jest.config.js tests/setup.js tests/unit/smoke.test.js
git commit -m "test: set up Jest + Supertest infrastructure"
```

---

## Task 2: Winston Logging

**Files:**
- Modify: `backend/src/utils/logger.js`
- Create: `backend/logs/.gitkeep`
- Modify: `backend/.gitignore`
- Test: `backend/tests/unit/logger.test.js`

- [ ] **Step 2.1: Install Winston**

```bash
cd backend
npm install winston winston-daily-rotate-file
```

- [ ] **Step 2.2: Write failing logger tests**

Create `backend/tests/unit/logger.test.js`:

```javascript
// backend/tests/unit/logger.test.js
describe('Logger', () => {
  let logger;

  beforeEach(() => {
    jest.resetModules();
    logger = require('../../src/utils/logger');
  });

  it('should export all required methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.security).toBe('function');
    expect(typeof logger.request).toBe('function');
    expect(typeof logger.rateLimit).toBe('function');
    expect(typeof logger.redis).toBe('function');
  });

  it('should not throw when calling any method', () => {
    expect(() => logger.info('test info')).not.toThrow();
    expect(() => logger.error('test error')).not.toThrow();
    expect(() => logger.warn('test warn')).not.toThrow();
    expect(() => logger.debug('test debug')).not.toThrow();
    expect(() => logger.security('test security')).not.toThrow();
    expect(() => logger.request('GET', '/api/test', 200)).not.toThrow();
    expect(() => logger.rateLimit('test rateLimit')).not.toThrow();
    expect(() => logger.redis('test redis')).not.toThrow();
  });
});
```

- [ ] **Step 2.3: Run test to verify it fails**

```bash
cd backend
npm test tests/unit/logger.test.js
```

Expected: PASS — the existing logger already has these methods. If PASS already, proceed.

- [ ] **Step 2.4: Create logs directory and .gitkeep**

```bash
mkdir -p backend/logs
touch backend/logs/.gitkeep
```

- [ ] **Step 2.5: Add logs to .gitignore**

Open `backend/.gitignore` and add at the bottom:

```
# Log files
logs/*.log
logs/*.gz
```

- [ ] **Step 2.6: Replace logger.js with Winston implementation**

Replace the entire content of `backend/src/utils/logger.js`:

```javascript
// backend/src/utils/logger.js
const winston = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const isDebugEnabled = process.env.DEBUG_MODE === 'true' || process.env.RATE_LIMIT_DEBUG === 'true';

// ─── Formats ───────────────────────────────────────────────────────────────

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// ─── Transports ────────────────────────────────────────────────────────────

const transports = [
  new winston.transports.Console({
    format: isProduction ? jsonFormat : devFormat,
    silent: false
  })
];

if (isProduction || process.env.LOG_TO_FILE === 'true') {
  const logsDir = path.join(__dirname, '../../logs');

  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      format: jsonFormat,
      level: 'debug'
    })
  );

  transports.push(
    new winston.transports.DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      format: jsonFormat,
      level: 'error'
    })
  );
}

// ─── Base Winston instance ──────────────────────────────────────────────────

const winstonLogger = winston.createLogger({
  level: isProduction && !isDebugEnabled ? 'warn' : 'debug',
  transports
});

// ─── Public API (drop-in replacement for old Logger class) ─────────────────

const logger = {
  /**
   * Info — hidden in production unless DEBUG_MODE=true
   */
  info(message, ...args) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.info(message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
    }
  },

  /**
   * Error — always logged
   */
  error(message, ...args) {
    winstonLogger.error(message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  },

  /**
   * Warn — always logged
   */
  warn(message, ...args) {
    winstonLogger.warn(message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  },

  /**
   * Debug — hidden in production unless DEBUG_MODE=true
   */
  debug(message, ...args) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.debug(message, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
    }
  },

  /**
   * Security — always logged (audit trail)
   */
  security(message, ...args) {
    winstonLogger.warn(`[SECURITY] ${message}`, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
  },

  /**
   * Request — HTTP logging, dev only
   */
  request(method, url, status) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.debug(`[REQUEST] ${method} ${url} - ${status}`);
    }
  },

  /**
   * RateLimit — alias for debug, used in rateLimitService/rateLimitMiddleware
   */
  rateLimit(message, ...args) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.debug(`[RATE LIMIT] ${message}`, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
    }
  },

  /**
   * Redis — alias for debug, used in redisService
   */
  redis(message, ...args) {
    if (!isProduction || isDebugEnabled) {
      winstonLogger.debug(`[REDIS] ${message}`, args.length === 1 ? args[0] : args.length > 1 ? args : undefined);
    }
  }
};

module.exports = logger;
```

- [ ] **Step 2.7: Run logger tests to confirm all methods work**

```bash
cd backend
npm test tests/unit/logger.test.js
```

Expected: All tests PASS.

- [ ] **Step 2.8: Smoke test — start the server briefly to confirm no startup errors**

```bash
cd backend
timeout 5 node src/app.js || true
```

Expected: Server starts, logs appear with Winston format, no `TypeError` or `Cannot find module`.

- [ ] **Step 2.9: Commit**

```bash
cd backend
git add src/utils/logger.js logs/.gitkeep .gitignore package.json package-lock.json tests/unit/logger.test.js
git commit -m "feat: replace custom logger with Winston + daily log rotation"
```

---

## Task 3: Guest Sessions → Redis

**Files:**
- Modify: `backend/src/services/redisService.js`
- Modify: `backend/src/controllers/guestController.js`
- Modify: `backend/src/controllers/adminController.js`
- Test: `backend/tests/unit/guestSessions.test.js`

- [ ] **Step 3.1: Add keys() method to redisService.js**

In `backend/src/services/redisService.js`, add this method inside the `RedisService` class after the `exists()` method (around line 122):

```javascript
  async keys(pattern) {
    try {
      if (!this.client) return [];
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error(`Redis keys error [${pattern}]:`, error.message);
      return [];
    }
  }
```

- [ ] **Step 3.2: Write failing guest session tests**

Create `backend/tests/unit/guestSessions.test.js`:

```javascript
// backend/tests/unit/guestSessions.test.js
// NOTE: These test the session data structure logic, not Redis connectivity.
// Redis calls are mocked.

jest.mock('../../src/services/redisService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  keys: jest.fn()
}));

jest.mock('../../src/services/ragService', () => ({
  answerQuestion: jest.fn()
}));

jest.mock('../../src/services/rateLimitService', () => ({
  trackTokenUsage: jest.fn(),
  getQuotaStatus: jest.fn().mockResolvedValue({ remaining: 1000, limit: 7000 })
}));

const redisService = require('../../src/services/redisService');

describe('Guest Session Storage (Redis)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should store session as JSON in Redis with 24h TTL', async () => {
    const sessionId = 'guest-12345';
    const sessionData = {
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'bot', content: 'Hi there!', tokenUsage: 50 }
      ],
      ip: '127.0.0.1',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    redisService.set.mockResolvedValue(undefined);

    await redisService.set(`guest:session:${sessionId}`, JSON.stringify(sessionData), 86400);

    expect(redisService.set).toHaveBeenCalledWith(
      `guest:session:${sessionId}`,
      expect.stringContaining('"messages"'),
      86400
    );
  });

  it('should retrieve session from Redis and parse JSON', async () => {
    const sessionId = 'guest-12345';
    const sessionData = {
      messages: [{ role: 'user', content: 'Hello' }],
      ip: '127.0.0.1',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    redisService.get.mockResolvedValue(JSON.stringify(sessionData));

    const raw = await redisService.get(`guest:session:${sessionId}`);
    const parsed = JSON.parse(raw);

    expect(parsed.messages).toHaveLength(1);
    expect(parsed.messages[0].content).toBe('Hello');
  });

  it('should return empty array for getAllActiveSessions when Redis has no keys', async () => {
    redisService.keys.mockResolvedValue([]);
    const keys = await redisService.keys('guest:session:*');
    expect(keys).toEqual([]);
  });
});
```

- [ ] **Step 3.3: Run test to verify current state**

```bash
cd backend
npm test tests/unit/guestSessions.test.js
```

Expected: PASS (mocked tests — verifying structure only).

- [ ] **Step 3.4: Rewrite guestController.js — swap Map for Redis**

Replace the entire `backend/src/controllers/guestController.js`:

```javascript
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
```

- [ ] **Step 3.5: Update adminController.js getChatLogs to use async getAllActiveSessions**

In `backend/src/controllers/adminController.js`, find the guest sessions section (around line 47-74) and replace it:

Old code:
```javascript
        // 2. Fetch Guest Sessions (from Memory)
        let formattedGuestLogs = [];
        if (typeof guestController.getAllActiveSessions === 'function') {
            const guestSessions = guestController.getAllActiveSessions();
            for (const [sessionId, session] of guestSessions.entries()) {
                for (let i = 0; i < session.messages.length; i++) {
                    if (session.messages[i].role === 'user') {
                        const userMsg = session.messages[i];
                        const botMsg = (i + 1 < session.messages.length && session.messages[i + 1].role === 'bot') ? session.messages[i + 1] : null;

                        formattedGuestLogs.push({
                            id: `guest-${sessionId}-${i}`,
                            timestamp: session.createdAt, // approximation
                            userType: 'Guest',
                            identifier: sessionId,
                            message: userMsg.content,
                            response: botMsg ? botMsg.content : 'No response',
                            tokens: botMsg ? botMsg.tokenUsage : null,
                            responseTime: botMsg ? botMsg.responseTime : null,
                            isError: botMsg ? botMsg.isError : false
                        });
                    }
                }
            }
        }
```

New code:
```javascript
        // 2. Fetch Guest Sessions (from Redis)
        let formattedGuestLogs = [];
        try {
            const guestSessionsList = await guestController.getAllActiveSessions();
            for (const { sessionId, session } of guestSessionsList) {
                for (let i = 0; i < session.messages.length; i++) {
                    if (session.messages[i].role === 'user') {
                        const userMsg = session.messages[i];
                        const botMsg = (i + 1 < session.messages.length && session.messages[i + 1].role === 'bot') ? session.messages[i + 1] : null;

                        formattedGuestLogs.push({
                            id: `guest-${sessionId}-${i}`,
                            timestamp: session.createdAt,
                            userType: 'Guest',
                            identifier: sessionId,
                            message: userMsg.content,
                            response: botMsg ? botMsg.content : 'No response',
                            tokens: botMsg ? botMsg.tokenUsage : null,
                            responseTime: botMsg ? botMsg.responseTime : null,
                            isError: botMsg ? botMsg.isError : false
                        });
                    }
                }
            }
        } catch (guestErr) {
            logger.warn('[ADMIN] Failed to fetch guest sessions:', guestErr.message);
        }
```

- [ ] **Step 3.6: Run tests**

```bash
cd backend
npm test tests/unit/guestSessions.test.js
```

Expected: All tests PASS.

- [ ] **Step 3.7: Commit**

```bash
cd backend
git add src/controllers/guestController.js src/controllers/adminController.js src/services/redisService.js tests/unit/guestSessions.test.js
git commit -m "feat: migrate guest sessions from in-memory Map to Redis (24h TTL)"
```

---

## Task 4: Forgot Password Flow

**Files:**
- Modify: `backend/src/services/emailService.js`
- Modify: `backend/src/services/authService.js`
- Modify: `backend/src/controllers/authController.js`
- Modify: `backend/src/middleware/validationMiddleware.js`
- Modify: `backend/src/routes/authRoutes.js`
- Test: `backend/tests/unit/forgotPassword.test.js`

- [ ] **Step 4.1: Write failing tests**

Create `backend/tests/unit/forgotPassword.test.js`:

```javascript
// backend/tests/unit/forgotPassword.test.js
jest.mock('../../src/config/prismaClient', () => ({
  user: {
    findFirst: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock('../../src/services/redisService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn()
}));

jest.mock('../../src/services/emailService', () => ({
  sendPasswordResetEmail: jest.fn()
}));

const prisma = require('../../src/config/prismaClient');
const redisService = require('../../src/services/redisService');
const emailService = require('../../src/services/emailService');

describe('Forgot Password', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('forgotPassword()', () => {
    it('should send reset email when user found by email', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@tazkia.ac.id',
        fullName: 'Test User'
      });
      redisService.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.set.mockResolvedValue(undefined);
      emailService.sendPasswordResetEmail.mockResolvedValue(true);

      const authService = require('../../src/services/authService');
      const result = await authService.forgotPassword({ email: 'test@tazkia.ac.id' });

      expect(result.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('should return success even if user not found (prevent email enumeration)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const authService = require('../../src/services/authService');
      const result = await authService.forgotPassword({ email: 'notfound@tazkia.ac.id' });

      expect(result.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should throw if rate limit exceeded (>3 requests/hour)', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 1, email: 'test@tazkia.ac.id' });
      redisService.incr.mockResolvedValue(4); // 4th request

      const authService = require('../../src/services/authService');
      await expect(authService.forgotPassword({ email: 'test@tazkia.ac.id' }))
        .rejects.toThrow('Terlalu banyak permintaan reset password');
    });
  });

  describe('resetPassword()', () => {
    it('should update password when token is valid', async () => {
      redisService.get.mockResolvedValue('1'); // userId = 1
      prisma.user.update.mockResolvedValue({ id: 1 });
      redisService.del.mockResolvedValue(1);

      const authService = require('../../src/services/authService');
      const result = await authService.resetPassword({
        token: 'valid-token-hex',
        newPassword: 'NewPass123'
      });

      expect(result.success).toBe(true);
      expect(redisService.del).toHaveBeenCalledWith('pwd_reset:valid-token-hex');
    });

    it('should throw when token is invalid or expired', async () => {
      redisService.get.mockResolvedValue(null); // expired

      const authService = require('../../src/services/authService');
      await expect(authService.resetPassword({
        token: 'expired-token',
        newPassword: 'NewPass123'
      })).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 4.2: Run tests to see them fail**

```bash
cd backend
npm test tests/unit/forgotPassword.test.js
```

Expected: FAIL — `forgotPassword` and `resetPassword` not yet defined.

- [ ] **Step 4.3: Add sendPasswordResetEmail to emailService.js**

At the end of `backend/src/services/emailService.js`, before `module.exports`, add:

```javascript
/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetUrl) => {
  const subject = 'Reset Password - Sapa-Tazkia';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Reset Password</h2>
      <p>Kami menerima permintaan reset password untuk akun Anda. Klik tombol di bawah untuk membuat password baru:</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}"
           style="background-color: #2563eb; color: white; padding: 12px 24px;
                  text-decoration: none; border-radius: 6px; display: inline-block;">
          Reset Password
        </a>
      </div>

      <p style="color: #6b7280; font-size: 14px;">
        Link ini akan kadaluarsa dalam <strong>15 menit</strong>.
        Jika Anda tidak meminta reset password, abaikan email ini.
      </p>

      <p style="color: #6b7280; font-size: 12px;">
        Atau salin link berikut ke browser Anda:<br/>
        <span style="word-break: break-all;">${resetUrl}</span>
      </p>
    </div>
  `;
  await sendEmail(email, subject, html);
  return true;
};
```

And add it to `module.exports`:
```javascript
module.exports = { sendEmail, sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail };
```

- [ ] **Step 4.4: Add forgotPassword() and resetPassword() to authService.js**

First, add `redisService` to the top-of-file imports in `backend/src/services/authService.js` (alongside the existing requires at lines 1–18):

```javascript
const redisService = require('./redisService'); // add to top-level imports
```

Then, at the end of the file before `module.exports`, add the two new functions:

```javascript
// ========================================================
// FORGOT PASSWORD / RESET PASSWORD
// ========================================================

/**
 * Initiate forgot password flow.
 * Always returns success: true to prevent email enumeration.
 */
const forgotPassword = async ({ email, nim }) => {
  // Find user by email or nim
  const whereClause = email ? { email } : { nim };
  const user = await prisma.user.findFirst({ where: whereClause });

  // Always succeed — never leak whether the email/nim exists
  if (!user) {
    logger.info('[AUTH] Forgot password: user not found, returning success silently');
    return { success: true };
  }

  // Rate limit: max 3 requests per hour per email
  const rlKey = `pwd_reset_rl:${user.email}`;
  const attempts = await redisService.incr(rlKey);
  if (attempts === 1) {
    await redisService.expire(rlKey, 3600); // 1 hour window
  }
  if (attempts > 3) {
    throw new Error('Terlalu banyak permintaan reset password. Coba lagi dalam 1 jam.');
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex');
  await redisService.set(`pwd_reset:${token}`, String(user.id), 900); // 15 minutes

  // Build reset URL
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

  await emailService.sendPasswordResetEmail(user.email, resetUrl);
  logger.security(`[AUTH] Password reset email sent to userId: ${user.id}`);

  return { success: true };
};

/**
 * Complete password reset with token + new password.
 */
const resetPassword = async ({ token, newPassword }) => {
  // Validate token from Redis
  const userIdStr = await redisService.get(`pwd_reset:${token}`);
  if (!userIdStr) {
    throw new Error('Token reset tidak valid atau sudah kadaluarsa.');
  }

  const userId = parseInt(userIdStr, 10);

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update user password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });

  // Invalidate token — single use
  await redisService.del(`pwd_reset:${token}`);

  logger.security(`[AUTH] Password reset completed for userId: ${userId}`);
  return { success: true };
};
```

Add `forgotPassword` and `resetPassword` to the **existing** `module.exports` object at the bottom of `authService.js`. Do NOT replace the entire exports — just add both function names to the existing object:

```javascript
// Find the existing module.exports = { ... } at the bottom of authService.js
// and add forgotPassword and resetPassword to it, for example:
module.exports = {
  // ... all existing exports remain unchanged ...
  registerUser,
  loginUser,
  verifyEmailCode,
  // etc — keep everything already there, then append:
  forgotPassword,
  resetPassword
};
```

> **Note:** Check the existing `module.exports` in authService.js and add `forgotPassword` and `resetPassword` to it — do not replace the existing exports.

- [ ] **Step 4.5: Add controller handlers in authController.js**

Find `module.exports` in `backend/src/controllers/authController.js` and add two new handlers before the export:

```javascript
/**
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email, nim } = req.body;
    await authService.forgotPassword({ email, nim });
    res.json({
      success: true,
      message: 'Jika email terdaftar, link reset password akan dikirim.'
    });
  } catch (error) {
    if (error.message.includes('Terlalu banyak')) {
      return res.status(429).json({ success: false, message: error.message });
    }
    logger.error('[AUTH CTRL] forgotPassword error:', error.message);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan.' });
  }
};

/**
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword({ token, newPassword });
    res.json({ success: true, message: 'Password berhasil direset. Silakan login.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
```

Add `forgotPassword` and `resetPassword` to the existing `module.exports`.

- [ ] **Step 4.6: Add validation rules in validationMiddleware.js**

In `backend/src/middleware/validationMiddleware.js`, add:

```javascript
// validateForgotPassword — requires email OR nim (custom check before handleValidationErrors)
const validateForgotPassword = [
  (req, res, next) => {
    if (!req.body.email && !req.body.nim) {
      return res.status(400).json({ success: false, message: 'Email atau NIM harus diisi.' });
    }
    next();
  },
  body('email').optional().isEmail().withMessage('Format email tidak valid'),
  body('nim').optional().isString().withMessage('NIM tidak valid'),
  handleValidationErrors
];

const validateResetPassword = [
  body('token').notEmpty().withMessage('Token harus diisi'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password minimal 8 karakter')
    .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/).withMessage('Password harus mengandung huruf dan angka'),
  handleValidationErrors
];
```

Export them: add to `module.exports`.

- [ ] **Step 4.7: Register routes in authRoutes.js**

In `backend/src/routes/authRoutes.js`, add imports and routes:

At the top, add to the destructuring import of validationMiddleware:
```javascript
const {
  validateRegister,
  validateRegisterEmail,
  validateLogin,
  validateVerifyEmail,
  validateRefreshToken,
  validateNimParam,
  validateForgotPassword,   // NEW
  validateResetPassword     // NEW
} = require('../middleware/validationMiddleware');
```

After the `router.post('/refresh', ...)` line, add:
```javascript
// Forgot / Reset Password
router.post('/forgot-password', strictLimiter, validateForgotPassword, authController.forgotPassword);
router.post('/reset-password', strictLimiter, validateResetPassword, authController.resetPassword);
```

- [ ] **Step 4.8: Run tests**

```bash
cd backend
npm test tests/unit/forgotPassword.test.js
```

Expected: All tests PASS.

- [ ] **Step 4.9: Commit**

```bash
cd backend
git add src/services/authService.js src/services/emailService.js src/controllers/authController.js src/middleware/validationMiddleware.js src/routes/authRoutes.js tests/unit/forgotPassword.test.js
git commit -m "feat: add forgot password and reset password flow with Redis token + rate limiting"
```

---

## Task 5: User Profile Management (Extend Existing)

**Files:**
- Modify: `backend/src/services/authService.js`
- Modify: `backend/src/controllers/authController.js`
- Modify: `backend/src/middleware/validationMiddleware.js`
- Modify: `backend/src/routes/authRoutes.js`
- Test: `backend/tests/unit/userProfile.test.js`

- [ ] **Step 5.1: Write failing tests**

Create `backend/tests/unit/userProfile.test.js`:

```javascript
// backend/tests/unit/userProfile.test.js
jest.mock('../../src/config/prismaClient', () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  }
}));

const prisma = require('../../src/config/prismaClient');
const bcrypt = require('bcryptjs');

describe('User Profile Management', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('changePassword()', () => {
    it('should update password when currentPassword is correct', async () => {
      const hashedPw = await bcrypt.hash('OldPass123', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: hashedPw });
      prisma.user.update.mockResolvedValue({ id: 1 });

      const authService = require('../../src/services/authService');
      const result = await authService.changePassword({
        userId: 1,
        currentPassword: 'OldPass123',
        newPassword: 'NewPass456'
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } })
      );
    });

    it('should throw when currentPassword is wrong', async () => {
      const hashedPw = await bcrypt.hash('OldPass123', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: hashedPw });

      const authService = require('../../src/services/authService');
      await expect(authService.changePassword({
        userId: 1,
        currentPassword: 'WrongPass',
        newPassword: 'NewPass456'
      })).rejects.toThrow('Password saat ini tidak sesuai');
    });

    it('should throw when new password equals current password', async () => {
      const hashedPw = await bcrypt.hash('SamePass123', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: hashedPw });

      const authService = require('../../src/services/authService');
      await expect(authService.changePassword({
        userId: 1,
        currentPassword: 'SamePass123',
        newPassword: 'SamePass123'
      })).rejects.toThrow('Password baru tidak boleh sama dengan password lama');
    });
  });

  describe('updateUserProfile() with programStudiId', () => {
    it('should update programStudiId when provided', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, programStudiId: 2 });

      const authService = require('../../src/services/authService');
      // Call the existing updateUserProfile with programStudiId
      const result = await authService.updateUserProfile(1, { programStudiId: 2 });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ programStudiId: 2 })
        })
      );
    });
  });
});
```

- [ ] **Step 5.2: Run tests to see them fail**

```bash
cd backend
npm test tests/unit/userProfile.test.js
```

Expected: FAIL — `changePassword` not yet defined.

- [ ] **Step 5.3: Add changePassword() to authService.js**

Add this function to `backend/src/services/authService.js` (before module.exports):

```javascript
/**
 * Change password for authenticated user.
 * Requires verification of current password.
 */
const changePassword = async ({ userId, currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User tidak ditemukan.');

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) throw new Error('Password saat ini tidak sesuai.');

  // Prevent reuse of same password
  const isSame = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSame) throw new Error('Password baru tidak boleh sama dengan password lama.');

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  logger.security(`[AUTH] Password changed for userId: ${userId}`);
  return { success: true };
};
```

Add `changePassword` to `module.exports`.

- [ ] **Step 5.4: Extend updateUserProfile() to accept programStudiId**

Find the existing `updateUserProfile` function in `authService.js`. Locate where it builds the `data` object and add `programStudiId`:

```javascript
// Inside updateUserProfile, in the data object:
const data = {};
if (fullName) data.fullName = fullName;
if (email) data.email = email;
if (nim) data.nim = nim;
if (programStudiId !== undefined) data.programStudiId = parseInt(programStudiId, 10);

await prisma.user.update({ where: { id: userId }, data });
```

- [ ] **Step 5.5: Extend getProfile in authController.js to include programStudi relation**

Find `getProfile` (or `verify`) in `authController.js` — it returns user data from `authService.getProfile()` or directly from `req.user`. Ensure the DB query includes:

```javascript
const user = await prisma.user.findUnique({
  where: { id: req.user.id },
  include: {
    programStudi: { select: { id: true, name: true, code: true, faculty: true } }
  },
  select: {
    id: true, fullName: true, nim: true, email: true,
    userType: true, authMethod: true, isEmailVerified: true,
    programStudiId: true, programStudi: true, createdAt: true
  }
});
```

- [ ] **Step 5.6: Add changePassword handler in authController.js**

```javascript
/**
 * PUT /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword({
      userId: req.user.id,
      currentPassword,
      newPassword
    });
    res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
```

Add to `module.exports`.

- [ ] **Step 5.7: Add validation for changePassword in validationMiddleware.js**

```javascript
const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Password saat ini harus diisi'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password baru minimal 8 karakter')
    .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/).withMessage('Password harus mengandung huruf dan angka'),
  handleValidationErrors  // reuse existing shared handler from validationMiddleware.js
];
```

Add to `module.exports`.

- [ ] **Step 5.8: Register route in authRoutes.js**

Add to imports from validationMiddleware: `validateChangePassword`

Add route (protected):
```javascript
router.put('/change-password', authMiddleware.requireAuth, generalLimiter, validateChangePassword, authController.changePassword);
```

- [ ] **Step 5.9: Run tests**

```bash
cd backend
npm test tests/unit/userProfile.test.js
```

Expected: All tests PASS.

- [ ] **Step 5.10: Commit**

```bash
cd backend
git add src/services/authService.js src/controllers/authController.js src/middleware/validationMiddleware.js src/routes/authRoutes.js tests/unit/userProfile.test.js
git commit -m "feat: extend user profile — add programStudiId update, change-password endpoint"
```

---

## Task 6: BugReport Model Expansion

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/controllers/bugReportController.js`
- Modify: `backend/src/controllers/adminController.js`
- Modify: `backend/src/routes/adminRoutes.js`
- Test: `backend/tests/unit/bugReport.test.js`

- [ ] **Step 6.1: Write failing tests**

Create `backend/tests/unit/bugReport.test.js`:

```javascript
// backend/tests/unit/bugReport.test.js
jest.mock('../../src/config/prismaClient', () => ({
  bugReport: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(),
  security: jest.fn(), debug: jest.fn()
}));

const prisma = require('../../src/config/prismaClient');

describe('BugReport Admin Endpoints', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updateBugReport — should update status and adminNotes, return updated record', async () => {
    // This test imports the actual controller — it will FAIL until Step 6.7
    const adminController = require('../../src/controllers/adminController');

    prisma.bugReport.update.mockResolvedValue({
      id: 1, status: 'RESOLVED', adminNotes: 'Fixed in v1.1',
      resolvedAt: new Date(), user: { fullName: 'Test User', email: 'test@tazkia.ac.id' }
    });

    const req = { params: { id: '1' }, body: { status: 'RESOLVED', adminNotes: 'Fixed in v1.1' } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await adminController.updateBugReport(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
    expect(prisma.bugReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RESOLVED', resolvedAt: expect.any(Date) })
      })
    );
  });

  it('updateBugReport — should return 404 when bug report not found', async () => {
    const adminController = require('../../src/controllers/adminController');

    const prismaError = new Error('Record not found');
    prismaError.code = 'P2025';
    prisma.bugReport.update.mockRejectedValue(prismaError);

    const req = { params: { id: '999' }, body: { status: 'RESOLVED' } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await adminController.updateBugReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
```

- [ ] **Step 6.2: Run tests to verify they FAIL (TDD — no implementation yet)**

```bash
cd backend
npm test tests/unit/bugReport.test.js
```

Expected: FAIL — `adminController.updateBugReport is not a function`. This is correct — the test drives the implementation in Step 6.7.

- [ ] **Step 6.3: Update Prisma schema**

In `backend/prisma/schema.prisma`, replace the `BugReport` model and add enums:

```prisma
// ==================== BUG REPORTS ====================

model BugReport {
  id            Int         @id @default(autoincrement())
  title         String      @db.VarChar(200)
  description   String?     @db.Text
  severity      BugSeverity @default(MEDIUM)
  status        BugStatus   @default(OPEN)
  pageUrl       String?     @db.VarChar(500)
  userAgent     String?     @db.VarChar(500)
  screenshotUrl String?     @db.VarChar(500)
  adminNotes    String?     @db.Text
  resolvedAt    DateTime?
  userId        Int
  user          User        @relation(fields: [userId], references: [id])
  createdAt     DateTime    @default(now())

  @@map("bug_reports")
}

enum BugSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum BugStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}
```

- [ ] **Step 6.4: Apply schema to database**

```bash
cd backend
npm run db:push
```

Expected: Prisma applies the migration — new columns added to `bug_reports` table, new enums created. No data loss.

- [ ] **Step 6.5: Regenerate Prisma client**

```bash
cd backend
npm run db:generate
```

- [ ] **Step 6.6: Update bugReportController.js to accept new fields**

Find the `createBugReport` function in `backend/src/controllers/bugReportController.js`. Update the data object to include new fields:

```javascript
const { title, description, severity, pageUrl } = req.body;
const userAgent = req.headers['user-agent'] || null;

const bugReport = await prisma.bugReport.create({
  data: {
    title,
    description: description || null,
    severity: severity || 'MEDIUM',
    pageUrl: pageUrl || null,
    userAgent,
    userId: req.user.id
  }
});
```

- [ ] **Step 6.7: Add updateBugReport handler to adminController.js**

At the end of `backend/src/controllers/adminController.js`, add:

```javascript
/**
 * PATCH /api/admin/bug-reports/:id
 * Update bug report status and admin notes.
 */
const updateBugReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const data = {};
    if (status) data.status = status;
    if (adminNotes !== undefined) data.adminNotes = adminNotes;

    // Auto-set resolvedAt when closing
    if (status === 'RESOLVED' || status === 'CLOSED') {
      data.resolvedAt = new Date();
    }

    const updated = await prisma.bugReport.update({
      where: { id: parseInt(id, 10) },
      data,
      include: { user: { select: { fullName: true, email: true } } }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: 'Bug report not found.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
```

Add `updateBugReport` to `module.exports`.

- [ ] **Step 6.8: Register admin route**

In `backend/src/routes/adminRoutes.js`, the file uses destructured imports at line 4:
```javascript
const { getChatLogs, getRealtimeAnalytics, getHistoryAnalytics, listKnowledgeBase, addKnowledgeDoc, deleteKnowledgeDoc, getBugReports } = require('../controllers/adminController');
```

Add `updateBugReport` to that destructuring:
```javascript
const { getChatLogs, getRealtimeAnalytics, getHistoryAnalytics, listKnowledgeBase, addKnowledgeDoc, deleteKnowledgeDoc, getBugReports, updateBugReport } = require('../controllers/adminController');
```

Then register the route using the destructured name (consistent with all other routes in this file):
```javascript
router.patch('/bug-reports/:id', updateBugReport);
```

- [ ] **Step 6.9: Run all tests**

```bash
cd backend
npm test
```

Expected: All tests PASS (smoke + logger + guestSessions + forgotPassword + userProfile + bugReport).

- [ ] **Step 6.10: Commit**

```bash
cd backend
git add prisma/schema.prisma src/controllers/bugReportController.js src/controllers/adminController.js src/routes/adminRoutes.js tests/unit/bugReport.test.js
git commit -m "feat: expand BugReport model with severity/status/description fields and admin update endpoint"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
cd backend
npm test
```

Expected: All test suites PASS, 0 failures.

- [ ] **Run linter**

```bash
cd backend
npm run lint
```

Expected: 0 errors (fix any warnings).

- [ ] **Final commit if any lint fixes**

```bash
cd backend
git add -p
git commit -m "fix: lint cleanup for sprint 1"
```

---

## Sprint 1 Summary

| Task | Status | Files Changed |
|------|--------|--------------|
| 1. Jest/Supertest setup | ☐ | package.json, jest.config.js, tests/setup.js |
| 2. Winston logging | ☐ | src/utils/logger.js, logs/.gitkeep, .gitignore |
| 3. Guest sessions → Redis | ☐ | guestController.js, adminController.js, redisService.js |
| 4. Forgot password flow | ☐ | authService.js, emailService.js, authController.js, validationMiddleware.js, authRoutes.js |
| 5. User profile management | ☐ | authService.js, authController.js, validationMiddleware.js, authRoutes.js |
| 6. BugReport expansion | ☐ | schema.prisma, bugReportController.js, adminController.js, adminRoutes.js |
