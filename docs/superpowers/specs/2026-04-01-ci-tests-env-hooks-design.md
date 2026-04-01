# Design: CI/CD, Integration Tests, Env Validation, Pre-commit Hooks

**Date:** 2026-04-01
**Status:** Approved

---

## 1. Integration Tests

### Goal
Add `supertest`-based integration tests for core HTTP routes using a real MySQL test database and real Redis. Only external APIs (OpenAI, Qdrant, email) are mocked.

### Structure
```
backend/tests/
  unit/                      ← existing, untouched
  integration/
    auth.test.js             ← POST /api/auth/login, POST /api/auth/register
    academic.test.js         ← GET /api/academic/grades, /api/academic/summary
    health.test.js           ← GET /health, GET /status
  helpers/
    dbHelper.js              ← truncate tables per-suite
    appHelper.js             ← shared supertest app instance
```

### Cleanup Strategy
**Truncate per suite (Option B):**
- `beforeAll`: truncate relevant tables, seed minimal required data via Prisma
- `afterAll`: truncate again to leave DB clean
- No `migrate reset` (too slow), no transaction rollback (not natively supported by Prisma)

### Mocking
- `openai`, `@qdrant/js-client-rest`, `nodemailer` — jest.mock at module level
- Prisma, Redis, MySQL — real connections via `.env.test`

### `.env.test` requirements
Must have a valid `DATABASE_URL` pointing to a test database (separate from dev DB).

---

## 2. Centralized Env Validation

### Goal
Fail fast at startup with clear, grouped error messages if required env vars are missing.

### File
`backend/src/config/envValidation.js`

### Behavior
- Called at the very top of `app.js` (before any other require)
- Groups vars into: `required` (crash if missing) and `warned` (log warning, continue)
- Required groups: auth secrets, database, JWT
- Warned groups: email, Google OAuth, OpenAI (graceful degradation possible)
- In `test` environment: relaxes some required checks (e.g. GOOGLE credentials not needed)

### Error format
```
FATAL: Missing required environment variables:
  - JWT_SECRET        → Authentication token signing key
  - DATABASE_URL      → MySQL connection string
```

---

## 3. GitHub Actions CI

### File
`.github/workflows/ci.yml`

### Triggers
- `push` to `main` or `develop`
- `pull_request` targeting `main`

### Jobs

**`backend-ci`**
1. Checkout code
2. Setup Node.js 20
3. `npm ci` in `./backend`
4. Run `npm run lint`
5. Spin up MySQL 8.0 service container (port 3306)
6. Spin up Redis 7 service container (port 6379)
7. Create `.env.test` from GitHub Secrets or hardcoded test values
8. Run `npm test` (unit + integration)

**`frontend-ci`**
1. Checkout code
2. Setup Node.js 20
3. `npm ci` in `./frontend`
4. Run `npm test -- --ci --passWithNoTests --watchAll=false`

### Notes
- Jobs run in parallel
- MySQL and Redis are GitHub Actions service containers (no external infra needed)
- OpenAI/Qdrant calls are mocked in tests — no real API keys needed for CI

---

## 4. Pre-commit Hooks (Husky)

### Problem
No root `package.json` exists. Husky must be installed at the git root (`E:/sapa-tazkia/`).

### Approach
Create a minimal root `package.json` for Husky + lint-staged only.

### Root `package.json`
```json
{
  "private": true,
  "scripts": { "prepare": "husky" },
  "lint-staged": {
    "backend/src/**/*.js": ["eslint --fix --no-eslintrc -c backend/.eslintrc.js"],
    "frontend/src/**/*.{js,jsx}": ["eslint --fix"]
  }
}
```

### Hook: `.husky/pre-commit`
```sh
npx lint-staged
```

### Install commands
```sh
npm install --save-dev husky lint-staged   # at root
npx husky init
```

---

## Spec Self-Review

- No TBDs or placeholders
- Integration test cleanup strategy is consistent (truncate, not rollback)
- CI MySQL uses port 3306 (GitHub Actions service containers use internal ports)
- Env validation relaxes in test mode — consistent with `setup.js` behavior
- Root `package.json` is `private: true` — won't be accidentally published
- ESLint in lint-staged references `backend/.eslintrc.js` explicitly to avoid root config ambiguity
