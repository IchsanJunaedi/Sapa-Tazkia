// backend/tests/e2e/authHelper.js
//
// Playwright login helper for tests that need access to protected routes
// (e.g. /chat, /academic). Performs an API-based login (not UI) and persists
// a Playwright storageState file with the JWT injected into localStorage.
//
// Why API login instead of submitting the login form?
//   * Faster + deterministic — no race with React hydration, no 1.5s
//     setTimeout in LoginPage, no fragile selector matching.
//   * Survives backend rate limiters and frontend redesigns.
//   * Standard Playwright pattern for auth setup.
//
// Required env:
//   E2E_BASE_URL          (default http://localhost:3000)
//   E2E_API_BASE_URL      (default http://localhost:5000) — backend root, no /api suffix
//   E2E_LOGIN_NIM         (test account NIM/email)
//   E2E_LOGIN_PASSWORD    (test account password)
//
// Optional env:
//   E2E_LOGIN_PATH        (default /api/auth/login) — appended to E2E_API_BASE_URL
//   E2E_FORCE_RELOGIN=1   force a fresh login even if a cached storage state exists

const fs = require('fs');
const path = require('path');
const { request: playwrightRequest } = require('@playwright/test');

const STORAGE_DIR = path.resolve(__dirname, '.auth');
const STORAGE_STATE_PATH = path.join(STORAGE_DIR, 'user.json');
const FAILURE_DIR = path.resolve(__dirname, '../../coverage/e2e');
const FAILURE_LOG_PATH = path.join(FAILURE_DIR, 'globalSetup-failure.json');

function getConfig() {
  return {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    apiBaseURL: (process.env.E2E_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, ''),
    loginPath: process.env.E2E_LOGIN_PATH || '/api/auth/login',
    nim: process.env.E2E_LOGIN_NIM || '',
    password: process.env.E2E_LOGIN_PASSWORD || '',
  };
}

/**
 * POSTs to the backend login endpoint and returns the issued JWT + user object.
 * Throws a descriptive error if the credentials are invalid or the backend
 * is unreachable / returns an unexpected payload.
 */
async function loginViaApi() {
  const cfg = getConfig();

  if (!cfg.nim || !cfg.password) {
    throw new Error(
      '[authHelper] Missing E2E_LOGIN_NIM / E2E_LOGIN_PASSWORD. ' +
      'Set them in .env.test or the CI env before running protected E2E specs.'
    );
  }

  const ctx = await playwrightRequest.newContext({
    baseURL: cfg.apiBaseURL,
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      // Origin is required by some CORS-sensitive servers; mirrors the SPA.
      Origin: cfg.baseURL,
    },
  });

  let response;
  try {
    response = await ctx.post(cfg.loginPath, {
      data: { identifier: cfg.nim, password: cfg.password },
      timeout: 30_000,
    });
  } catch (err) {
    await ctx.dispose();
    throw new Error(
      `[authHelper] Login request failed: ${err.message}. ` +
      `Is the backend reachable at ${cfg.apiBaseURL}${cfg.loginPath}?`
    );
  }

  const status = response.status();
  let body;
  try {
    body = await response.json();
  } catch (_err) {
    body = { raw: await response.text() };
  }

  await ctx.dispose();

  if (status !== 200 || !body.success || !body.token || !body.user) {
    throw new Error(
      `[authHelper] Login failed (HTTP ${status}). ` +
      `Body: ${JSON.stringify(body).slice(0, 500)}. ` +
      `Check that E2E_LOGIN_NIM (${cfg.nim}) exists in the test database, ` +
      'that the seed hashes the configured E2E_LOGIN_PASSWORD as the password, ' +
      'and that the user has status="active" + isEmailVerified=true.'
    );
  }

  return { token: body.token, user: body.user };
}

/**
 * Builds a Playwright storage state object that injects the JWT + user into
 * localStorage for the SPA origin. AuthContext picks up these keys on first
 * render so subsequent navigations are already authenticated.
 */
function buildStorageState({ token, user, baseURL }) {
  return {
    cookies: [],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: 'token', value: token },
          { name: 'user', value: JSON.stringify(user) },
        ],
      },
    ],
  };
}

/**
 * Logs into the backend via the API and writes a Playwright storage state
 * file containing the JWT in localStorage. Returns the absolute path to the
 * storage state JSON file so callers can pass it to `test.use({ storageState })`.
 *
 * Idempotent: if a cached storage state already exists on disk, it is reused
 * unless `E2E_FORCE_RELOGIN=1` is set.
 *
 * @param {import('@playwright/test').Browser} [_browser] (unused; kept for backwards
 *   compatibility with previous UI-based signature)
 * @returns {Promise<string>} absolute path to the storage state JSON file.
 */
async function ensureLoggedIn(_browser) {
  const cfg = getConfig();

  if (fs.existsSync(STORAGE_STATE_PATH) && !process.env.E2E_FORCE_RELOGIN) {
    return STORAGE_STATE_PATH;
  }

  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  fs.mkdirSync(FAILURE_DIR, { recursive: true });

  try {
    const { token, user } = await loginViaApi();
    const state = buildStorageState({ token, user, baseURL: cfg.baseURL });
    fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(state, null, 2));
    return STORAGE_STATE_PATH;
  } catch (err) {
    // Persist a small JSON breadcrumb so CI artifacts surface why login failed
    // without dumping secrets into stdout.
    try {
      fs.writeFileSync(
        FAILURE_LOG_PATH,
        JSON.stringify(
          {
            stage: 'authHelper.ensureLoggedIn',
            message: err.message,
            apiBaseURL: cfg.apiBaseURL,
            loginPath: cfg.loginPath,
            baseURL: cfg.baseURL,
            hasNim: !!cfg.nim,
            hasPassword: !!cfg.password,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } catch (_writeErr) {
      // Best-effort; ignore if the directory isn't writable.
    }
    throw err;
  }
}

ensureLoggedIn.storageStatePath = STORAGE_STATE_PATH;
ensureLoggedIn.STORAGE_DIR = STORAGE_DIR;
ensureLoggedIn.FAILURE_LOG_PATH = FAILURE_LOG_PATH;
ensureLoggedIn.loginViaApi = loginViaApi;

module.exports = { ensureLoggedIn };
