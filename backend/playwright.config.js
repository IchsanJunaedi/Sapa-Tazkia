// backend/playwright.config.js
// Playwright config for Functional / E2E testing.
// Coverage is collected per-test via a custom fixture (see tests/e2e/fixtures.js)
// and written to coverage/e2e/lcov.info so it can be merged with the Jest
// coverage report via scripts/merge-coverage.js.

const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3100';
const REQUIRES_AUTH = (process.env.E2E_REQUIRES_AUTH || 'true').toLowerCase() !== 'false';
const FRONTEND_PORT = new URL(BASE_URL).port || '3100';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
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
      url: 'http://localhost:5000/health',
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
        REACT_APP_API_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
      },
    },
  ],
});
