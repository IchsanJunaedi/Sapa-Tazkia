// backend/playwright.config.js
// Playwright config for Functional / E2E testing.
// Coverage is collected per-test via a custom fixture (see tests/e2e/fixtures.js)
// and written to coverage/e2e/lcov.info so it can be merged with the Jest
// coverage report via scripts/merge-coverage.js.

const { defineConfig, devices } = require('@playwright/test');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.test') });

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100';
const REQUIRES_AUTH = (process.env.E2E_REQUIRES_AUTH || 'true').toLowerCase() !== 'false';
const FRONTEND_PORT = new URL(BASE_URL).port || '3100';

module.exports = defineConfig({
  testDir: './tests/e2e',
  // Allow individual tests up to 2 minutes so cold-start CI runs that wait on
  // OpenAI + Qdrant can complete the QA-flow round trip within a single test
  // body. The expect-level timeout stays tight so per-assertion failures
  // surface quickly.
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 1 retry in CI is enough now that auth runs via API instead of UI; more
  // retries just compound rate-limit/state issues without surfacing real bugs.
  retries: process.env.CI ? 1 : 0,
  // Limit to 2 workers locally so the heavy serial suites (conversation-mgmt
  // + full-journey) don't race each other over the same test user account.
  /* Set workers to 1 to ensure absolute stability and prevent database contention. */
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'coverage/e2e/html-report', open: 'never' }],
    ['json', { outputFile: 'coverage/e2e/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    ...(REQUIRES_AUTH ? { storageState: './tests/e2e/.auth/user.json' } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Atur PLAYWRIGHT_SLOW_MO=1000 untuk memperlambat eksekusi (ms per aksi)
    // Berguna saat ingin "menonton" tes berjalan di browser.
    // Contoh: PLAYWRIGHT_SLOW_MO=1000 npx playwright test --headed
    // CATATAN: Jangan set slowMo otomatis untuk --headed karena akan merusak
    // loop toPass() di conversation-mgmt dan full-journey (habiskan waktu retry).
    launchOptions: {
      slowMo: process.env.PLAYWRIGHT_SLOW_MO ? Number(process.env.PLAYWRIGHT_SLOW_MO) : 0,
    },
  },
  ...(REQUIRES_AUTH ? { globalSetup: './tests/e2e/globalSetup.js' } : {}),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm start',
      cwd: '.',
      url: 'http://127.0.0.1:5000/health',
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...process.env,
        FRONTEND_URL: BASE_URL,
      },
    },
    {
      command: 'npm start',
      cwd: '../frontend',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...process.env,
        BROWSER: 'none',
        PORT: FRONTEND_PORT,
        // The frontend axios layer requests endpoints relative to this base
        // and assumes the `/api` prefix is already included (see
        // frontend/.env.example). Without it, every request 404s on the
        // backend's /api-prefixed routes.
        REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api',
      },
    },
  ],
});
