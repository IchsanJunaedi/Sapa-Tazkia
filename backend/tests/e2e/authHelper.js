// backend/tests/e2e/authHelper.js
//
// Playwright login helper for tests that need access to protected routes
// (e.g. /chat, /academic). Caches a logged-in storage state on disk so only
// the first test pays the login cost.
//
// Usage inside a spec:
//
//   const { ensureLoggedIn } = require('./authHelper');
//   test.use({ storageState: ensureLoggedIn.storageStatePath });
//   test.beforeAll(async ({ browser }) => { await ensureLoggedIn(browser); });
//
// Required env:
//   E2E_BASE_URL     (default http://localhost:3000)
//   E2E_LOGIN_PATH   (default /login)
//   E2E_LOGIN_NIM    (your test account NIM / username / email)
//   E2E_LOGIN_PASSWORD
//
// Optional env to override selectors if your login form differs:
//   E2E_LOGIN_NIM_SELECTOR       (default supports "Email atau NIM" single-field login)
//   E2E_LOGIN_PASSWORD_SELECTOR  (default [name="password"], optional)
//   E2E_LOGIN_SUBMIT_SELECTOR    (default button[type="submit"])
//   E2E_LOGIN_SUCCESS_URL        (regex fragment, default /(chat|dashboard|academic|home)/)

const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.resolve(__dirname, '.auth');
const STORAGE_STATE_PATH = path.join(STORAGE_DIR, 'user.json');

const DEFAULTS = {
  baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
  loginPath: process.env.E2E_LOGIN_PATH || '/login',
  nim: process.env.E2E_LOGIN_NIM || '',
  password: process.env.E2E_LOGIN_PASSWORD || '',
  nimSelector:
    process.env.E2E_LOGIN_NIM_SELECTOR ||
    'input[name="nim"], input[name="email"], input[type="email"], input[placeholder="Email atau NIM"], input[type="text"]',
  passwordSelector: process.env.E2E_LOGIN_PASSWORD_SELECTOR || 'input[name="password"], input[type="password"]',
  submitSelector: process.env.E2E_LOGIN_SUBMIT_SELECTOR || 'button[type="submit"]',
  successUrlPattern: new RegExp(process.env.E2E_LOGIN_SUCCESS_URL || '(chat|dashboard|academic|home)'),
};

/**
 * Logs into the app via the login form and persists the authenticated storage
 * state (cookies + localStorage) to `.auth/user.json` for reuse.
 *
 * Idempotent: if a valid storage state already exists on disk, it is returned
 * directly and no browser traffic occurs.
 *
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<string>} absolute path to the storage state JSON file.
 */
async function ensureLoggedIn(browser) {
  if (!DEFAULTS.nim || !DEFAULTS.password) {
    throw new Error(
      '[authHelper] Missing E2E_LOGIN_NIM / E2E_LOGIN_PASSWORD. ' +
      'Set them in .env.test or the CI env before running protected E2E specs.'
    );
  }

  if (fs.existsSync(STORAGE_STATE_PATH)) {
    // Trust the cached state. Tests that hit stale tokens can delete the file
    // or set E2E_FORCE_RELOGIN=1.
    if (!process.env.E2E_FORCE_RELOGIN) return STORAGE_STATE_PATH;
    fs.unlinkSync(STORAGE_STATE_PATH);
  }

  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  const context = await browser.newContext({ baseURL: DEFAULTS.baseURL });
  const page = await context.newPage();

  await page.goto(DEFAULTS.loginPath);

  // Fill NIM / email. Prefer the first visible match.
  const nimField = page.locator(DEFAULTS.nimSelector).first();
  await nimField.waitFor({ state: 'visible', timeout: 15_000 });
  await nimField.fill(DEFAULTS.nim);

  const pwField = page.locator(DEFAULTS.passwordSelector).first();
  const hasVisiblePasswordField = await pwField
    .waitFor({ state: 'visible', timeout: 2_000 })
    .then(() => true)
    .catch(() => false);

  if (hasVisiblePasswordField) {
    await pwField.fill(DEFAULTS.password);
  }

  await page.locator(DEFAULTS.submitSelector).first().click();

  // Race: either we navigate away from /login (success) OR an error message
  // appears on the page (credentials rejected). Detecting the error early
  // avoids a cryptic 20-second timeout and surfaces the real problem.
  await Promise.race([
    page.waitForURL(
      (url) => !url.pathname.startsWith(DEFAULTS.loginPath) || DEFAULTS.successUrlPattern.test(url.pathname),
      { timeout: 20_000 }
    ),
    page
      .locator('[class*="text-red"], [class*="error"], [role="alert"]')
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(async () => {
        const errText = await page
          .locator('[class*="text-red"], [class*="error"], [role="alert"]')
          .first()
          .textContent()
          .catch(() => '(unknown error)');
        throw new Error(
          `[authHelper] Login failed — the page showed an error: "${errText.trim()}"\n` +
          `Check that E2E_LOGIN_NIM (${DEFAULTS.nim}) exists in the test database ` +
          `and that the seed hashes the NIM itself as the password.`
        );
      }),
  ]);

  await context.storageState({ path: STORAGE_STATE_PATH });
  await context.close();

  return STORAGE_STATE_PATH;
}

ensureLoggedIn.storageStatePath = STORAGE_STATE_PATH;
ensureLoggedIn.STORAGE_DIR = STORAGE_DIR;

module.exports = { ensureLoggedIn };
