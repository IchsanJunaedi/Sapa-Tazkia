// backend/tests/e2e/fixtures.js
//
// Custom Playwright fixture that collects V8 JS coverage for every test run
// against a Chromium browser, converts it to Istanbul/lcov format via
// `monocart-coverage-reports`, and writes the merged report to:
//
//     coverage/e2e/lcov.info
//
// The output is then concatenated with Jest's `coverage/jest/lcov.info` by
// `scripts/merge-coverage.js` so that Codecov sees a single unified report.
//
// Usage in a spec file:
//
//     const { test, expect } = require('./fixtures');
//     test('...', async ({ page }) => { ... });
//
// Dependencies (install once, see backend/package.json devDependencies):
//     npm i -D @playwright/test monocart-coverage-reports

const base = require('@playwright/test');
const path = require('path');

// Lazy require so the file still loads even if the package is missing
// (useful when running `--list` in a fresh checkout before `npm install`).
let MCR;
try {
  MCR = require('monocart-coverage-reports');
} catch (_err) {
  MCR = null;
}

const coverageOptions = {
  name: 'E2E Coverage',
  outputDir: path.resolve(__dirname, '../../coverage/e2e'),
  // `lcovonly` produces lcov.info directly; `v8-json` keeps the raw data for
  // deeper inspection if needed.
  reports: [
    ['lcovonly', { file: 'lcov.info' }],
    ['v8-json', { file: 'coverage.json' }],
    ['console-summary'],
  ],
  // Only keep coverage for YOUR application source, not third-party bundles.
  entryFilter: (entry) => {
    const url = entry.url || '';
    return (
      !url.includes('/node_modules/') &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('data:')
    );
  },
  sourceFilter: (sourcePath) => /src\//.test(sourcePath),
  cleanCache: true,
};

exports.test = base.test.extend({
  page: async ({ page, browserName }, use, testInfo) => {
    const canCollect = browserName === 'chromium' && MCR;

    if (canCollect) {
      await page.coverage.startJSCoverage({
        resetOnNavigation: false,
      });
    }

    await use(page);

    if (canCollect) {
      const jsCoverage = await page.coverage.stopJSCoverage();
      try {
        const mcr = MCR(coverageOptions);
        await mcr.add(jsCoverage);
        // Only generate the final report once after the last test — but
        // calling generate() per test is also safe because MCR merges
        // incrementally when `cleanCache: false`. We set cleanCache true
        // on the first test only:
        coverageOptions.cleanCache = false;
        if (testInfo.project.metadata?.lastTest) {
          await mcr.generate();
        } else {
          // Persist the incremental raw data; generate() is invoked in a
          // globalTeardown hook (see playwright.config.js to enable).
          await mcr.generate();
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[e2e coverage] failed to record coverage:', err.message);
      }
    }
  },
});

exports.expect = base.expect;
