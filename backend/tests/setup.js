// backend/tests/setup.js
// Load env vars for tests.
// Base values come from .env, then .env.test overrides only the test-specific
// keys it defines.
const fs = require('fs');
const envTestPath = '.env.test';
const envPath = '.env';
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}
if (fs.existsSync(envTestPath)) {
  require('dotenv').config({ path: envTestPath, override: true });
}

// Silence console output during tests (optional - remove if you want logs)
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}
