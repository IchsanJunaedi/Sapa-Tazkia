// backend/tests/e2e/conversation-mgmt.spec.js
const { test, expect, request } = require('@playwright/test');

test.describe('Conversation Management (Rename & Delete)', () => {
  test.describe.configure({ mode: 'serial' });
  // ⛔ JANGAN pakai storageState global agar tidak bentrok origin/state
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
    await page.goto('/chat');
    
    // Tunggu loading selesai
    await expect(page.getByText(/loading/i).first()).not.toBeVisible({ timeout: 20_000 });
    
    // Tunggu sampai sistem benar-benar mengenal user (bukan Guest)
    await expect(page.locator('[data-testid="pertanyaan-input"]').first()).toBeVisible({ timeout: 30_000 });
    // Tombol profil harus ada jika login berhasil (SideBar.jsx: data-testid="profile-button")
    await expect(page.locator('[data-testid="profile-button"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('user can rename a conversation', async ({ page }) => {
    // 1. Kirim pesan untuk membuat percakapan baru
    const input = page.locator('[data-testid="pertanyaan-input"]').first();
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill('Ini adalah pesan untuk test rename');
    await page.click('[data-testid="submit-tanya"]');

    // Tunggu jawaban AI selesai (agar judul ter-generate di backend)
    await expect(page.locator('[data-testid="jawaban-text"]').last()).toBeVisible({ timeout: 60_000 });

    // Tunggu backend selesai generateTitle (~8-15 detik async)
    await page.waitForTimeout(15000);

    // 2. Verifikasi chat muncul di sidebar (dengan reload jika perlu)
    const chatItem = page.locator('[data-testid="chat-item"]').first();
    await expect(async () => {
      await page.goto('/chat');
      // Tunggu loading selesai setelah goto
      await expect(page.getByText(/loading/i).first()).not.toBeVisible({ timeout: 10_000 });
      await expect(chatItem).toBeVisible({ timeout: 10000 });
    }).toPass({ timeout: 90_000 });

    const titleDiv = chatItem.locator('[data-testid="chat-item-title"]').first();
    const originalTitle = (await titleDiv.innerText()).trim();

    // 3. Buka menu opsi (⋯) — tunggu sebentar agar UI tenang
    await page.waitForTimeout(2000);
    await chatItem.hover();
    await page.waitForTimeout(500);
    const moreBtn = chatItem.locator('[data-testid="chat-item-more"]');
    await expect(moreBtn).toBeVisible({ timeout: 10_000 });
    await moreBtn.click();
    await page.waitForTimeout(500);

    // 4. Klik "Ubah Nama" di popup
    const renameBtn = page.locator('[data-testid="rename-chat-btn"]');
    await expect(renameBtn).toBeVisible({ timeout: 10_000 });
    await renameBtn.click();

    // 5. Masukkan nama baru di SweetAlert
    const newTitle = 'Renamed Conversation ' + Math.random();
    const swalInput = page.locator('.swal2-input');
    await expect(swalInput).toBeVisible({ timeout: 5_000 });
    await swalInput.fill(newTitle);
    await page.click('.swal2-confirm');

    // 6. Tunggu proses simpan selesai (biasanya ada reload atau API update)
    await page.waitForTimeout(2000);

    // 7. Verifikasi nama berubah di sidebar
    // Gunakan toPass karena SideBar.jsx melakukan reload + API fetch ulang
    await expect(async () => {
       await expect(page.locator('[data-testid="chat-item"]').filter({ hasText: newTitle }).first())
         .toBeVisible();
    }).toPass({ timeout: 20_000 });
  });

  test('user can delete a conversation', async ({ page }) => {
    // 0. Buat percakapan baru dulu agar sidebar tidak kosong
    const input = page.locator('[data-testid="pertanyaan-input"]').first();
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill('Pesan untuk test delete ' + Math.random());
    await page.click('[data-testid="submit-tanya"]');
    await expect(page.locator('[data-testid="jawaban-text"]').last()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(15000); // Tunggu title generate

    // 1. Ambil title dari chat item pertama
    const chatItem = page.locator('[data-testid="chat-item"]').first();
    await expect(async () => {
      await page.goto('/chat');
      // Tunggu loading selesai setelah goto
      await expect(page.getByText(/loading/i).first()).not.toBeVisible({ timeout: 10_000 });
      await expect(chatItem).toBeVisible({ timeout: 10000 });
    }).toPass({ timeout: 90_000 });
    
    const titleDiv = chatItem.locator('[data-testid="chat-item-title"]').first();
    const titleToDelete = (await titleDiv.innerText()).trim();

    // ✅ FIX 2: Hitung jumlah item dengan judul ini SEBELUM hapus
    // Sidebar bisa punya banyak chat dengan judul sama dari run sebelumnya
    const itemsWithSameTitle = page.locator('[data-testid="chat-item"]')
      .filter({ has: page.locator(`[data-testid="chat-item-title"]:text-is("${titleToDelete}")`) });
    const countBefore = await itemsWithSameTitle.count();

    // 2. Buka menu opsi — hover dulu agar tombol "..." muncul
    await chatItem.hover();
    await page.waitForTimeout(500);
    const moreBtn = chatItem.locator('[data-testid="chat-item-more"]');
    await expect(moreBtn).toBeVisible({ timeout: 5_000 });
    await moreBtn.click({ force: true });

    // 3. Klik "Hapus Chat" di popup dropdown
    await page.waitForTimeout(300);
    const deleteBtn = page.locator('[data-testid="delete-chat-btn"]');
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click({ force: true });

    // 4. Klik "Hapus" di ConfirmationModal (bukan SweetAlert)
    const confirmBtn = page.locator('button').filter({ hasText: /^Hapus$/ }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 8_000 });
    await confirmBtn.click({ force: true });

    // 5. Tunggu API delete selesai + UI update
    await page.waitForTimeout(2000);

    // 6. Verifikasi: jumlah item berkurang 1
    await expect(itemsWithSameTitle).toHaveCount(countBefore - 1, { timeout: 15_000 });
  });
});
