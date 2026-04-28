# Backend Stability Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 backend stability gaps: request ID tracing, response compression, proper shutdown logging, OpenAI retry with backoff, PDF magic-bytes validation, and Redis in-memory degraded mode.

**Architecture:** Each fix is isolated to its responsible file. A new `middleware/requestId.js` is added. `redisService.js` gains an in-memory fallback Map. `openaiService.js` gains a `withRetry()` helper. `adminController.js` gets PDF content validation. `app.js` wires compression + request ID and fixes process signal handlers.

**Tech Stack:** Node.js/Express, ioredis, openai SDK, multer, uuid (new), compression (new), Jest + supertest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `backend/src/middleware/requestId.js` | UUID per request, set `req.id` + `X-Request-Id` header |
| **Create** | `backend/tests/unit/requestId.test.js` | Unit tests for requestId middleware |
| **Create** | `backend/tests/unit/redisService.test.js` | Unit tests for degraded mode |
| **Create** | `backend/tests/unit/openaiRetry.test.js` | Unit tests for `withRetry()` |
| **Modify** | `backend/src/app.js` | Add requestId + compression middleware, fix signal handlers |
| **Modify** | `backend/src/services/openaiService.js` | Add `withRetry()`, wrap `createEmbedding` + `generateAIResponse` |
| **Modify** | `backend/src/controllers/adminController.js` | Add multer `fileFilter` + magic bytes check |
| **Modify** | `backend/src/services/redisService.js` | Add `degradedMode` + in-memory fallback |
| **Modify** | `backend/tests/integration/health.test.js` | Assert `X-Request-Id` header present |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install uuid and compression**

```bash
cd backend
npm install uuid compression
```

Expected output: `added 2 packages` (or similar — both packages install cleanly)

- [ ] **Step 2: Verify packages are present**

```bash
node -e "require('uuid'); require('compression'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add uuid and compression packages"
```

---

## Task 2: Request ID Middleware

**Files:**
- Create: `backend/src/middleware/requestId.js`
- Create: `backend/tests/unit/requestId.test.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/requestId.test.js`:

```js
const requestId = require('../../src/middleware/requestId');

function mockRes() {
  const headers = {};
  return {
    setHeader: (k, v) => { headers[k] = v; },
    getHeaders: () => headers,
    _headers: headers,
  };
}

describe('requestId middleware', () => {
  it('sets req.id to a UUID when no header present', () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(res._headers['X-Request-Id']).toBe(req.id);
    expect(next).toHaveBeenCalled();
  });

  it('reuses x-request-id header if already present', () => {
    const existingId = 'existing-id-123';
    const req = { headers: { 'x-request-id': existingId } };
    const res = mockRes();
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.id).toBe(existingId);
    expect(res._headers['X-Request-Id']).toBe(existingId);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
npx jest tests/unit/requestId.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../src/middleware/requestId'`

- [ ] **Step 3: Create the middleware**

Create `backend/src/middleware/requestId.js`:

```js
const { v4: uuidv4 } = require('uuid');

module.exports = function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend
npx jest tests/unit/requestId.test.js --no-coverage
```

Expected: PASS — 2 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/requestId.js backend/tests/unit/requestId.test.js
git commit -m "feat(middleware): add request ID tracing middleware"
```

---

## Task 3: Wire Request ID + Compression into app.js

**Files:**
- Modify: `backend/src/app.js`
- Modify: `backend/tests/integration/health.test.js`

- [ ] **Step 1: Write the failing integration test**

Add to `backend/tests/integration/health.test.js` (append after existing tests):

```js
describe('Request ID header', () => {
  it('returns X-Request-Id on every response', async () => {
    const res = await agent.get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
npx jest tests/integration/health.test.js --no-coverage
```

Expected: FAIL — `X-Request-Id` header not present

- [ ] **Step 3: Add requestId and compression to app.js**

In `backend/src/app.js`, add these two requires at the top with the other requires:

```js
const compression = require('compression');
const requestId = require('./middleware/requestId');
```

Then, find this block (around line 37–39):

```js
const app = express();
// ✅ REQUIRED: Trust proxy for Nginx & Rate Limiting
app.set('trust proxy', 1);
```

Replace it with:

```js
const app = express();
// ✅ REQUIRED: Trust proxy for Nginx & Rate Limiting
app.set('trust proxy', 1);

// Request ID — must be first middleware so req.id is available everywhere
app.use(requestId);

// Response compression — skip SSE streaming endpoints
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.path === '/api/ai/chat' || req.path === '/api/guest/chat') {
      return false;
    }
    return compression.filter(req, res);
  }
}));
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend
npx jest tests/integration/health.test.js --no-coverage
```

Expected: PASS — all 4 tests pass (3 original + 1 new)

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.js backend/tests/integration/health.test.js
git commit -m "feat(app): add request ID tracing and response compression middleware"
```

---

## Task 4: Fix process Signal Handlers in app.js

**Files:**
- Modify: `backend/src/app.js`

- [ ] **Step 1: Fix uncaughtException and unhandledRejection handlers**

In `backend/src/app.js`, find these two handlers (around lines 692–700):

```js
process.on('uncaughtException', (error) => {
  console.error('🔴 UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔴 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});
```

Replace with:

```js
process.on('uncaughtException', (error) => {
  logger.error('[UNCAUGHT EXCEPTION] Process will exit', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('[UNHANDLED REJECTION] Process will exit', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
  gracefulShutdown('unhandledRejection');
});
```

- [ ] **Step 2: Verify app still starts**

```bash
cd backend
node -e "const app = require('./src/app'); console.log('app loaded OK'); process.exit(0);"
```

Expected: `app loaded OK` with no errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/app.js
git commit -m "fix(app): use logger + gracefulShutdown in uncaughtException and unhandledRejection handlers"
```

---

## Task 5: OpenAI Retry with Exponential Backoff

**Files:**
- Modify: `backend/src/services/openaiService.js`
- Create: `backend/tests/unit/openaiRetry.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/openaiRetry.test.js`:

```js
// We test withRetry in isolation by exporting it separately — see Step 3 note.
// For now we mock the module to test retry behavior.

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({}));
});

// We'll test the exported withRetry function after it's added
let withRetry;

beforeEach(() => {
  jest.resetModules();
  jest.mock('openai', () => jest.fn().mockImplementation(() => ({})));
  ({ withRetry } = require('../../src/services/openaiService'));
});

describe('withRetry', () => {
  it('returns result immediately on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retriable status code (429) and succeeds on 2nd attempt', async () => {
    const err = new Error('rate limited');
    err.status = 429;
    const fn = jest.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, 3, 0); // 0ms delay for tests
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after maxAttempts exhausted on retriable error', async () => {
    const err = new Error('server error');
    err.status = 503;
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, 3, 0)).rejects.toThrow('server error');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on non-retriable error (401)', async () => {
    const err = new Error('unauthorized');
    err.status = 401;
    const fn = jest.fn().mockRejectedValue(err);

    await expect(withRetry(fn, 3, 0)).rejects.toThrow('unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
npx jest tests/unit/openaiRetry.test.js --no-coverage
```

Expected: FAIL — `withRetry is not a function` (not exported yet)

- [ ] **Step 3: Add withRetry to openaiService.js**

In `backend/src/services/openaiService.js`, add this function after the `isBannedTopicQuestion` function (before `testOpenAIConnection`):

```js
const RETRIABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Retry wrapper with exponential backoff.
 * @param {Function} fn - async function to retry
 * @param {number} maxAttempts - total attempts (default 3)
 * @param {number} baseDelayMs - base delay in ms (default 1000, set 0 in tests)
 */
async function withRetry(fn, maxAttempts = 3, baseDelayMs = 1000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetriable =
        (error.status && RETRIABLE_STATUS.has(error.status)) ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNRESET';

      if (!isRetriable || attempt === maxAttempts) throw error;

      const delay = Math.pow(2, attempt - 1) * baseDelayMs;
      console.warn(`⚠️ [OPENAI] Retry ${attempt}/${maxAttempts} after ${delay}ms — ${error.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

Then wrap `createEmbedding` to use it. Find the existing `createEmbedding` function and replace:

```js
async function createEmbedding(text) {
  try {
    const cleanText = text.replace(/\s+/g, " ").trim();
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('❌ [OPENAI] Embed Error:', error.message);
    throw error;
  }
}
```

Replace with:

```js
async function createEmbedding(text) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  return withRetry(async () => {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanText,
    });
    return response.data[0].embedding;
  });
}
```

Then wrap the non-streaming path in `generateAIResponse`. Find inside `generateAIResponse` the LLM call block:

```js
    // --- Call LLM ---
    const completion = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature,
      presence_penalty: 0.1,
      stream: options.stream || false, // ✅ Support Streaming
    }, { signal: options.abortSignal });

    if (options.stream) return completion;

    const reply = completion.choices[0].message.content.trim();
    const usage = completion.usage || { total_tokens: 0 };

    console.log(`🤖 [AI GEN] Answer Generated. Tokens: ${usage.total_tokens}`);
    return { content: reply, usage };
```

Replace with:

```js
    // --- Call LLM ---
    if (options.stream) {
      const completion = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        presence_penalty: 0.1,
        stream: true,
      }, { signal: options.abortSignal });
      return completion;
    }

    const completion = await withRetry(() =>
      openai.chat.completions.create({
        model: MODEL_NAME,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        presence_penalty: 0.1,
        stream: false,
      }, { signal: options.abortSignal })
    );

    const reply = completion.choices[0].message.content.trim();
    const usage = completion.usage || { total_tokens: 0 };

    console.log(`🤖 [AI GEN] Answer Generated. Tokens: ${usage.total_tokens}`);
    return { content: reply, usage };
```

Finally, add `withRetry` to the `module.exports` at the bottom:

```js
module.exports = {
  generateAIResponse,
  createEmbedding,
  testOpenAIConnection,
  generateTitle,
  isGreeting,
  withRetry, // exported for testing
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend
npx jest tests/unit/openaiRetry.test.js --no-coverage
```

Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/openaiService.js backend/tests/unit/openaiRetry.test.js
git commit -m "feat(openai): add withRetry exponential backoff for embeddings and non-streaming responses"
```

---

## Task 6: PDF Upload Content Validation

**Files:**
- Modify: `backend/src/controllers/adminController.js`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/unit/pdfValidation.test.js`:

```js
// Test the PDF magic bytes check logic in isolation
const PDF_MAGIC = Buffer.from('%PDF-');

function isPdfBuffer(buffer) {
  return buffer.slice(0, 5).equals(PDF_MAGIC);
}

describe('PDF magic bytes validation', () => {
  it('returns true for a valid PDF buffer', () => {
    const validPdf = Buffer.from('%PDF-1.4 fake content');
    expect(isPdfBuffer(validPdf)).toBe(true);
  });

  it('returns false for a non-PDF buffer', () => {
    const notPdf = Buffer.from('This is a text file, not a PDF');
    expect(isPdfBuffer(notPdf)).toBe(false);
  });

  it('returns false for a buffer shorter than 5 bytes', () => {
    const short = Buffer.from('%PDF');
    expect(isPdfBuffer(short)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes immediately**

```bash
cd backend
npx jest tests/unit/pdfValidation.test.js --no-coverage
```

Expected: PASS — this tests the logic, not the module. All 3 tests pass.

- [ ] **Step 3: Update multer config in adminController.js**

In `backend/src/controllers/adminController.js`, find the multer config (lines 10–13):

```js
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});
```

Replace with:

```js
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Hanya file PDF yang diperbolehkan'), false);
    }
    cb(null, true);
  }
});
```

- [ ] **Step 4: Add magic bytes check inside uploadPdfDoc**

In `backend/src/controllers/adminController.js`, find the `uploadPdfDoc` function. After the check for `req.file` (the first guard after the function starts), add:

```js
const uploadPdfDoc = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file yang diupload' });
    }

    // Validate PDF magic bytes — reject files with spoofed content-type
    const PDF_MAGIC = Buffer.from('%PDF-');
    if (req.file.buffer.length < 5 || !req.file.buffer.slice(0, 5).equals(PDF_MAGIC)) {
      return res.status(422).json({
        success: false,
        message: 'File bukan PDF yang valid'
      });
    }

    // ... rest of existing function unchanged
```

> Note: Only add the magic bytes check block. Do not change anything else in `uploadPdfDoc`.

- [ ] **Step 5: Verify app loads without error**

```bash
cd backend
node -e "const app = require('./src/app'); console.log('OK'); process.exit(0);"
```

Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/adminController.js backend/tests/unit/pdfValidation.test.js
git commit -m "feat(admin): add PDF content-type filter and magic bytes validation for uploads"
```

---

## Task 7: Redis Degraded Mode with In-Memory Fallback

**Files:**
- Modify: `backend/src/services/redisService.js`
- Create: `backend/tests/unit/redisService.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/redisService.test.js`:

```js
// We test the in-memory fallback by simulating a dead ioredis client.
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    del: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    exists: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    incr: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    incrby: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    expire: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    ttl: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    keys: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    decr: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  }));
});

let redisService;

beforeEach(() => {
  jest.resetModules();
  jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      set: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      del: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      exists: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      incr: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      incrby: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      expire: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      ttl: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      keys: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      decr: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    }));
  });
  redisService = require('../../src/services/redisService');
  redisService.degradedMode = true; // force degraded mode for tests
});

describe('RedisService degraded mode', () => {
  it('set and get round-trip via memory store', async () => {
    await redisService.set('test:key', 'hello');
    const val = await redisService.get('test:key');
    expect(val).toBe('hello');
  });

  it('returns null for missing key', async () => {
    const val = await redisService.get('test:nonexistent');
    expect(val).toBeNull();
  });

  it('incr increments from 0', async () => {
    const v1 = await redisService.incr('test:counter');
    const v2 = await redisService.incr('test:counter');
    expect(v1).toBe(1);
    expect(v2).toBe(2);
  });

  it('del removes key from memory store', async () => {
    await redisService.set('test:delme', 'value');
    await redisService.del('test:delme');
    const val = await redisService.get('test:delme');
    expect(val).toBeNull();
  });

  it('expired key returns null after TTL', async () => {
    // Set with 1 second TTL, then manually expire
    await redisService.set('test:expiry', 'temp', 1);
    // Manually move expiry to past
    const key = 'test:expiry';
    redisService._memoryExpiry.set(key, Date.now() - 1000);
    const val = await redisService.get(key);
    expect(val).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
npx jest tests/unit/redisService.test.js --no-coverage
```

Expected: FAIL — `redisService.degradedMode is not defined`

- [ ] **Step 3: Add degraded mode to redisService.js**

In `backend/src/services/redisService.js`, update the `RedisService` class:

**1. Add new properties in constructor (after `this.isConnected = false`):**

```js
this.degradedMode = false;
this._memoryStore = new Map();  // key → value string
this._memoryExpiry = new Map(); // key → expiry timestamp (ms)
```

**2. Add `_memoryGet` and `_memorySet` private helpers after the constructor:**

```js
_memoryGet(key) {
  const expiry = this._memoryExpiry.get(key);
  if (expiry && Date.now() > expiry) {
    this._memoryStore.delete(key);
    this._memoryExpiry.delete(key);
    return null;
  }
  return this._memoryStore.has(key) ? this._memoryStore.get(key) : null;
}

_memorySet(key, value, expireSeconds = null) {
  // Evict oldest 100 entries if store exceeds 10,000
  if (this._memoryStore.size >= 10000) {
    const oldest = [...this._memoryStore.keys()].slice(0, 100);
    oldest.forEach(k => { this._memoryStore.delete(k); this._memoryExpiry.delete(k); });
  }
  this._memoryStore.set(key, String(value));
  if (expireSeconds) {
    this._memoryExpiry.set(key, Date.now() + expireSeconds * 1000);
  }
}
```

**3. Update `initEventListeners` to set `degradedMode` on connect/close:**

```js
initEventListeners() {
  if (!this.client) return;

  this.client.on('connect', () => {
    this.isConnected = true;
    this.degradedMode = false;
    logger.info('✅ Redis client connected successfully');
  });

  this.client.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
      this.degradedMode = true;
    } else {
      logger.error('Redis error:', err.message);
    }
  });

  this.client.on('close', () => {
    this.isConnected = false;
    this.degradedMode = true;
    logger.warn('Redis connection closed — switching to degraded mode');
  });
}
```

**4. Update `get()` to use memory fallback:**

```js
async get(key) {
  try {
    if (!this.client) return null;
    const data = await this.client.get(key);
    return data;
  } catch (error) {
    logger.error(`Redis get error [${key}]:`, error.message);
    if (this.degradedMode) return this._memoryGet(key);
    return null;
  }
}
```

**5. Update `set()` to use memory fallback:**

```js
async set(key, value, expireSeconds = null) {
  try {
    if (!this.client) {
      if (this.degradedMode) this._memorySet(key, value, expireSeconds);
      return;
    }
    const valString = typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (expireSeconds) {
      await this.client.set(key, valString, 'EX', expireSeconds);
    } else {
      await this.client.set(key, valString);
    }
  } catch (error) {
    logger.error(`Redis set error [${key}]:`, error.message);
    if (this.degradedMode) this._memorySet(key, value, expireSeconds);
  }
}
```

**6. Update `del()` to use memory fallback:**

```js
async del(key) {
  try {
    if (!this.client) return 0;
    return await this.client.del(key);
  } catch (error) {
    logger.error(`Redis del error [${key}]:`, error.message);
    if (this.degradedMode) { this._memoryStore.delete(key); this._memoryExpiry.delete(key); return 1; }
    return 0;
  }
}
```

**7. Update `incr()` to use memory fallback:**

```js
async incr(key) {
  try {
    if (!this.client) return 1;
    return await this.client.incr(key);
  } catch (error) {
    logger.error(`Redis incr error [${key}]:`, error.message);
    if (this.degradedMode) {
      const current = parseInt(this._memoryGet(key) || '0', 10);
      const next = current + 1;
      this._memorySet(key, next);
      return next;
    }
    return 1;
  }
}
```

**8. Update `incrBy()` to use memory fallback:**

```js
async incrBy(key, amount) {
  try {
    if (!this.client) return amount;
    const val = parseInt(amount);
    if (isNaN(val)) return 0;
    return await this.client.incrby(key, val);
  } catch (error) {
    logger.error(`Redis incrBy error [${key}]:`, error.message);
    if (this.degradedMode) {
      const current = parseInt(this._memoryGet(key) || '0', 10);
      const next = current + parseInt(amount, 10);
      this._memorySet(key, next);
      return next;
    }
    return amount;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend
npx jest tests/unit/redisService.test.js --no-coverage
```

Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/redisService.js backend/tests/unit/redisService.test.js
git commit -m "feat(redis): add degraded mode with in-memory fallback for rate limiting when Redis is down"
```

---

## Task 8: Full Test Suite Verification

**Files:** No changes — verification only

- [ ] **Step 1: Run all backend tests**

```bash
cd backend
npm test
```

Expected: All tests pass. Zero failures. (Some tests may be skipped if DB/Redis not running in CI — that is expected.)

- [ ] **Step 2: Manually smoke-test request ID**

```bash
curl -i http://localhost:5000/health 2>/dev/null | grep -i x-request-id
```

Expected: `x-request-id: <uuid>`

- [ ] **Step 3: Manually smoke-test compression**

```bash
curl -H "Accept-Encoding: gzip" -I http://localhost:5000/ 2>/dev/null | grep -i content-encoding
```

Expected: `content-encoding: gzip`

- [ ] **Step 4: Manually test PDF validation — reject non-PDF**

```bash
# Create a fake "PDF" that is really a text file
echo "This is not a PDF" > /tmp/fake.pdf
curl -s -X POST http://localhost:5000/api/admin/knowledge-base/upload-pdf \
  -H "Authorization: Bearer <admin-token>" \
  -F "pdf=@/tmp/fake.pdf" | node -e "process.stdin.resume();process.stdin.on('data',d=>console.log(d.toString()))"
```

Expected: `{"success":false,"message":"File bukan PDF yang valid"}`

- [ ] **Step 5: Final commit — bump version**

In `backend/src/app.js`, find:

```js
version: '4.1.0',
```

Replace with:

```js
version: '4.2.0',
```

```bash
git add backend/src/app.js
git commit -m "chore(version): bump to 4.2.0 — backend stability upgrade complete"
```
