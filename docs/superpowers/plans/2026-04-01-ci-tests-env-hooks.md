# CI/CD, Integration Tests, Env Validation & Pre-commit Hooks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration tests (real MySQL/Redis), centralized env validation, GitHub Actions CI, and Husky pre-commit hooks to the SAPA-TAZKIA backend.

**Architecture:** Integration tests use supertest against the real Express app with real MySQL/Redis (only email/OpenAI mocked). Env validation fails fast at startup. CI spins up MySQL 8 + Redis via GitHub Actions service containers. Husky lives at the git root via a minimal root `package.json`.

**Tech Stack:** Jest + supertest, Prisma, bcryptjs, GitHub Actions, Husky, lint-staged

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `backend/src/app.js` lines 701–789 | Wrap `app.listen` in `require.main === module` guard |
| Create | `backend/src/config/envValidation.js` | Centralized env var validation, fail-fast |
| Modify | `backend/src/app.js` line 10 | Import and call `envValidation` at top |
| Create | `backend/tests/helpers/dbHelper.js` | Truncate tables + seed test user |
| Create | `backend/tests/helpers/appHelper.js` | Shared supertest `request(app)` instance |
| Modify | `backend/jest.config.js` | Add `integration` test path pattern |
| Create | `backend/tests/integration/health.test.js` | Test `/health` and `/status` endpoints |
| Create | `backend/tests/integration/auth.test.js` | Test login + register |
| Create | `backend/tests/integration/academic.test.js` | Test `/api/academic/summary` and `/api/academic/grades` |
| Create | `.github/workflows/ci.yml` | CI pipeline with MySQL + Redis service containers |
| Create | `package.json` (root) | Minimal root package for Husky |
| Create | `.husky/pre-commit` | Run lint-staged on commit |

---

## Task 1: Wrap app.listen so tests don't start the HTTP server

**Files:**
- Modify: `backend/src/app.js` lines 700–789

The `server` variable is used in `gracefulShutdown`. Declare it with `let` before the `if` block so it stays in scope.

- [ ] **Step 1: Edit app.js — change `const server` to `let server` and wrap listen**

Replace (lines 700–789):
```js
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  // ... all console.logs ...
});
```

With:
```js
const PORT = process.env.PORT || 5000;

let server;

if (require.main === module) {
  server = app.listen(PORT, async () => {
    console.log('='.repeat(80));
    console.log('🚀 SAPA TAZKIA BACKEND SERVER STARTED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Auth: ${process.env.GOOGLE_CLIENT_ID ? '✅ Google OAuth Ready' : '❌ Local Auth Only'}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? '✅ Email Service Ready' : '❌ Email Disabled'}`);
    console.log(`🤖 AI: ${process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here' ? '✅ OpenAI + RAG Ready' : '❌ AI Disabled'}`);
    console.log(`🧠 RAG: ✅ Knowledge Base System Enabled`);
    console.log(`🗄️ Database: ${process.env.DATABASE_URL ? '✅ Connected' : '❌ No DB Config'}`);
    console.log(`🛡️ Rate Limiting: ${process.env.RATE_LIMIT_ENABLED !== 'false' ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`📊 Analytics: ✅ Snapshot job enabled`);

    try {
      await initializeRateLimitSystem();
    } catch (error) {
      console.log(`⚠️ Rate Limit: ❌ Initialization Failed - ${error.message}`);
    }

    try {
      await initializeAnalyticsSystem();
    } catch (error) {
      console.log(`⚠️ Analytics: ❌ Initialization Failed - ${error.message}`);
    }

    console.log('='.repeat(80));
  });
}
```

> Note: The existing `gracefulShutdown` function already guards with `if (server)` at line 669, so it handles `server` being undefined correctly.

- [ ] **Step 2: Verify dev server still starts**

```bash
cd backend && node -e "require('./src/app.js')" 2>&1 | head -5
```
Expected: No crash, no server started (script exits immediately because `require.main !== module`).

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/app.js
git commit -m "refactor(app): guard app.listen with require.main check for test compatibility"
```

---

## Task 2: Centralized env validation

**Files:**
- Create: `backend/src/config/envValidation.js`
- Modify: `backend/src/app.js` (add import at top)

- [ ] **Step 1: Create `backend/src/config/envValidation.js`**

```js
// backend/src/config/envValidation.js
// Called at the very top of app.js. Fails fast with clear messages if required vars are missing.

const REQUIRED = [
  { key: 'DATABASE_URL',   desc: 'MySQL connection string' },
  { key: 'JWT_SECRET',     desc: 'JWT signing secret (min 32 chars)' },
  { key: 'SESSION_SECRET', desc: 'Express session secret (min 32 chars)' },
  { key: 'REDIS_URL',      desc: 'Redis connection URL' },
];

// These are warned but not fatal — app can run in degraded mode
const WARNED = [
  { key: 'OPENAI_API_KEY',        desc: 'OpenAI API key (AI features disabled without it)' },
  { key: 'GOOGLE_CLIENT_ID',      desc: 'Google OAuth client ID (Google login disabled)' },
  { key: 'GOOGLE_CLIENT_SECRET',  desc: 'Google OAuth client secret (Google login disabled)' },
  { key: 'EMAIL_USER',            desc: 'Email sender (email features disabled)' },
];

function validateEnv() {
  // In test mode, relax: only DATABASE_URL and JWT_SECRET are truly required
  const isTest = process.env.NODE_ENV === 'test';
  const required = isTest
    ? REQUIRED.filter(v => ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'].includes(v.key))
    : REQUIRED;

  const missing = required.filter(({ key }) => !process.env[key]);

  if (missing.length > 0) {
    const lines = missing.map(({ key, desc }) => `  - ${key.padEnd(22)} → ${desc}`).join('\n');
    throw new Error(`FATAL: Missing required environment variables:\n${lines}`);
  }

  if (!isTest) {
    const warned = WARNED.filter(({ key }) => !process.env[key]);
    if (warned.length > 0) {
      const lines = warned.map(({ key, desc }) => `  - ${key}: ${desc}`).join('\n');
      // Use console.warn here because logger may not be initialized yet
      console.warn(`[ENV] Warning — missing optional variables (features will be degraded):\n${lines}`);
    }
  }
}

module.exports = { validateEnv };
```

- [ ] **Step 2: Call validateEnv at the top of `backend/src/app.js`**

Add after the existing `require('dotenv').config()` line (currently line 10):
```js
const { validateEnv } = require('./config/envValidation');
validateEnv();
```

- [ ] **Step 3: Verify it works without crashing**

```bash
cd backend && node -e "
  process.env.DATABASE_URL='mysql://x';
  process.env.JWT_SECRET='testsecret32charslong__________';
  process.env.SESSION_SECRET='testsession32charslong_________';
  process.env.REDIS_URL='redis://localhost';
  require('./src/config/envValidation').validateEnv();
  console.log('OK');
"
```
Expected output: `OK`

- [ ] **Step 4: Verify it throws when vars are missing**

```bash
cd backend && node -e "
  require('./src/config/envValidation').validateEnv();
" 2>&1
```
Expected output: `FATAL: Missing required environment variables:` followed by the list.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/config/envValidation.js src/app.js
git commit -m "feat(config): add centralized env validation with fail-fast startup check"
```

---

## Task 3: Test helpers — dbHelper and appHelper

**Files:**
- Create: `backend/tests/helpers/dbHelper.js`
- Create: `backend/tests/helpers/appHelper.js`

- [ ] **Step 1: Create `backend/tests/helpers/dbHelper.js`**

```js
// backend/tests/helpers/dbHelper.js
// Utilities for integration test database management.
// Uses the real Prisma singleton and real test database from .env.test.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Truncate all test-relevant tables in safe dependency order (children first).
 * Uses deleteMany instead of TRUNCATE to respect FK constraints.
 */
async function truncateAll() {
  // Order: child tables first, parent tables last
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.academicGrade.deleteMany({});
  await prisma.academicSummary.deleteMany({});
  await prisma.rateLimit.deleteMany({});
  await prisma.rateLimitLog.deleteMany({});
  await prisma.bugReport.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
}

/**
 * Seed a verified, active student user for integration tests.
 * Returns the created user + plaintext password for login tests.
 */
async function seedTestUser(overrides = {}) {
  const plainPassword = overrides.password || 'TestPass123!';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      fullName:         overrides.fullName  || 'Test Student',
      nim:              overrides.nim       || '2021001001',
      email:            overrides.email     || 'test@student.tazkia.ac.id',
      passwordHash,
      authMethod:       'nim',
      userType:         'student',
      status:           'active',
      isEmailVerified:  true,
      isProfileComplete: true,
      ...overrides,
      // Never let overrides accidentally reset these critical fields:
      passwordHash,
    },
  });

  return { user, plainPassword };
}

/**
 * Seed academic summary data for a given userId.
 */
async function seedAcademicSummary(userId) {
  return prisma.academicSummary.create({
    data: {
      userId,
      ipk:            '3.75',
      totalSks:       80,
      semesterActive: 5,
    },
  });
}

/**
 * Seed academic grade records for a given userId.
 */
async function seedAcademicGrades(userId) {
  // First ensure a course exists
  let course = await prisma.course.findFirst({ where: { code: 'TI001' } });
  if (!course) {
    course = await prisma.course.create({
      data: { code: 'TI001', name: 'Algoritma & Pemrograman', sks: 3, semester: 1 },
    });
  }

  return prisma.academicGrade.create({
    data: {
      userId,
      courseId:    course.id,
      semester:    1,
      grade:       'A',
      gradePoint:  4.0,
      academicYear: '2021/2022',
    },
  });
}

async function disconnect() {
  await prisma.$disconnect();
}

module.exports = { prisma, truncateAll, seedTestUser, seedAcademicSummary, seedAcademicGrades, disconnect };
```

- [ ] **Step 2: Create `backend/tests/helpers/appHelper.js`**

```js
// backend/tests/helpers/appHelper.js
// Returns a supertest agent bound to the Express app.
// Requiring app.js will NOT start the HTTP server because of the require.main guard added in Task 1.

const request = require('supertest');
const app = require('../../src/app');

const agent = request(app);

module.exports = { agent };
```

- [ ] **Step 3: Smoke-test helpers load without error**

```bash
cd backend && node -e "
  require('dotenv').config({ path: '.env.test' });
  const h = require('./tests/helpers/dbHelper');
  console.log('dbHelper OK, models:', Object.keys(h));
"
```
Expected: `dbHelper OK, models: [ 'prisma', 'truncateAll', 'seedTestUser', 'seedAcademicSummary', 'seedAcademicGrades', 'disconnect' ]`

- [ ] **Step 4: Commit**

```bash
cd backend && git add tests/helpers/
git commit -m "test(helpers): add dbHelper and appHelper for integration tests"
```

---

## Task 4: Update jest.config.js to include integration tests

**Files:**
- Modify: `backend/jest.config.js`

- [ ] **Step 1: Add integration test pattern**

Replace the current `testMatch` in `backend/jest.config.js`:
```js
testMatch: ['**/tests/**/*.test.js', '**/src/__tests__/**/*.test.js'],
```
With:
```js
testMatch: [
  '**/tests/unit/**/*.test.js',
  '**/tests/integration/**/*.test.js',
  '**/src/__tests__/**/*.test.js',
],
```

- [ ] **Step 2: Increase timeout for integration tests**

Change:
```js
testTimeout: 10000,
```
To:
```js
testTimeout: 30000,
```

- [ ] **Step 3: Verify config loads**

```bash
cd backend && npx jest --listTests 2>&1 | head -20
```
Expected: Lists both `unit/` and any new `integration/` test files.

- [ ] **Step 4: Commit**

```bash
cd backend && git add jest.config.js
git commit -m "test(config): extend jest to cover integration tests with 30s timeout"
```

---

## Task 5: Integration test — health endpoints

**Files:**
- Create: `backend/tests/integration/health.test.js`

These endpoints need no auth and no seeded data, making them the simplest integration test.

- [ ] **Step 1: Write the test**

```js
// backend/tests/integration/health.test.js
const { agent } = require('../helpers/appHelper');

describe('GET /health', () => {
  it('returns 200 with service statuses', async () => {
    const res = await agent.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
  });
});

describe('GET /status', () => {
  it('returns 200 with system info', async () => {
    const res = await agent.get('/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});

describe('GET /', () => {
  it('returns 200 API root response', async () => {
    const res = await agent.get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
```

- [ ] **Step 2: Run and verify it passes**

```bash
cd backend && npx jest tests/integration/health.test.js --verbose --forceExit 2>&1
```
Expected: 3 passing tests.

- [ ] **Step 3: Commit**

```bash
cd backend && git add tests/integration/health.test.js
git commit -m "test(integration): add health endpoint integration tests"
```

---

## Task 6: Integration test — auth endpoints

**Files:**
- Create: `backend/tests/integration/auth.test.js`

Login requires a real user in DB (seeded by dbHelper). Register sends email — mock `emailService` to avoid real SMTP calls.

- [ ] **Step 1: Write the test**

```js
// backend/tests/integration/auth.test.js

// Mock email to avoid SMTP calls during register
jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const { agent } = require('../helpers/appHelper');
const { truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

describe('Auth Integration', () => {
  let testUser;
  let plainPassword;

  beforeAll(async () => {
    await truncateAll();
    const seeded = await seedTestUser();
    testUser = seeded.user;
    plainPassword = seeded.plainPassword;
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // ──────────────────────────────────────────
  // POST /api/auth/login
  // ──────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('returns 200 + JWT token on valid NIM + password', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: testUser.nim, password: plainPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.nim).toBe(testUser.nim);
    });

    it('returns 200 + JWT token on valid email + password', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: testUser.email, password: plainPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
    });

    it('returns 401 on wrong password', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: testUser.nim, password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 on unknown NIM', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: '9999999999', password: 'anypassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when fields are missing', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: testUser.nim });

      expect(res.status).toBe(400);
    });
  });

  // ──────────────────────────────────────────
  // POST /api/auth/register
  // ──────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('returns 201 + requiresVerification on new valid user', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({
          fullName: 'Budi Santoso',
          nim:      '2021009999',
          email:    'budi@student.tazkia.ac.id',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.requiresVerification).toBe(true);
    });

    it('returns 400 when NIM already exists', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({
          fullName: 'Duplicate',
          nim:      testUser.nim,
          email:    'other@student.tazkia.ac.id',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when email already exists', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({
          fullName: 'Duplicate Email',
          nim:      '2021008888',
          email:    testUser.email,
          password: 'SecurePass123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({ email: 'noname@student.tazkia.ac.id' });

      expect(res.status).toBe(400);
    });
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && npx jest tests/integration/auth.test.js --verbose --forceExit 2>&1
```
Expected: 8 passing tests.

- [ ] **Step 3: Commit**

```bash
cd backend && git add tests/integration/auth.test.js
git commit -m "test(integration): add auth login and register integration tests"
```

---

## Task 7: Integration test — academic endpoints

**Files:**
- Create: `backend/tests/integration/academic.test.js`

Academic routes require `Authorization: Bearer <token>`. Get the token by logging in first.

- [ ] **Step 1: Write the test**

```js
// backend/tests/integration/academic.test.js

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

// Mock OpenAI to avoid real API calls from academicController.analyzePerformance
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock AI analysis' } }],
        }),
      },
    },
  }));
});

const { agent } = require('../helpers/appHelper');
const {
  truncateAll,
  seedTestUser,
  seedAcademicSummary,
  seedAcademicGrades,
  disconnect,
} = require('../helpers/dbHelper');

describe('Academic Integration', () => {
  let token;

  beforeAll(async () => {
    await truncateAll();
    const { user, plainPassword } = await seedTestUser();
    await seedAcademicSummary(user.id);
    await seedAcademicGrades(user.id);

    // Login to get token
    const loginRes = await agent
      .post('/api/auth/login')
      .send({ identifier: user.nim, password: plainPassword });

    token = loginRes.body.token;
    expect(token).toBeDefined();
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  // ──────────────────────────────────────────
  // GET /api/academic/summary
  // ──────────────────────────────────────────
  describe('GET /api/academic/summary', () => {
    it('returns 200 with academic summary for authenticated user', async () => {
      const res = await agent
        .get('/api/academic/summary')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('ipk');
      expect(res.body.data).toHaveProperty('totalSks');
    });

    it('returns 401 without token', async () => {
      const res = await agent.get('/api/academic/summary');
      expect(res.status).toBe(401);
    });
  });

  // ──────────────────────────────────────────
  // GET /api/academic/grades
  // ──────────────────────────────────────────
  describe('GET /api/academic/grades', () => {
    it('returns 200 with grades array for authenticated user', async () => {
      const res = await agent
        .get('/api/academic/grades')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns 401 without token', async () => {
      const res = await agent.get('/api/academic/grades');
      expect(res.status).toBe(401);
    });
  });
});
```

- [ ] **Step 2: Run and verify**

```bash
cd backend && npx jest tests/integration/academic.test.js --verbose --forceExit 2>&1
```
Expected: 4 passing tests.

- [ ] **Step 3: Run all tests together**

```bash
cd backend && npx jest --forceExit --verbose 2>&1 | tail -30
```
Expected: All unit + integration tests pass.

- [ ] **Step 4: Commit**

```bash
cd backend && git add tests/integration/academic.test.js
git commit -m "test(integration): add academic summary and grades integration tests"
```

---

## Task 8: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

The CI MySQL service uses password `testpassword` and database `sapa_tazkia_test`. Redis runs on default port with no password.

- [ ] **Step 1: Update `.env.test` for CI compatibility**

The current `.env.test` points to local Docker on port 3307. Add a note that CI overrides `DATABASE_URL` via env in the workflow. No change needed to the file itself — the CI workflow injects `DATABASE_URL` as an env var which overrides `.env.test`.

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend-ci:
    name: Backend — Lint + Test
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: testpassword
          MYSQL_DATABASE: sapa_tazkia_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd="mysqladmin ping -h 127.0.0.1 -u root -ptestpassword"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=10

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd="redis-cli ping"
          --health-interval=5s
          --health-timeout=3s
          --health-retries=5

    defaults:
      run:
        working-directory: backend

    env:
      NODE_ENV: test
      DATABASE_URL: mysql://root:testpassword@127.0.0.1:3306/sapa_tazkia_test
      REDIS_URL: redis://127.0.0.1:6379
      JWT_SECRET: ci-test-jwt-secret-32-chars-long-x
      SESSION_SECRET: ci-test-session-secret-32-chars-xx
      OPENAI_API_KEY: sk-test-dummy-not-used-in-unit-tests
      RATE_LIMIT_ENABLED: "false"

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Apply Prisma schema to test DB
        run: npx prisma db push --skip-generate

      - name: Run tests
        run: npm test

  frontend-ci:
    name: Frontend — Test
    runs-on: ubuntu-latest

    defaults:
      run:
        working-directory: frontend

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test -- --ci --passWithNoTests --watchAll=false
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow with MySQL and Redis service containers"
```

---

## Task 9: Pre-commit hooks (Husky + lint-staged)

**Files:**
- Create: `package.json` (root)
- Create: `.husky/pre-commit`

Run these commands from the **git root** (`E:/sapa-tazkia/`), not inside `backend/`.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "private": true,
  "description": "Root package — Husky pre-commit hooks only. App code lives in backend/ and frontend/.",
  "scripts": {
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9.1.7",
    "lint-staged": "^15.3.0"
  },
  "lint-staged": {
    "backend/src/**/*.js": [
      "bash -c 'cd backend && npx eslint --fix --no-eslintrc -c .eslintrc.js ${LINTED_FILES}'"
    ],
    "frontend/src/**/*.{js,jsx}": [
      "bash -c 'cd frontend && npx eslint --fix ${LINTED_FILES}'"
    ]
  }
}
```

> Note: `"private": true` ensures this package is never accidentally published to npm.

- [ ] **Step 2: Install husky and lint-staged at root**

```bash
cd "E:/sapa-tazkia" && npm install
```
Expected: `node_modules/` created at root with husky + lint-staged.

- [ ] **Step 3: Initialize husky**

```bash
cd "E:/sapa-tazkia" && npx husky init
```
Expected: `.husky/pre-commit` file created.

- [ ] **Step 4: Replace the default pre-commit hook**

The default hook from `husky init` contains `npm test`. Replace it entirely:

Open `.husky/pre-commit` and set its contents to:
```sh
npx lint-staged
```

- [ ] **Step 5: Test the hook manually**

```bash
cd "E:/sapa-tazkia" && git add backend/src/app.js && npx lint-staged
```
Expected: ESLint runs on staged `backend/src/app.js`, no errors thrown.

- [ ] **Step 6: Add root files to .gitignore exceptions**

The root `node_modules/` should be ignored. Check if `**/node_modules/` in `.gitignore` already covers it — it does (line 1 of existing `.gitignore`). No change needed.

- [ ] **Step 7: Commit root package files**

```bash
git add package.json package-lock.json .husky/pre-commit
git commit -m "chore(hooks): add Husky pre-commit hook with lint-staged for backend and frontend"
```

---

## Self-Review

**Spec coverage check:**
- [x] Integration tests (health, auth, academic) — Tasks 5, 6, 7
- [x] Centralized env validation — Task 2
- [x] GitHub Actions CI — Task 8
- [x] Pre-commit hooks (Husky) — Task 9

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:**
- `dbHelper` exports: `truncateAll`, `seedTestUser`, `seedAcademicSummary`, `seedAcademicGrades`, `disconnect` — all used correctly in Tasks 6 and 7
- `appHelper` exports: `agent` — used in Tasks 5, 6, 7
- `validateEnv` exported from `envValidation.js` — imported and called in Task 2 app.js step
- `let server` declared before if-block in Task 1 — used in existing `gracefulShutdown` at line 669

**Edge case: academicController uses `new PrismaClient()` directly (not singleton)**
This is pre-existing code. It will connect to the test DATABASE_URL correctly in integration tests. No change needed.

**Edge case: lint-staged path interpolation**
The `${LINTED_FILES}` pattern may not work directly in all lint-staged versions. If this fails, use the simpler pattern:
```json
"backend/src/**/*.js": ["eslint --fix -c backend/.eslintrc.js"]
```
lint-staged automatically appends the list of staged files to the command.
