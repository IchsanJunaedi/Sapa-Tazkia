# SAPA-TAZKIA Backend Gap Analysis & Enhancement Design v1.1

**Date:** 2026-03-19
**Status:** Approved
**Scope:** Backend (`/backend`) — Production system at sapa.tazkia.ac.id
**Context:** Campus-owned AI academic assistant, live with internal users. No subscription/payment features needed.

---

## 1. Background

SAPA-TAZKIA is a production RAG-based academic assistant for Tazkia University. The backend is Node.js/Express with MySQL (Prisma), Qdrant, Redis, and OpenAI. The system is live and used by internal campus users.

This document captures all identified gaps and the design for addressing them in two phases:
- **Phase 1 (Section 1):** Critical gaps — fix immediately for live system stability
- **Phase 2 (Section 2 & 3):** Important + commercial-ready gaps — improve quality, showcase value

---

## 2. Phase 1: Critical Gaps (Section 1)

### 2.1 Automated Test Suite

**Problem:** Zero test files exist. `npm test` script is missing from `package.json`. Testing is manual via dev-only endpoints.
**Risk:** Every deployment can break production without a safety net.

**Design:**
- Framework: **Jest** + **Supertest** — install as `npm install --save-dev jest supertest`
- Add `"test": "jest --forceExit --detectOpenHandles"` to `package.json` scripts
- Test types: unit tests for services, integration tests for routes
- Coverage targets: `authService`, `ragService`, `rateLimitService`, `academicService`
- Integration tests: full auth flow (register → verify → login → refresh), RAG pipeline, rate limiting
- Location: `backend/src/__tests__/` for unit, `backend/tests/` for integration
- Tests are written **incrementally** as each Sprint 1 feature is built — not as a single end-of-sprint block

**Key test cases:**
- Auth: register, verify email, login NIM, login email, JWT refresh, logout, forgot password, reset password
- RAG: query normalization, embedding search, answer generation
- Rate limit: token bucket decrement, quota exhaustion, fail-open when Redis down
- Academic: grade retrieval, GPA summary, transcript generation

### 2.2 Guest Sessions → Redis

**Problem:** `guestController.js` stores sessions in an in-memory JavaScript `Map`. All guest conversations are lost on every server restart or PM2 auto-restart.

**Design:**
- Migrate guest session storage from in-memory `Map` to **Redis** with TTL
- Key format: `guest:session:{sessionId}` → JSON string
- TTL: 24 hours (matches current user session TTL)
- Data stored: `{ messages: [], ip, createdAt, lastActivity }`
- Affected file: `src/controllers/guestController.js`
- Use existing `redisService.js` client — no new dependency needed

**Hidden coupling — must fix together:**
- `adminController.getChatLogs()` currently calls `guestController.getAllActiveSessions()` to merge guest logs into the unified admin chat log view. This method currently returns the in-memory `Map`. After Redis migration, `getAllActiveSessions()` must be reimplemented to query Redis keys by pattern `guest:session:*` using `redisClient.keys()` + `redisClient.get()`. Failing to update this will silently return zero guest logs in the admin dashboard with no error.

### 2.3 Forgot Password Flow

**Problem:** No password reset mechanism exists. Users who forget their password have no self-service recovery.

**Design:**
- `POST /api/auth/forgot-password` — accepts `email` or `nim`; NIM is used only to look up the associated email (since `email` is required on all users); the email is always the delivery target
- `POST /api/auth/reset-password` — accepts `token` + `newPassword`, updates bcrypt hash
- Token: cryptographically random 32-byte hex (`crypto.randomBytes(32).toString('hex')`), stored in Redis with 15-minute TTL
- Redis key format: `pwd_reset:{token}` → userId (avoids collision with session keys)
- Rate limit key format: `pwd_reset_rl:{email}` → request count, TTL 1 hour, limit 3 requests/hour
- Email: uses existing `emailService.js`, add new method `sendPasswordResetEmail(email, resetUrl)`
- Security: token is single-use — deleted from Redis immediately after successful password update
- Validation: new password ≥ 8 chars, letters + numbers (matches existing registration rules)

### 2.4 File-Based Logging (Winston)

**Problem:** `logger.js` only outputs to console. No persistent logs, no log rotation, no structured JSON format for production debugging.

**Design:**
- Replace custom `logger.js` with **Winston** + `winston-daily-rotate-file`
- Install: `npm install winston winston-daily-rotate-file`
- Log format: JSON in production, colorized in development
- Transports:
  - Console (all environments)
  - File: `logs/combined-%DATE%.log` (all levels, 14-day retention)
  - File: `logs/error-%DATE%.log` (error only, 30-day retention)
- Request ID injected into every log entry (prerequisite for gap #9 in Sprint 2)
- **Directory setup:** Create `backend/logs/.gitkeep` and add `backend/logs/*.log` to `.gitignore`. Winston's `winston-daily-rotate-file` requires the parent `logs/` directory to exist at startup.

**Preserved API (drop-in replacement — all existing call sites must continue to work):**
- `logger.info()` — dev only (hidden in production)
- `logger.error()` — always logged
- `logger.warn()` — always logged
- `logger.debug()` — dev only
- `logger.security()` — always logged (audit)
- `logger.request()` — dev only (HTTP logging)
- `logger.rateLimit()` — alias for `logger.debug()`, used in `rateLimitService.js` and `rateLimitMiddleware.js`
- `logger.redis()` — alias for `logger.debug()`, used in `redisService.js`

### 2.5 BugReport Model Expansion

**Problem:** `BugReport` model only has `id`, `title`, `userId`, `createdAt`. Bug reports are not actionable for admins.

**Note on `userId`:** Keep `userId Int` (non-nullable) — all existing bug reports are submitted by authenticated users and the `bugReportController.js` always sets `userId: req.user.id`. Making it nullable would be inconsistent with current behavior. The new fields are all nullable/have defaults, so `prisma db push` will safely ALTER the table without affecting existing rows.

**Design:**
- Add fields to Prisma schema (all additive — safe for live table):
  - `description` (String? @db.Text) — full bug description
  - `severity` (BugSeverity @default(MEDIUM)) — Enum: LOW, MEDIUM, HIGH, CRITICAL
  - `status` (BugStatus @default(OPEN)) — Enum: OPEN, IN_PROGRESS, RESOLVED, CLOSED
  - `pageUrl` (String?) — which page the bug occurred on
  - `userAgent` (String?) — auto-captured from request headers
  - `screenshotUrl` (String?) — optional screenshot link
  - `resolvedAt` (DateTime?) — when admin marks resolved
  - `adminNotes` (String? @db.Text) — internal admin notes
- Add admin endpoint:
  - `PATCH /api/admin/bug-reports/:id` — update status + adminNotes, auto-set resolvedAt when status → RESOLVED/CLOSED
- Run `npm run db:push` after schema change

### 2.6 User Profile Management

**Problem:** `GET /api/auth/me` (profile read) and `PATCH /api/auth/update-profile` (update name/email/nim) already exist. The genuine gaps are: (1) `programStudiId` cannot be updated via the existing profile endpoint, and (2) there is no change-password endpoint for authenticated users.

**Design — extend existing, do not rebuild:**
- Extend `authService.updateUserProfile()` to accept and update `programStudiId` in addition to existing `fullName`, `email`, `nim` fields
- Extend `GET /api/auth/me` response to include the full `programStudi` relation (name, code, faculty) — currently returns only the ID
- Add new endpoint: `PUT /api/auth/change-password` — accepts `currentPassword` + `newPassword`, verifies current hash before updating, requires `requireAuth` middleware
- Validation: `newPassword` ≥ 8 chars, letters + numbers; `currentPassword` must not equal `newPassword`

---

## 3. Phase 2: Important & Showcase Gaps (Section 2)

### 3.1 CI/CD Pipeline (GitHub Actions)

**Design:**
- `.github/workflows/ci.yml` — runs on every PR:
  - `npm ci` in backend
  - `npm run lint`
  - `npm test`
- `.github/workflows/deploy.yml` — runs on push to `main` (manual trigger for now)

### 3.2 Refactor app.js (787 lines → modular)

**Design:**
- Extract to:
  - `src/middleware/index.js` — all middleware setup
  - `src/routes/index.js` — route registration
  - `src/utils/gracefulShutdown.js` — SIGINT/SIGTERM handlers
  - `src/app.js` stays as orchestrator (~100 lines)

### 3.3 Request ID / Correlation ID Middleware

**Design:**
- New middleware: `src/middleware/requestIdMiddleware.js`
- Generates UUID v4 per request, attaches to `req.requestId`
- Sets `X-Request-ID` response header
- Injected into all Winston log entries via `res.locals`

### 3.4 Admin User Management

**Design:**
- `GET /api/admin/users` — list all users (paginated, filterable by status/userType)
- `GET /api/admin/users/:id` — user detail + conversation count + last active
- `PATCH /api/admin/users/:id/status` — set `active` / `suspended` (adds `status` field to User model)

### 3.5 Knowledge Base File Upload

**Design:**
- `POST /api/admin/knowledge-base/upload` — Multer multipart upload
- Accepts: `.pdf`, `.md`, `.txt`
- Pipeline: upload → parse (pdf-parse for PDF, raw for MD/TXT) → chunk → embed → store in Qdrant
- Max file size: 10MB
- **Dependency note:** Add `multer@1.x` (not 2.x — multer 2.x dropped Express 4 support). `pdf-parse` already in `dependencies`.

### 3.6 API Versioning

**Risk:** High — affects all active clients simultaneously. Deferred to Phase 3 with a proper cutover plan.

**Deferred design (Phase 3):**
- Mount the same router under both `/api/` and `/api/v1/` (Express alias, not HTTP redirect — redirects strip Authorization headers on some clients)
- Update frontend `REACT_APP_API_URL` atomically in the same deployment
- Rollback plan: revert `REACT_APP_API_URL` and redeploy frontend (backend keeps both mounts)
- Do NOT use HTTP 301/302 redirects for API versioning

---

## 4. Phase 3: Commercial-Ready Gaps (Section 3)

### 4.1 Error Tracking (Sentry)

- Install `@sentry/node`, initialize in `app.js`
- Capture unhandled exceptions + promise rejections
- Sentry DSN via `SENTRY_DSN` env var

### 4.2 Account Deletion & Data Export

- `DELETE /api/auth/account` — cascade delete all user data (conversations, grades, sessions, bug reports)
- `GET /api/auth/export-data` — JSON dump of all user data (conversations, grades, profile)
- Requires current password confirmation before deletion

### 4.3 Conversation Export

- `GET /api/ai/conversations/:id/export?format=pdf|md` — download conversation
- PDF: via existing `pdfService.js`
- Markdown: plain text export

### 4.4 API Versioning (moved from Section 2)

- See deferred design in Section 3.6 above

### 4.5 In-App Notifications (Low Priority)

- Simple notification model in Prisma: `id, userId, type, message, isRead, createdAt`
- `GET /api/notifications` — fetch unread
- `PATCH /api/notifications/:id/read` — mark read
- Triggers: knowledge base update, maintenance window

---

## 5. Implementation Order

### Sprint 1 — Section 1 (Critical)
1. Winston logging + `logs/.gitkeep` + `.gitignore` update (lowest risk, enables debugging for all subsequent work)
2. Guest sessions → Redis + fix `adminController.getChatLogs` coupling
3. Forgot password flow (user-facing, high value)
4. User profile management — extend existing endpoints, add change-password
5. BugReport model expansion (schema + admin endpoint)
6. Automated test suite — add jest/supertest, write tests incrementally for each item above

### Sprint 2 — Section 2 (Showcase)
7. Request ID middleware
8. Refactor app.js
9. Admin user management
10. Knowledge base file upload (multer@1.x)
11. CI/CD pipeline

### Sprint 3 — Section 3 (Commercial-Ready)
12. Sentry error tracking
13. Account deletion & data export
14. Conversation export
15. API versioning (with proper cutover plan)
16. In-App notifications

---

## 6. Excluded from Scope

- Subscription / payment / billing system — campus-owned system, not commercial SaaS
- Multi-tenant support — single campus deployment
- API key management for 3rd parties

---

## 7. Dependencies & Prerequisites

| Task | Prerequisite |
|------|-------------|
| Test suite | `npm install --save-dev jest supertest`; add test script to package.json |
| Winston logging | `npm install winston winston-daily-rotate-file`; create `logs/.gitkeep` |
| Forgot password | emailService.js (already exists); add `sendPasswordResetEmail()` |
| Knowledge base upload | `npm install multer@1` (not multer@2 — Express 4 incompatible) |
| Sentry | `SENTRY_DSN` env var |
| CI/CD | GitHub repository access |

---

## 8. Schema Changes Required

```prisma
// BugReport expansion — userId stays Int (non-nullable), all new fields are additive
model BugReport {
  id            Int         @id @default(autoincrement())
  title         String
  description   String?     @db.Text
  severity      BugSeverity @default(MEDIUM)
  status        BugStatus   @default(OPEN)
  pageUrl       String?
  userAgent     String?
  screenshotUrl String?
  adminNotes    String?     @db.Text
  resolvedAt    DateTime?
  userId        Int
  user          User        @relation(fields: [userId], references: [id])
  createdAt     DateTime    @default(now())
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

---

*Design approved by user on 2026-03-19. Spec reviewed and corrected 2026-03-19 (7 issues resolved). Implementation starts with Sprint 1 (Section 1 Critical Gaps).*
