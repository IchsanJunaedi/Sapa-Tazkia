// backend/playwright.config.js
// Playwright config for Functional / E2E testing.
// Coverage is collected per-test via a custom fixture (see tests/e2e/fixtures.js)
// and written to coverage/e2e/lcov.info so it can be merged with the Jest
// coverage report via scripts/merge-coverage.js.

const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

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
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Uncomment to auto-start the frontend dev server before E2E runs.
  // webServer: {
  //   command: 'npm --prefix ../frontend start',
  //   url: BASE_URL,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
