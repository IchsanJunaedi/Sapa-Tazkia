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

describe('Request ID header', () => {
  it('returns X-Request-Id on every response', async () => {
    const res = await agent.get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
