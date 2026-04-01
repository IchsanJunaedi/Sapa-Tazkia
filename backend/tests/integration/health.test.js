// backend/tests/integration/health.test.js
const { agent } = require('../helpers/appHelper');

describe('GET /health', () => {
  it('returns service statuses (200 when DB up, 503 when DB down)', async () => {
    const res = await agent.get('/health');
    // Health route returns 200 (OK) or 503 (ERROR) depending on DB reachability.
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('services');
  });
});

describe('GET /status', () => {
  it('returns 200 with system info', async () => {
    const res = await agent.get('/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });
});

describe('GET /', () => {
  it('returns 200 API root response', async () => {
    const res = await agent.get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});
