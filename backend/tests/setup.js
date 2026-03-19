// backend/tests/setup.js
// Load env vars for tests
// Load test-specific env first, fallback to .env
const fs = require('fs');
const envTestPath = '.env.test';
const envPath = '.env';
require('dotenv').config({ path: fs.existsSync(envTestPath) ? envTestPath : envPath });

// Silence console output during tests (optional - remove if you want logs)
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}
