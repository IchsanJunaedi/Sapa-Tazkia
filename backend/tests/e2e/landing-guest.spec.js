// backend/tests/e2e/landing-guest.spec.js
//
// Lightweight smoke test for the chat surface in *guest* mode. Designed to
// run without an authenticated session so it can detect frontend regressions
// even when the seeded E2E user / login flow is broken. We bypass the global
// auth bootstrap by clearing storageState and the auth-related localStorage
// keys before each test.
//
// We navigate to `/chat?guest=true` because the chat input lives at /chat
// (ChatPage / LandingPage), not the public `/` MarketingLandingPage. The
// `?guest=true` URL parameter is recognised by ProtectedRoute as a guest
// session, so the page renders without requiring a JWT.
//
// What this test guarantees:
//   * Frontend bundle loads successfully.
//   * The guest chat input + submit button are both rendered and reachable.
//   * The submit button correctly toggles between disabled/enabled based on
//     whether the input has content.

/* eslint-env browser */

const { test, expect } = require('@playwright/test');

// Force an unauthenticated browser context regardless of what globalSetup
// produced. We do NOT want a stale storageState turning the LandingPage into
// the post-login redirect to /chat.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('LandingPage — guest smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch (_err) {
        // Some test profiles run before storage is available; ignore.
      }
    });
  });

  test('renders guest chat input and toggles submit enabled state', async ({ page }) => {
    // /chat?guest=true is the canonical guest entry point. ProtectedRoute
    // allows it without a JWT and ChatPage initialises with isGuest=true.
    await page.goto('/chat?guest=true');

    const input = page.locator('[data-testid="pertanyaan-input"]').first();
    await expect(input).toBeVisible({ timeout: 30_000 });

    const submit = page.locator('[data-testid="submit-tanya"]').first();
    await expect(submit).toBeVisible();

    // Empty: button must be disabled (ChatInput applies `disabled={!canSend}`
    // when the trimmed input is empty).
    await expect(submit).toBeDisabled();

    await input.fill('Halo Sapa Tazkia');
    await expect(submit).toBeEnabled();

    await input.fill('   ');
    await expect(submit).toBeDisabled();
  });
});
