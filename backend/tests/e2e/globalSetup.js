// backend/tests/e2e/globalSetup.js
//
// Runs once before any Playwright worker spawns. Responsibilities:
//   1. Load .env / .env.test so process.env mirrors what the running app sees.
//   2. Wait until both the backend (/health) and frontend (BASE_URL) are
//      reachable.
//   3. Authenticate via the API (see authHelper.js) and persist a Playwright
//      storageState to .auth/user.json so worker contexts start logged-in.
//
// On failure, drop a JSON breadcrumb under coverage/e2e/ so the CI artifact
// upload surfaces *why* setup failed instead of just a stack trace.

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');

const FAILURE_DIR = path.resolve(__dirname, '../../coverage/e2e');
const FAILURE_LOG_PATH = path.join(FAILURE_DIR, 'globalSetup-failure.json');

function loadE2EEnv() {
  const backendRoot = path.resolve(__dirname, '../..');
  const envTestPath = path.join(backendRoot, '.env.test');
  const envPath = path.join(backendRoot, '.env');

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  if (fs.existsSync(envTestPath)) {
    dotenv.config({ path: envTestPath, override: true });
  }
}

/**
 * Polls `url` until it responds with any HTTP status code (not a connection error).
 * Retries every `intervalMs` ms up to `timeoutMs` total.
 */
async function waitForServer(url, { timeoutMs = 180_000, intervalMs = 2_000 } = {}) {
  const lib = url.startsWith('https') ? https : http;
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts++;
    const ok = await new Promise((resolve) => {
      const req = lib.get(url, (res) => { res.resume(); resolve(true); });
      req.on('error', () => resolve(false));
      req.setTimeout(3_000, () => { req.destroy(); resolve(false); });
    });

    if (ok) {
      // eslint-disable-next-line no-console
      console.log(`[globalSetup] Server at ${url} is ready (attempt ${attempts})`);
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`[globalSetup] Waiting for ${url} … (attempt ${attempts})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`[globalSetup] Server at ${url} did not become ready within ${timeoutMs / 1000}s`);
}

function recordFailure(stage, err) {
  try {
    fs.mkdirSync(FAILURE_DIR, { recursive: true });
    fs.writeFileSync(
      FAILURE_LOG_PATH,
      JSON.stringify(
        {
          stage,
          message: err && err.message ? err.message : String(err),
          stack: err && err.stack ? err.stack : null,
          env: {
            E2E_BASE_URL: process.env.E2E_BASE_URL || null,
            E2E_API_BASE_URL: process.env.E2E_API_BASE_URL || null,
            E2E_REQUIRES_AUTH: process.env.E2E_REQUIRES_AUTH || null,
            hasNim: !!process.env.E2E_LOGIN_NIM,
            hasPassword: !!process.env.E2E_LOGIN_PASSWORD,
          },
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (_writeErr) {
    // Best-effort; don't shadow the original error.
  }
}

async function globalSetup() {
  loadE2EEnv();

  const requiresAuth = (process.env.E2E_REQUIRES_AUTH || 'true').toLowerCase() !== 'false';

  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const apiBaseURL = (process.env.E2E_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  const backendHealthURL = `${apiBaseURL}/health`;

  try {
    // eslint-disable-next-line no-console
    console.log('[globalSetup] Waiting for backend …');
    await waitForServer(backendHealthURL);

    // eslint-disable-next-line no-console
    console.log('[globalSetup] Waiting for frontend …');
    await waitForServer(baseURL);
  } catch (err) {
    recordFailure('waitForServer', err);
    throw err;
  }

  if (!requiresAuth) {
    return;
  }

  try {
    const { ensureLoggedIn } = require('./authHelper');
    await ensureLoggedIn();
  } catch (err) {
    recordFailure('ensureLoggedIn', err);
    throw err;
  }
}

module.exports = globalSetup;
