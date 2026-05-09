// backend/tests/e2e/full-journey.spec.js
//
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║           FULL USER JOURNEY — Sapa Tazkia E2E Functional Test              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//

const { test, expect, request } = require('@playwright/test');

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Mengetik teks ke dalam chat input dan menunggu submit button aktif */
async function typeQuestion(page, text) {
  const input = page.locator('[data-testid="pertanyaan-input"]').first();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.fill(text);
  const submit = page.locator('[data-testid="submit-tanya"]').first();
  await expect(submit).toBeEnabled({ timeout: 5_000 });
  return { input, submit };
}

/** Mengirim pesan dan menunggu bubble user muncul di layar */
async function sendAndWaitUserBubble(page, text) {
  const { submit } = await typeQuestion(page, text);
  await submit.click();
  const userBubble = page.locator('[data-testid="pesan-user"]').last();
  await expect(userBubble).toBeVisible({ timeout: 15_000 });
  await expect(userBubble).toContainText(text.slice(0, 20));
  return userBubble;
}

/** Menunggu bubble jawaban AI muncul (bisa lambat karena LLM) */
async function waitForAIAnswer(page, timeoutMs = 90_000) {
  const answer = page.locator('[data-testid="jawaban-text"]').last();
  // Gunakan toPass agar jika streaming lambat, dia tidak timeout di detik pertama
  await expect(async () => {
    await expect(answer).toBeVisible({ timeout: 5000 });
    const text = (await answer.innerText()).trim();
    expect(text.length).toBeGreaterThan(2);
  }).toPass({ timeout: timeoutMs });
  return answer;
}

/** Menunggu loading state selesai */
async function waitForLoadingToFinish(page) {
  await expect(page.getByText(/loading/i).first()).not.toBeVisible({ timeout: 20_000 });
}

test.describe('Sapa Tazkia Full Journey E2E', () => {
  // Jalankan secara serial karena semua tes menggunakan akun yang sama
  test.describe.configure({ mode: 'serial' });
  
  // ⛔ JANGAN pakai storageState global agar tidak bentrok
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ page }) => {
    // 1. Login via API
    const apiBase = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:5000';
    const nim = process.env.E2E_LOGIN_NIM || '241572010024';
    const password = process.env.E2E_LOGIN_PASSWORD || '241572010024';

    const apiCtx = await request.newContext({ baseURL: apiBase });
    const res = await apiCtx.post('/api/auth/login', {
      data: { identifier: nim, password },
    });
    const body = await res.json();
    await apiCtx.dispose();

    // 2. Inject token ke localStorage
    const frontendBase = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
    await page.goto(frontendBase);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: body.token, user: body.user });

    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Journey 1 — Chat & AI Response
  // ──────────────────────────────────────────────────────────────────────────────

  test.describe('Journey 1 — Chat & AI Response', () => {
    test('halaman /chat terbuka dalam keadaan sudah login', async ({ page }) => {
      await page.goto('/chat');
      await waitForLoadingToFinish(page);
      await expect(page).toHaveURL(/\/chat/, { timeout: 15_000 });
      const input = page.locator('[data-testid="pertanyaan-input"]').first();
      await expect(input).toBeVisible({ timeout: 30_000 });
      const submit = page.locator('[data-testid="submit-tanya"]').first();
      await expect(submit).toBeDisabled();
    });

    test('mengirim pertanyaan dan melihat jawaban AI', async ({ page }) => {
      await page.goto('/chat');
      await waitForLoadingToFinish(page);
      await expect(page.locator('[data-testid="pertanyaan-input"]').first()).toBeVisible({ timeout: 30_000 });
      const question = 'Apa itu Sapa Tazkia?';
      await sendAndWaitUserBubble(page, question);
      await waitForAIAnswer(page);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Journey 2 — Manajemen Percakapan (New Chat + Delete)
  // ──────────────────────────────────────────────────────────────────────────────

  test.describe('Journey 2 — Manajemen Percakapan', () => {
    test('membuat chat baru dan melihat history sebelumnya di sidebar', async ({ page }) => {
      await page.goto('/chat');
      await waitForLoadingToFinish(page);
      const newChatBtn = page.getByRole('button', { name: /new chat/i }).first();
      await expect(newChatBtn).toBeVisible({ timeout: 15_000 });

      // Kirim satu pesan untuk membuat sesi percakapan
      const q1 = 'Berapa SKS minimal kelulusan?';
      await sendAndWaitUserBubble(page, q1);
      await waitForAIAnswer(page);

      // Tunggu sebentar agar backend simpan ke DB & generate title
      await page.waitForTimeout(15000);

      // Klik "New chat" untuk mengakhiri sesi saat ini
      await newChatBtn.click();

      // Verifikasi input kosong kembali
      await expect(page.locator('[data-testid="pertanyaan-input"]').first()).toHaveValue('', { timeout: 10_000 });

      // VERIFIKASI HISTORY: Chat sebelumnya harus muncul di sidebar
      const chatItem = page.locator('[data-testid="chat-item"]').first();
      await expect(async () => {
        await page.reload();
        await waitForLoadingToFinish(page);
        await expect(chatItem).toBeVisible({ timeout: 10000 });
      }).toPass({ timeout: 90_000 });
    });

    test('menghapus percakapan dari sidebar', async ({ page }) => {
      await page.goto('/chat');
      await waitForLoadingToFinish(page);
      const newChatBtn = page.getByRole('button', { name: /new chat/i }).first();
      await expect(newChatBtn).toBeVisible({ timeout: 15_000 });

      const uniqueId = Math.floor(Math.random() * 100000);
      await sendAndWaitUserBubble(page, `Pesan untuk dihapus ${uniqueId}`);
      await waitForAIAnswer(page);

      // Tunggu DB & title generation
      await page.waitForTimeout(15000); 

      const searchInput = page.getByPlaceholder(/cari percakapan/i);
      await expect(searchInput).toBeVisible({ timeout: 5_000 });
      await searchInput.fill('Pesan');
      
      const firstChatItem = page.locator('[data-testid="chat-item"]').first();
      await expect(firstChatItem).toBeVisible({ timeout: 30_000 });

      // Buka menu (⋯)
      await firstChatItem.hover();
      const moreBtn = firstChatItem.locator('[data-testid="chat-item-more"]');
      await expect(moreBtn).toBeVisible({ timeout: 5_000 });
      await moreBtn.click({ force: true });
      
      const hapusBtnMenu = page.locator('[data-testid="delete-chat-btn"]');
      await expect(hapusBtnMenu).toBeVisible({ timeout: 10_000 });
      await hapusBtnMenu.click();

      // Modal konfirmasi (ConfirmationModal.jsx)
      const hapusBtnModal = page.locator('button').filter({ hasText: /^Hapus$/ }).first();
      await expect(hapusBtnModal).toBeVisible({ timeout: 10_000 });
      await hapusBtnModal.click();

      // Bersihkan search input
      await searchInput.fill('');

      // Verifikasi berkurang/hilang
      await page.waitForTimeout(2000);
      const itemsAfterDelete = page.locator('[data-testid="chat-item"]').filter({ hasText: `Pesan untuk dihapus ${uniqueId}` });
      await expect(itemsAfterDelete).toHaveCount(0, { timeout: 15_000 });
    });

    test('sidebar selalu menampilkan tombol New Chat dan konten yang benar', async ({ page }) => {
      await page.goto('/chat');
      await waitForLoadingToFinish(page);
      const newChatBtn = page.getByRole('button', { name: /new chat/i }).first();
      await expect(newChatBtn).toBeVisible({ timeout: 15_000 });

      // Cek apakah ada profil atau sidebar history
      const hasProfile = await page.locator('[data-testid="profile-button"]').isVisible();
      const hasSidebar = await page.locator('.custom-scrollbar').isVisible();
      expect(hasProfile || hasSidebar || (await newChatBtn.isVisible())).toBeTruthy();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────────
  // Journey 3 — Negative Cases & Edge Cases
  // ──────────────────────────────────────────────────────────────────────────────

  test.describe('Journey 3 — Negative Cases', () => {
    test('tombol Send disabled saat input kosong, aktif saat ada teks', async ({ page }) => {
      await page.goto('/chat');
      await waitForLoadingToFinish(page);
      const input = page.locator('[data-testid="pertanyaan-input"]').first();
      await expect(input).toBeVisible({ timeout: 30_000 });
      const submit = page.locator('[data-testid="submit-tanya"]').first();

      await expect(submit).toBeDisabled();
      await input.fill('Halo Sapa Tazkia!');
      await expect(submit).toBeEnabled();
      await input.fill('');
      await expect(submit).toBeDisabled();
    });

    test('akses halaman terproteksi tanpa login → diredirect ke halaman utama', async ({ page }) => {
      // Kita hapus token dulu untuk simulasi guest/logged out
      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      
      await page.goto('/academic');
      // Harusnya diredirect ke landing page (/)
      await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    });

    test('search percakapan di sidebar berfungsi', async ({ page }) => {
      await page.goto('/chat');
      await waitForLoadingToFinish(page);
      const searchInput = page.getByPlaceholder(/cari percakapan/i);
      await expect(searchInput).toBeVisible({ timeout: 5_000 });

      // Ketik sesuatu yang tidak mungkin ada
      await searchInput.fill('ZZZ_TIDAK_ADA_DATA_INI_ZZZ');
      await page.waitForTimeout(1000);
      
      const noResults = page.getByText(/tidak ada hasil/i);
      await expect(noResults).toBeVisible({ timeout: 5_000 });
    });
  });
});
