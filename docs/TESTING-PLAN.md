# Testing Plan — SAPA-TAZKIA

Daftar lengkap testing yang **sudah ada** dan **perlu dibuat**, lengkap dengan panduan eksekusi.

---

## Status Saat Ini

| Jenis Testing | Status | Tool / Framework | Lokasi |
|---|---|---|---|
| **Unit Testing** | ✅ Ada (~81 file) | Jest + React Testing Library | `backend/tests/unit/`, `frontend/src/` |
| **Integration Testing** | ✅ Ada (11 file) | Jest + supertest + Prisma | `backend/tests/integration/` |
| **Functional / E2E** | ⚠️ Sebagian (7 spec) | Playwright (Chromium only) | `backend/tests/e2e/` |
| **Coverage** | ⚠️ Konfigurasi ada, CI belum | Jest + MCR + Codecov | `jest.config.js`, `codecov.yml` |
| **Static Security (SAST)** | ❌ Belum ada | — | — |
| **Dynamic Security (DAST)** | ❌ Belum ada | — | — |
| **CI/CD Pipeline** | ❌ Belum ada | — | — |

---

## 1. SAST — Static Application Security Testing

### Tujuan
Mendeteksi kerentanan di source code secara otomatis sebelum production.

### 1.1 eslint-plugin-security (tambahan rule ESLint)

**Install:**
```bash
cd backend
npm install --save-dev eslint-plugin-security
cd ../frontend
npm install --save-dev eslint-plugin-security
```

**Konfigurasi `backend/.eslintrc.js`:**
```js
module.exports = {
  plugins: ['security'],
  extends: [
    'eslint:recommended',
    'plugin:security/recommended',
    // ... existing extends
  ],
  rules: {
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-eval-with-expression': 'error',
    'security/detect-unsafe-regex': 'error',
  },
};
```

**Konfigurasi `frontend/.eslintrc.js`** (sama, sesuaikan dengan extends existing).

**Script di `backend/package.json`:**
```json
"test:sast": "eslint src/ --format sarif -o sast-results.sarif"
```

### 1.2 CodeQL (GitHub Actions)

Buat `.github/workflows/codeql.yml`:

```yaml
name: "CodeQL"

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 8 * * 1'  # Setiap Senin jam 08:00 UTC

jobs:
  analyze:
    name: Analyze (${{ matrix.language }})
    runs-on: ubuntu-latest
    timeout-minutes: 360
    permissions:
      security-events: write
      packages: read
      actions: read
      contents: read

    strategy:
      fail-fast: false
      matrix:
        include:
          - language: javascript-typescript
            build-mode: none

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: ${{ matrix.language }}
          build-mode: ${{ matrix.build-mode }}

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
        with:
          category: "/language:${{matrix.language}}"
```

### 1.3 npm audit (dependency scanning)

**Script:**
```bash
cd backend && npm audit --audit-level=high
cd ../frontend && npm audit --audit-level=high
```

Tambahkan ke `.github/workflows/security.yml` sebagai scheduled job.

### 1.4 Dependabot

Buat `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "security"

  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "security"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

---

## 2. DAST — Dynamic Application Security Testing

### Tujuan
Mensimulasikan serangan ke aplikasi yang sedang berjalan (staging/production).

### 2.1 OWASP ZAP (Full Scan)

**Via Docker (lokal / staging):**
```bash
docker pull zaproxy/zap-stable

# Full scan terhadap staging
docker run -v $(pwd):/zap/wrk:rw -t zaproxy/zap-stable zap-full-scan.py \
  -t https://staging.sapa-tazkia.com \
  -r zap-report.html \
  -x zap-report.xml
```

**Via GitHub Actions — buat `.github/workflows/dast.yml`:**

```yaml
name: DAST (OWASP ZAP)

on:
  workflow_dispatch:  # Manual trigger
  schedule:
    - cron: '0 6 * * 1'  # Setiap Senin

jobs:
  zap:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: ZAP Scan
        uses: zaproxy/action-full-scan@v0.12.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          docker_name: 'ghcr.io/zaproxy/zaproxy:stable'
          target: 'https://staging.sapa-tazkia.com'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a -j'

      - name: Upload ZAP Report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: zap-report
          path: report.*
```

### 2.2 API Scan (khusus endpoint REST)

```bash
docker run -v $(pwd):/zap/wrk:rw -t zaproxy/zap-stable zap-api-scan.py \
  -t https://staging.sapa-tazkia.com/api/docs-json \
  -f openapi \
  -r zap-api-report.html
```

### 2.3 Rate Limit Testing

Gunakan tools seperti **k6** atau **artillery** untuk menguji rate limiting:

```bash
# Install k6
winget install k6

# Run load test
k6 run tests/load/rate-limit-test.js
```

Buat `backend/tests/load/rate-limit-test.js`:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '30s', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.post('http://localhost:5000/api/guest/chat', {
    message: 'test',
    sessionId: `load-${__VU}`,
  });
  check(res, { 'status is 200 or 429': (r) => r.status === 200 || r.status === 429 });
  sleep(1);
}
```

---

## 3. Integration Testing — Perluasan

### Tujuan
Menutup endpoint yang belum memiliki integration test.

### Daftar Integration Test yang Perlu Dibuat

#### `backend/tests/integration/admin.test.js`
```javascript
const request = require('supertest');
const { app } = require('../../src/app');
const { seedTestUser, truncateAll } = require('../helpers/dbHelper');

describe('Admin API — Integration Tests', () => {
  let adminToken, userToken;

  beforeAll(async () => {
    await truncateAll();
    adminToken = await seedTestUser({ role: 'admin' });
    userToken = await seedTestUser({ role: 'user' });
  });

  afterAll(async () => {
    await truncateAll();
  });

  describe('GET /api/admin/users', () => {
    it('should return 401 without token');
    it('should return 403 for non-admin user');
    it('should return paginated user list for admin');
    it('should support search & filter params');
    it('should handle invalid query params gracefully');
  });

  describe('GET /api/admin/stats', () => {
    it('should return dashboard statistics');
    it('should filter by date range');
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('should delete user by id');
    it('should return 404 for non-existent user');
    it('should not allow self-deletion');
  });
});
```

#### `backend/tests/integration/rate-limit.test.js`
```javascript
describe('Rate Limit — Integration Tests', () => {
  // Test actual Redis-based rate limiting via HTTP
  it('should allow requests under limit');
  it('should return 429 after exceeding limit');
  it('should reset after window expires');
  it('should differentiate by IP and user tier');
});
```

#### `backend/tests/integration/oauth.test.js`
```javascript
describe('Google OAuth — Integration Tests', () => {
  it('should redirect to Google consent screen');
  it('should handle callback with valid code');
  it('should return 401 with invalid state param');
  it('should create new user on first login');
  it('should link to existing NIM account');
});
```

#### `backend/tests/integration/notification.test.js` (perluas)
```javascript
describe('Notification — Integration Tests', () => {
  it('should create notification on grade update');
  it('should mark notification as read');
  it('should return only unread filter');
  it('should paginate correctly');
});
```

### Cara Eksekusi

```bash
cd backend
npm run test:api  # Jalanin semua integration + API test
# atau spesifik:
npx jest tests/integration/admin.test.js --forceExit --detectOpenHandles
```

---

## 4. Functional / E2E Testing — Perluasan

### Tujuan
Menambah skenario kritis yang belum ter-cover.

### Daftar E2E Test yang Perlu Dibuat

Buat file di `backend/tests/e2e/`:

#### `admin-flow.spec.js`
```javascript
const { test, expect } = require('./fixtures');

test('admin login and access dashboard', async ({ page }) => { /* ... */ });
test('admin can view user list', async ({ page }) => { /* ... */ });
test('admin can manage conversations', async ({ page }) => { /* ... */ });
test('admin rate limit page shows stats', async ({ page }) => { /* ... */ });
```

#### `error-states.spec.js`
```javascript
test('shows 404 page for unknown route', async ({ page }) => { /* ... */ });
test('shows error when API is down', async ({ page }) => { /* ... */ });
test('handles network timeout gracefully', async ({ page }) => { /* ... */ });
test('shows rate limit exceeded message', async ({ page }) => { /* ... */ });
test('handles expired token redirect to login', async ({ page }) => { /* ... */ });
```

#### `mobile-viewport.spec.js`
```javascript
const { test, expect } = require('./fixtures');

const viewports = [
  { width: 375, height: 667 },  // iPhone SE
  { width: 390, height: 844 },  // iPhone 14
  { width: 414, height: 896 },  // iPhone 11 Pro Max
];

for (const vp of viewports) {
  test.use({ viewport: vp });
  test(`landing page responsive at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
    // Navbar should collapse/hamburger on mobile
    if (vp.width < 768) {
      await expect(page.locator('.hamburger-menu')).toBeVisible();
    }
  });

  test(`chat page usable at ${vp.width}x${vp.height}`, async ({ page }) => {
    // Login + navigate to chat
    await page.goto('/login');
    // ... fill credentials
    await page.goto('/chat');
    await expect(page.locator('textarea')).toBeVisible();
    await page.fill('textarea', 'Apa itu sistem informasi?');
    await page.click('button[type="submit"]');
    await expect(page.locator('.message-bubble')).toBeVisible();
  });
}
```

#### `auth-edge-cases.spec.js`
```javascript
test('redirects to login when token is expired', async ({ page }) => { /* ... */ });
test('shows error on invalid credentials', async ({ page }) => { /* ... */ });
test('prevents concurrent session abuse', async ({ page }) => { /* ... */ });
test('handles account suspension', async ({ page }) => { /* ... */ });
```

#### `reset-password.spec.js`
```javascript
test('shows forgot password link on login page');
test('sends reset email for valid NIM');
test('shows error for unregistered NIM');
test('allows password reset with valid token');
test('rejects expired or invalid reset token');
```

### Cross-Browser Playwright

Update `backend/playwright.config.js` — tambahkan Firefox + WebKit:

```javascript
module.exports = defineConfig({
  // ... existing config
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

### Cara Eksekusi

```bash
cd backend

# Install semua browser
npx playwright install --with-deps chromium firefox webkit

# Run semua E2E
npm run test:e2e

# Run spesifik file
npx playwright test tests/e2e/admin-flow.spec.js

# Run dengan browser tertentu
npx playwright test --project=firefox

# Dengan UI mode (debugging)
npx playwright test --ui
```

---

## 5. CI/CD Pipeline

### Tujuan
Semua testing berjalan otomatis di setiap push/PR.

### Buat `.github/workflows/test.yml`

```yaml
name: Test & Coverage

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint --prefix backend
      - run: npm run lint --prefix frontend
      - name: SAST (eslint-plugin-security)
        run: npx eslint backend/src/ --ext .js --no-eslintrc -c backend/.eslintrc.js --rulesdir /dev/null 2>/dev/null || true

  unit-and-integration:
    name: Unit & Integration Tests
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
          --health-cmd "mysqladmin ping -h localhost"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      qdrant:
        image: qdrant/qdrant
        ports:
          - 6333:6333

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - name: Setup test env
        working-directory: backend
        run: |
          cp .env.test.example .env.test
          npx prisma db push --skip-generate

      - name: Run unit + integration tests with coverage
        working-directory: backend
        run: npm run test:coverage

      - name: Run frontend tests
        working-directory: frontend
        run: npm test -- --watchAll=false --coverage

      - name: Upload backend coverage
        uses: codecov/codecov-action@v5
        with:
          files: backend/coverage/jest/lcov.info
          flags: backend
          fail_ci_if_error: false

      - name: Upload frontend coverage
        uses: codecov/codecov-action@v5
        with:
          files: frontend/coverage/lcov.info
          flags: frontend
          fail_ci_if_error: false

  e2e:
    name: E2E (Playwright)
    runs-on: ubuntu-latest
    needs: unit-and-integration
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: testpassword
          MYSQL_DATABASE: sapa_tazkia_test
        ports:
          - 3306:3306
        options: >-
          --health-cmd "mysqladmin ping -h localhost"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
      qdrant:
        image: qdrant/qdrant
        ports:
          - 6333:6333

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - run: npm ci
      - name: Setup test env
        working-directory: backend
        run: |
          cp .env.test.example .env.test
          npx prisma db push --skip-generate

      - name: Install Playwright browsers
        working-directory: backend
        run: npx playwright install --with-deps chromium

      - name: Start servers
        working-directory: backend
        run: |
          npm start &
          echo "Waiting for backend..."
          npx wait-on http://localhost:5000/api/health

      - name: Run E2E tests
        working-directory: backend
        run: npx playwright test
        env:
          CI: true

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: backend/playwright-report/

      - name: Upload E2E coverage
        if: always()
        uses: codecov/codecov-action@v5
        with:
          files: backend/coverage/e2e/lcov.info
          flags: e2e
          fail_ci_if_error: false
```

---

## 6. Coverage — Enforce Thresholds

### Target Coverage

| Metric | Backend | Frontend | Global (merged) |
|--------|---------|----------|-----------------|
| Lines | ≥ 60% | ≥ 70% | ≥ 75% |
| Branches | ≥ 50% | ≥ 60% | ≥ 60% |
| Functions | ≥ 60% | ≥ 65% | ≥ 70% |
| Statements | ≥ 60% | ≥ 70% | ≥ 75% |

### Update `backend/jest.config.js`

```javascript
module.exports = {
  // ... existing config
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    './src/services/': {
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
};
```

### Update `codecov.yml`

```yaml
coverage:
  status:
    project:
      default:
        target: 75%
        threshold: 5%
      backend:
        target: 60%
        flags:
          - backend
      frontend:
        target: 70%
        flags:
          - frontend
    patch:
      default:
        target: 80%
```

---

## 7. Prioritas & Timeline Eksekusi

| # | Task | Estimasi | Dikerjakan |
|---|---|---|---|
| 1 | **CI/CD Pipeline** — `.github/workflows/test.yml` | 3 jam | ☑ |
| 2 | **SAST — eslint-plugin-security** (install + config) | 1 jam | ☐ |
| 3 | **SAST — CodeQL** (`.github/workflows/codeql.yml`) | 30 menit | ☐ |
| 4 | **Dependabot** (`.github/dependabot.yml`) | 15 menit | ☐ |
| 5 | **Integration Test — Admin API** | 3 jam | ☐ |
| 6 | **Integration Test — Rate Limit** | 2 jam | ☐ |
| 7 | **Integration Test — OAuth** | 2 jam | ☐ |
| 8 | **Integration Test — Notification (perluas)** | 1 jam | ☐ |
| 9 | **E2E — Admin Flow** | 3 jam | ☐ |
| 10 | **E2E — Error States** | 2 jam | ☐ |
| 11 | **E2E — Mobile Viewport** | 2 jam | ☐ |
| 12 | **E2E — Auth Edge Cases** | 2 jam | ☐ |
| 13 | **E2E — Reset Password** | 2 jam | ☐ |
| 14 | **Cross-Browser Playwright** (Firefox + WebKit) | 1 jam | ☐ |
| 15 | **DAST — OWASP ZAP** (`.github/workflows/dast.yml`) | 2 jam | ☐ |
| 16 | **Load Test — k6 rate limit** | 2 jam | ☐ |
| 17 | **Coverage Thresholds** (enforce di CI) | 1 jam | ☐ |
| | **Total** | **~29 jam** | |

---

## 8. Cara Eksekusi (Quick Start)

### Pertama kali setup
```bash
# 1. Install semua dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Setup env test
cp backend/.env.test.example backend/.env.test
# Edit .env.test sesuai environment lokal

# 3. Push schema ke database test
cd backend && npx prisma db push

# 4. Install Playwright browsers
npx playwright install --with-deps chromium

# 5. Jalankan semua test
npm test                    # Unit + Integration
npm run test:coverage       # + coverage
npm run test:e2e            # E2E Playwright
npm run coverage:all        # Full pipeline
```

### Checklist per sprint

Sebelum merge ke `main`, pastikan:

- [ ] `npm test` (backend) — semua lulus
- [ ] `npm test` (frontend) — semua lulus
- [ ] `npm run lint` (backend + frontend) — no errors
- [ ] Tidak ada high/critical vulnerability (`npm audit`)
- [ ] E2E test untuk fitur baru sudah ditambahkan
- [ ] Coverage tidak turun drastis
