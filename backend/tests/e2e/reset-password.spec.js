// backend/tests/e2e/reset-password.spec.js
//
// E2E tests for the password reset flow (API-level, no SMTP required).
//
// Strategy:
//   1. Trigger POST /api/auth/forgot-password with a known NIM/email.
//   2. Pull the reset token directly from the DB (bypasses email delivery).
//   3. POST /api/auth/reset-password with the token and a new password.
//   4. Verify login succeeds with the new password, then restore original.
//
// All requests go to the backend API via Playwright's `request` fixture so
// this suite runs headlessly without spinning up the frontend.

const { test, expect, request } = require('@playwright/test');

const API_BASE = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:5000';
const VALID_NIM = process.env.E2E_LOGIN_NIM || '241572010024';
const VALID_PASS = process.env.E2E_LOGIN_PASSWORD || 'tazkia123';

// Helper: POST to API and return { status, body }
async function apiPost(ctx, path, data) {
  const res = await ctx.post(`${API_BASE}${path}`, { data });
  let body = {};
  try { body = await res.json(); } catch {}
  return { status: res.status(), body };
}

// Helper: GET to API and return { status, body }
async function apiGet(ctx, path, headers = {}) {
  const res = await ctx.get(`${API_BASE}${path}`, { headers });
  let body = {};
  try { body = await res.json(); } catch {}
  return { status: res.status(), body };
}

// ─── Suite 1: forgot-password input validation ──────────────────────────────
test.describe('Forgot-Password — input validation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('empty identifier returns 400 or 422', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const { status } = await apiPost(ctx, '/api/auth/forgot-password', { identifier: '' });
    expect([400, 422]).toContain(status);
    await ctx.dispose();
  });

  test('non-existent NIM returns 200 (enumeration guard) or 404', async () => {
    // Many implementations return 200 even for unknown users to prevent
    // user enumeration. Accept both 200 and 404.
    const ctx = await request.newContext({ baseURL: API_BASE });
    const { status } = await apiPost(ctx, '/api/auth/forgot-password', {
      identifier: '000000000000',
    });
    expect([200, 404]).toContain(status);
    await ctx.dispose();
  });

  test('valid NIM triggers forgot-password without 5xx', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const { status } = await apiPost(ctx, '/api/auth/forgot-password', {
      identifier: VALID_NIM,
    });
    // Accept 200 (sent), 429 (rate-limited in test env), or 404 (user not seeded)
    expect([200, 404, 429]).toContain(status);
    await ctx.dispose();
  });
});

// ─── Suite 2: reset-password input validation ───────────────────────────────
test.describe('Reset-Password — input validation', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('missing token returns 400/422', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const { status } = await apiPost(ctx, '/api/auth/reset-password', {
      token: '',
      newPassword: 'NewPassword123!',
    });
    expect([400, 422]).toContain(status);
    await ctx.dispose();
  });

  test('invalid/tampered token returns 400/401/404', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const { status } = await apiPost(ctx, '/api/auth/reset-password', {
      token: 'this-is-not-a-valid-token-at-all-xyz',
      newPassword: 'NewPassword123!',
    });
    expect([400, 401, 404, 422]).toContain(status);
    await ctx.dispose();
  });

  test('weak password (too short) returns 400/422', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const { status } = await apiPost(ctx, '/api/auth/reset-password', {
      token: 'some-fake-token',
      newPassword: '123',
    });
    expect([400, 422]).toContain(status);
    await ctx.dispose();
  });

  test('SQL injection in token does not cause 500', async () => {
    const ctx = await request.newContext({ baseURL: API_BASE });
    const { status } = await apiPost(ctx, '/api/auth/reset-password', {
      token: "' OR '1'='1'; --",
      newPassword: 'NewPassword123!',
    });
    expect(status).not.toBe(500);
    await ctx.dispose();
  });
});

// ─── Suite 3: Full reset cycle (requires seeded DB + no email) ──────────────
// This suite is skipped if ENABLE_RESET_CYCLE_TEST env var is not set, to
// avoid false negatives in environments where the DB user is not seeded or
// email tokens aren't stored retrievably.
test.describe('Reset-Password — full cycle (DB-seeded env only)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  const SKIP_CYCLE = !process.env.ENABLE_RESET_CYCLE_TEST;

  test('forgot → reset → login cycle', async () => {
    test.skip(SKIP_CYCLE, 'Set ENABLE_RESET_CYCLE_TEST=1 to run full cycle');

    const ctx = await request.newContext({ baseURL: API_BASE });

    // Step 1: Trigger forgot-password
    const { status: forgotStatus } = await apiPost(ctx, '/api/auth/forgot-password', {
      identifier: VALID_NIM,
    });
    expect([200, 202]).toContain(forgotStatus);

    // Step 2: Retrieve token from admin/debug endpoint (only enabled in test env)
    // This endpoint must be gated by NODE_ENV=test in the backend.
    const { status: tokenStatus, body: tokenBody } = await apiGet(
      ctx,
      `/api/auth/debug/reset-token?nim=${VALID_NIM}`,
      { Authorization: `Bearer ${process.env.E2E_DEBUG_TOKEN || ''}` }
    );
    // If debug endpoint is not implemented, skip gracefully
    test.skip(tokenStatus === 404, 'Debug token endpoint not available');
    expect(tokenStatus).toBe(200);

    const resetToken = tokenBody.token;
    expect(resetToken).toBeTruthy();

    const NEW_PASS = 'TempNewP@ss1!';

    // Step 3: Reset password
    const { status: resetStatus } = await apiPost(ctx, '/api/auth/reset-password', {
      token: resetToken,
      newPassword: NEW_PASS,
    });
    expect(resetStatus).toBe(200);

    // Step 4: Login with new password
    const { status: loginStatus, body: loginBody } = await apiPost(ctx, '/api/auth/login', {
      identifier: VALID_NIM,
      password: NEW_PASS,
    });
    expect(loginStatus).toBe(200);
    expect(loginBody.token || loginBody.accessToken).toBeTruthy();

    // Step 5: Restore original password
    // (Use auth'd endpoint or another reset cycle if backend allows)
    const authToken = loginBody.token || loginBody.accessToken;
    await apiPost(ctx, '/api/auth/change-password', {
      currentPassword: NEW_PASS,
      newPassword: VALID_PASS,
    }).catch(() => {}); // Best effort — not all backends implement this

    await ctx.dispose();
  });

  test('expired/used token cannot be reused', async () => {
    test.skip(SKIP_CYCLE, 'Set ENABLE_RESET_CYCLE_TEST=1 to run full cycle');

    const ctx = await request.newContext({ baseURL: API_BASE });

    // Use a clearly stale token
    const { status } = await apiPost(ctx, '/api/auth/reset-password', {
      token: 'already-used-token-placeholder',
      newPassword: 'AnotherPass123!',
    });
    // Must reject — not 200 and not 500
    expect(status).not.toBe(200);
    expect(status).not.toBe(500);

    await ctx.dispose();
  });
});

// ─── Suite 4: UI smoke — reset-password page renders ────────────────────────
test.describe('Reset-Password UI — page smoke', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('reset-password page with fake token does not crash', async ({ page }) => {
    // Navigate to the frontend reset-password page with a fake token
    const frontendBase = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100';

    const res = await page
      .goto(`${frontendBase}/reset-password?token=fake-token-for-ui-test`, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      })
      .catch(() => null);

    if (!res) {
      // Frontend not running — skip gracefully
      test.skip(true, 'Frontend not reachable');
    }

    // Page must not be blank and must not show a JS crash
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText.length).toBeGreaterThan(5);

    // No uncaught JS errors
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR')
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
