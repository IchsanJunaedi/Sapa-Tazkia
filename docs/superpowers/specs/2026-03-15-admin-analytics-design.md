# Admin Analytics Dashboard — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Project:** SAPA-TAZKIA

---

## Overview

Add a fully-integrated Analytics tab to the existing Admin Dashboard. The feature provides real-time KPI metrics, historical charts, and usage breakdowns to help admins monitor platform health, AI cost, and user activity.

---

## Goals

- Real-time KPI cards (auto-refresh every 30 seconds)
- Historical charts for 7D and 30D ranges
- Data persisted via scheduled snapshots (not ephemeral)
- Integrated with existing Conversation/Message DB data and RateLimitLog for guest counts
- Visual style: Midnight Premium (dark, purple/cyan accents)

---

## UI Sections

| Section | Chart Type | Data Source |
|---|---|---|
| KPI Cards (4) | Stat cards with delta | `GET /api/admin/analytics/realtime` |
| Chat Volume | Bar chart (7D/30D toggle) | `GET /api/admin/analytics/history` |
| User vs Guest Split | Donut chart | `GET /api/admin/analytics/realtime` |
| Token Usage Trend | Area line chart | `GET /api/admin/analytics/history` |
| Peak Hours | Heatmap (hour-of-day) | `GET /api/admin/analytics/history` |
| Top Users | Ranked table (top 10) | `GET /api/admin/analytics/history` |

**KPI Card definitions:**
1. **Chat Today** — total authenticated user messages (`role = 'user'`) created today + guest chat count from `RateLimitLog`
2. **Active Users** — count of distinct `userId` values from `Message` records where `createdAt >= today 00:00`
3. **Tokens Used** — `SUM(tokenUsage)` from today's `Message` records, null-coalesced to 0 (`?? 0` in JS, `COALESCE` in SQL)
4. **Est. Min. Cost** — computed client-side: `totalTokens × 0.00000015` (gpt-4o-mini input-only rate: $0.15/M tokens). **Important caveats:** (a) `tokenUsage` in `Message` stores total tokens (input + output combined), but output tokens cost $0.60/M — 4× higher than input. This formula deliberately uses the lower bound and will understate real cost. The UI label must read **"Est. Min. Cost"** to communicate this. (b) Formula is model/price-dependent — update if model or pricing changes. A code comment must document both assumptions explicitly.

**Delta vs yesterday** — each KPI card shows `↑/↓ X%` by comparing today's live value to yesterday's `AnalyticsSnapshot` record.

---

## Architecture — Approach C (Dedicated Snapshot Table + Background Job)

### Rationale
Project already has MySQL + Prisma, and a background jobs pattern in `rateLimitJobs.js`. Extending this pattern gives persistent historical data with fast queries regardless of Redis state.

---

## Database Schema

Add to `backend/prisma/schema.prisma`:

```prisma
model AnalyticsSnapshot {
  id          Int      @id @default(autoincrement())
  date        DateTime @unique @db.Date  // MySQL DATE type — one record per calendar day, timezone-safe
  totalChats  Int      @default(0)
  userChats   Int      @default(0)
  guestChats  Int      @default(0)        // sourced from RateLimitLog, not in-memory guest sessions
  totalTokens Int      @default(0)
  uniqueUsers Int      @default(0)
  hourlyData  Json?    // shape: { "0": 3, "1": 0, ..., "7": 28, "8": 45, ..., "23": 5 }
                       // 24 keys (string "0"–"23"), values = user message count for that hour
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Schema notes:**
- `date` uses `@db.Date` (MySQL `DATE` type) to store only the calendar date without time component, preventing timezone-based duplicate row creation. Upsert key must truncate to `YYYY-MM-DD`.
- `guestChats` is sourced from `RateLimitLog` (already DB-persisted) filtered by `endpoint = '/api/guest/chat'`, `timestamp >= todayStart`, `wasBlocked = false`, and `statusCode < 400` — NOT from the in-memory `guestSessions` Map. The `timestamp` field (not `createdAt`) is the correct date field on `RateLimitLog`.
- `totalTokens` aggregation must use null-coalescing because `Message.tokenUsage` is `Int?` (nullable). Use Prisma `_sum` with `?? 0`.
- `hourlyData` JSON: keys are string hour numbers `"0"` to `"23"`, values are integer message counts. Missing hours default to 0.
- `uniqueUsers` = count of distinct `userId` from today's `Message` records.
- Est. cost is NOT stored — computed client-side.

After schema change: run `npm run db:push` in `/backend`.

---

## Backend

### New File: `backend/src/jobs/analyticsJob.js`

- Exported as `{ init }` — same pattern as `rateLimitJobs.js`
- `init()` calls `setInterval(runSnapshot, 30 * 60 * 1000)` and immediately calls `runSnapshot()` once on startup
- `runSnapshot()` aggregates for today (UTC calendar day):
  1. Count `Message` records with `role = 'user'` and `createdAt >= todayStart` → `userChats`
  2. Sum `tokenUsage` (null-coalesced) from today's `Message` records → `totalTokens`
  3. Count distinct `userId` from today's `Message` records → `uniqueUsers`
  4. Count `RateLimitLog` records where `endpoint = '/api/guest/chat'` and `timestamp >= todayStart` and `wasBlocked = false` and `statusCode < 400` → `guestChats`
     **Note:** `RateLimitLog` uses `timestamp` (not `createdAt`). Filter `wasBlocked = false AND statusCode < 400` to count only successfully served chats, not blocked/errored requests.
  5. Build `hourlyData`: group today's user messages by `createdAt` hour
  6. Upsert `AnalyticsSnapshot` with `where: { date: todayDate }` (MySQL `DATE` value)

### Updated: `backend/src/app.js`

Add a dedicated `initializeAnalyticsSystem()` function (separate from `initializeRateLimitSystem()`) called during server startup:

```js
const initializeAnalyticsSystem = async () => {
  try {
    const analyticsJob = require('./jobs/analyticsJob');
    analyticsJob.init();
    console.log('✅ [ANALYTICS] Analytics snapshot job initialized');
  } catch (error) {
    console.error('❌ [ANALYTICS] Failed to initialize analytics job:', error.message);
  }
};
// Called inside server.listen callback, after initializeRateLimitSystem()
```

### Updated: `backend/src/controllers/adminController.js`

**`getRealtimeAnalytics`** — live query, no caching:
- Queries DB for today's user chats, active users, total tokens (null-coalesced)
- Queries `RateLimitLog` for today's guest chat count
- Reads yesterday's `AnalyticsSnapshot` for delta calculation
- Returns:
  ```json
  {
    "success": true,
    "realtime": {
      "chatToday": 183,
      "activeUsers": 64,
      "tokensUsed": 118420,
      "guestChats": 69,
      "userChats": 114,
      "delta": {
        "chatToday": 12.4,
        "activeUsers": 8.1,
        "tokensUsed": -3.2
      }
    }
  }
  ```

**`getHistoryAnalytics`** — reads from `AnalyticsSnapshot`:
- Query param: `?range=7d` (default) or `?range=30d`
- Returns: array of daily snapshots, aggregated `hourlyData` (sum across range), top 10 users by message count (queried from `Message` + `User` join, LIMIT 10)
- Returns:
  ```json
  {
    "success": true,
    "range": "7d",
    "snapshots": [...],
    "hourlyData": { "0": 12, ..., "23": 4 },
    "topUsers": [
      { "rank": 1, "name": "Ahmad Fauzi", "chats": 47, "tokens": 12400 }
    ]
  }
  ```

### Updated: `backend/src/routes/adminRoutes.js`

```js
// Middleware: requireAdmin already calls requireAuth internally.
// Apply ONLY requireAdmin at the router level to avoid double requireAuth execution.
router.use(requireAdmin);

router.get('/chat-logs', getChatLogs);
router.get('/analytics/realtime', getRealtimeAnalytics);
router.get('/analytics/history', getHistoryAnalytics);
```

> **Note on middleware:** `requireAdmin` (line 196 of `authMiddleware.js`) internally calls `requireAuth`. The previous pattern `router.use(requireAuth, requireAdmin)` caused `requireAuth` to execute twice per request. Fixed to `router.use(requireAdmin)` only.

---

## Frontend

### Prerequisite
```bash
cd frontend && npm install recharts
```

### Charts used from Recharts
- `BarChart + Bar` — Chat Volume (7D/30D)
- `PieChart + Pie` — User vs Guest donut
- `AreaChart + Area` — Token Usage trend
- Custom grid `div` cells — Peak Hours heatmap (24 cells, color-intensity from `hourlyData`)
- Native HTML table — Top 10 Users

### Updated: `frontend/src/pages/AdminDashboard.jsx`

**Tab switching:**
- Add `const [activeTab, setActiveTab] = useState('analytics')` (default to analytics view)
- Sidebar nav: activate "Analytics" link, keep "Chat Logs" link functional
- Render `<AnalyticsView />` or `<LogsView />` based on `activeTab`

**`AnalyticsView` (inline component or separate file):**

Data fetching:
```js
// On mount — history (loaded once)
useEffect(() => {
  fetchHistory(range); // range = '7d' | '30d'
}, [range]);

// Realtime polling (every 30s)
useEffect(() => {
  fetchRealtime();
  const interval = setInterval(fetchRealtime, 30000);
  return () => clearInterval(interval);
}, []);
```

Est. Cost computation (client-side):
```js
// GPT-4o-mini input-only pricing: $0.15 per 1M tokens = $0.00000015 per token
// NOTE: tokenUsage includes both input+output tokens. Output costs $0.60/M (4x higher).
// This formula gives a LOWER BOUND — real cost is higher. UI label: "Est. Min. Cost"
// Update COST_PER_TOKEN if the model or OpenAI pricing changes.
const COST_PER_TOKEN = 0.00000015;
const estCost = (tokensUsed * COST_PER_TOKEN).toFixed(4);
const estCostIDR = Math.round(tokensUsed * COST_PER_TOKEN * 16000); // approx IDR rate
```

---

## Data Flow

```
[analyticsJob — every 30min]
  → Query Message (DB) → userChats, totalTokens, uniqueUsers, hourlyData
  → Query RateLimitLog (DB) → guestChats
  → Upsert AnalyticsSnapshot for today (date key = MySQL DATE)

[Frontend — on mount]
  → GET /api/admin/analytics/history?range=7d
  → Render: Chat Volume bars, Token Trend area, Peak Hours heatmap, Top 10 Users table

[Frontend — every 30s]
  → GET /api/admin/analytics/realtime
  → Update: KPI cards + User vs Guest donut

[Frontend — display]
  → Est. Cost = tokensUsed × 0.00000015  (client-side, documented constant)
```

---

## Out of Scope

- Email reports / exports
- Per-conversation drill-down from analytics
- Analytics for non-admin users
- Backfilling historical data before deployment (snapshots start from first job run)

---

## Files Changed

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `AnalyticsSnapshot` model |
| `backend/src/jobs/analyticsJob.js` | **New** — snapshot aggregation job |
| `backend/src/controllers/adminController.js` | Add `getRealtimeAnalytics`, `getHistoryAnalytics` |
| `backend/src/routes/adminRoutes.js` | Fix middleware pattern; add 2 new routes |
| `backend/src/app.js` | Add `initializeAnalyticsSystem()` and call on startup |
| `frontend/src/pages/AdminDashboard.jsx` | Add Analytics tab, charts, polling logic |
| `frontend/package.json` | Add `recharts` dependency |
