// backend/tests/setup.js
// Load env vars for tests
require('dotenv').config({ path: '.env' });

// Silence console output during tests (optional - remove if you want logs)
if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'test';
}
