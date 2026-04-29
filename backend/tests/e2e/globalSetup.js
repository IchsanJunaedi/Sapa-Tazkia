const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { chromium } = require('@playwright/test');
const http = require('http');
const https = require('https');

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
      console.log(`[globalSetup] Server at ${url} is ready (attempt ${attempts})`);
      return;
    }

    console.log(`[globalSetup] Waiting for ${url} … (attempt ${attempts})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`[globalSetup] Server at ${url} did not become ready within ${timeoutMs / 1000}s`);
}

async function globalSetup() {
  loadE2EEnv();

  const requiresAuth = (process.env.E2E_REQUIRES_AUTH || 'true').toLowerCase() !== 'false';

  if (!requiresAuth) {
    return;
  }

  // Wait for both servers before attempting login
  const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
  const backendURL = 'http://127.0.0.1:5000/health';

  console.log('[globalSetup] Waiting for backend …');
  await waitForServer(backendURL);

  console.log('[globalSetup] Waiting for frontend …');
  await waitForServer(baseURL);

  const { ensureLoggedIn } = require('./authHelper');
  const browser = await chromium.launch();
  try {
    await ensureLoggedIn(browser);
  } finally {
    await browser.close();
  }
}


module.exports = globalSetup;
