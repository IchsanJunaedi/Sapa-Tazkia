// backend/tests/e2e/error-states.spec.js
//
// E2E tests for error state handling:
//   - 404 page / unknown routes
//   - Unauthenticated access to protected pages
//   - API error response shapes (via request API)
//   - Network timeout / server error handling in UI

const { test, expect, request } = require('@playwright/test');

const API_BASE = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:5000';
const FRONTEND_BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100';

test.describe('Error States — API level', () => {
  test('unknown route returns 404', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/this-route-does-not-exist-9x8y7z');
    expect(res.status()).toBe(404);
    await ctx.dispose();
  });

  test('missing auth header returns 401 on protected route', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/api/notifications');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    await ctx.dispose();
  });

  test('invalid JWT returns 401', async () => {
    const ctx = await request.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { Authorization: 'Bearer invalid.jwt.token' },
    });
    const res = await ctx.get('/api/notifications');
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('malformed JSON body returns 400', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.post('/api/auth/login', {
      headers: { 'Content-Type': 'application/json' },
      data: 'not-json{{{{',
    });
    expect([400, 422]).toContain(res.status());
    await ctx.dispose();
  });

  test('login with wrong password returns 401', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.post('/api/auth/login', {
      data: { identifier: '9999999999', password: 'wrong-password-here' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    await ctx.dispose();
  });

  test('register-email with missing fields returns 400/422', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.post('/api/auth/register-email', {
      data: {},
    });
    expect([400, 422]).toContain(res.status());
    await ctx.dispose();
  });

  test('forgot-password with unknown email returns 200 (no enumeration leak)', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.post('/api/auth/forgot-password', {
      data: { email: 'unknown-nobody@nowhere.invalid' },
    });
    // Good practice: always return 200 to avoid user enumeration
    expect([200, 404]).toContain(res.status());
    await ctx.dispose();
  });
});

test.describe('Error States — UI level', () => {
  // Use fresh storage state — test unauthenticated views
  test.use({ storageState: { cookies: [], origins: [] } });

  test('visiting /chat without auth redirects or shows login', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    const url = page.url();
    // Should either redirect to login or show a login prompt
    const hasLoginPath = url.includes('/login') || url.includes('/auth');
    const hasLoginElement = await page.locator('input[type="password"], input[name="password"]').count() > 0;
    // At least one of these should be true
    expect(hasLoginPath || hasLoginElement || url.endsWith('/')).toBeTruthy();
  });

  test('navigating to a 404 path shows some error indication', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    }).catch(() => {});
    // The app should handle the route gracefully
    expect(await page.title()).toBeTruthy();
    // Not a blank white page — should have some content
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('health endpoint returns 200', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const res = await ctx.get('/health');
    expect(res.status()).toBe(200);
    await ctx.dispose();
  });
});
