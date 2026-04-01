// backend/src/config/envValidation.js
// Called at the very top of app.js. Fails fast with clear messages if required vars are missing.

const REQUIRED = [
  { key: 'DATABASE_URL',   desc: 'MySQL connection string' },
  { key: 'JWT_SECRET',     desc: 'JWT signing secret (min 32 chars)' },
  { key: 'SESSION_SECRET', desc: 'Express session secret (min 32 chars)' },
  { key: 'REDIS_URL',      desc: 'Redis connection URL' },
];

// These are warned but not fatal — app can run in degraded mode
const WARNED = [
  { key: 'OPENAI_API_KEY',        desc: 'OpenAI API key (AI features disabled without it)' },
  { key: 'GOOGLE_CLIENT_ID',      desc: 'Google OAuth client ID (Google login disabled)' },
  { key: 'GOOGLE_CLIENT_SECRET',  desc: 'Google OAuth client secret (Google login disabled)' },
  { key: 'EMAIL_USER',            desc: 'Email sender (email features disabled)' },
];

function validateEnv() {
  // In test mode, relax: only DATABASE_URL and JWT_SECRET are truly required
  const isTest = process.env.NODE_ENV === 'test';
  const required = isTest
    ? REQUIRED.filter(v => ['DATABASE_URL', 'JWT_SECRET', 'SESSION_SECRET'].includes(v.key))
    : REQUIRED;

  const missing = required.filter(({ key }) => !process.env[key]);

  if (missing.length > 0) {
    const lines = missing.map(({ key, desc }) => `  - ${key.padEnd(22)} → ${desc}`).join('\n');
    throw new Error(`FATAL: Missing required environment variables:\n${lines}`);
  }

  if (!isTest) {
    const warned = WARNED.filter(({ key }) => !process.env[key]);
    if (warned.length > 0) {
      const lines = warned.map(({ key, desc }) => `  - ${key}: ${desc}`).join('\n');
      // Use console.warn here because logger may not be initialized yet
      console.warn(`[ENV] Warning — missing optional variables (features will be degraded):\n${lines}`);
    }
  }
}

module.exports = { validateEnv };
