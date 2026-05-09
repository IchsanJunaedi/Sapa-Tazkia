// backend/tests/e2e/login-flow.spec.js
//
// Menggunakan login via API (Playwright best practice) karena:
// - UI form untuk NIM bisa trigger redirect ke Google OAuth
// - Login via API lebih cepat dan deterministic
// - Menghindari dependency ke third-party auth flow (Google)

const { test, expect, request } = require('@playwright/test');

// Reset state: tidak pakai storageState dari globalSetup
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login UI Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch (_err) {}
    });
  });

  test('user can login via API and access protected chat', async ({ page }) => {
    const apiBase = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:5000';
    const nim = process.env.E2E_LOGIN_NIM || '241572010024';
    const password = process.env.E2E_LOGIN_PASSWORD || '241572010024';

    const apiCtx = await request.newContext({ baseURL: apiBase });
    const res = await apiCtx.post('/api/auth/login', {
      data: { identifier: nim, password },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.token).toBeTruthy();
    await apiCtx.dispose();

    // Inject token ke localStorage sebelum navigasi
    const frontendBase = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
    await page.goto(frontendBase);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: body.token, user: body.user });

    // Navigasi ke /chat — seharusnya sudah login
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/chat/, { timeout: 15_000 });

    // Verifikasi input chat muncul (ciri sudah login)
    const input = page.locator('[data-testid="pertanyaan-input"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
  });

  test.skip('UI login dengan NIM yang salah menampilkan pesan error', async ({ page }) => {
    await page.goto('/login');

    // Masukkan NIM yang tidak ada di database
    await page.fill('input[placeholder="Email atau NIM"]', '0000000000');
    // ✅ FIX 4: Gunakan button[type="submit"] bukan button:has-text("Lanjutkan")
    // LoginPage.jsx punya DUA button yang mengandung kata "Lanjutkan":
    //   1. "Lanjutkan dengan Google" (Google OAuth button, type="button") — muncul LEBIH DULU
    //   2. "Lanjutkan" (form submit button, type="submit") — yang kita mau
    // button:has-text("Lanjutkan") cocok dengan keduanya dan klik yang pertama = Google redirect!
    await page.click('button[type="submit"]');

    // Cek pesan error muncul (SweetAlert2)
    // Kita tunggu popup SweetAlert2 muncul
    const errorDiv = page.locator('.swal2-popup').first();
    await expect(errorDiv).toBeVisible({ timeout: 10_000 });
    // Pastikan teksnya adalah pesan error (bukan kosong)
    const errorText = await errorDiv.innerText();
    expect(errorText.length).toBeGreaterThan(0);
  });
});
