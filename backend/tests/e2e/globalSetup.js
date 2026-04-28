const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { chromium } = require('@playwright/test');

function loadE2EEnv() {
  const backendRoot = path.resolve(__dirname, '../..');
  const envTestPath = path.join(backendRoot, '.env.test');
  const envPath = path.join(backendRoot, '.env');
  const selectedEnvPath = fs.existsSync(envTestPath) ? envTestPath : envPath;

  if (fs.existsSync(selectedEnvPath)) {
    dotenv.config({ path: selectedEnvPath });
  }
}

async function globalSetup() {
  loadE2EEnv();

  const requiresAuth = (process.env.E2E_REQUIRES_AUTH || 'true').toLowerCase() !== 'false';

  if (!requiresAuth) {
    return;
  }

  const { ensureLoggedIn } = require('./authHelper');
  const browser = await chromium.launch();
  try {
    await ensureLoggedIn(browser);
  } finally {
    await browser.close();
  }
}

module.exports = globalSetup;
