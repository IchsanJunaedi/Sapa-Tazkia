// backend/tests/e2e/guest-chat.spec.js
const { test, expect } = require('@playwright/test');

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Guest Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch (_err) {}
    });
  });

  test('guest can type "halo" and see AI response', async ({ page }) => {
    await page.goto('/chat?guest=true');

    const input = page.locator('[data-testid="pertanyaan-input"]').first();
    await expect(input).toBeVisible({ timeout: 30_000 });

    // Step 1: Ketik "halo"
    await page.waitForTimeout(1000);
    await input.fill('halo');
    await page.waitForTimeout(500);
    const submit = page.locator('[data-testid="submit-tanya"]').first();
    await expect(submit).toBeEnabled();
    await page.waitForTimeout(1000);
    await submit.click();

    // Step 2: Cek bubble user muncul
    const userBubble = page.locator('[data-testid="pesan-user"]').last();
    await expect(userBubble).toBeVisible({ timeout: 10_000 });
    await expect(userBubble).toContainText('halo');

    // Step 3: Cek jawaban AI muncul
    const answer = page.locator('[data-testid="jawaban-text"]').last();
    await expect(answer).toBeVisible({ timeout: 60_000 });
    const text = await answer.innerText();
    expect(text.length).toBeGreaterThan(5);
  });

  test('guest can ask "dimana tazkia" and see relevant response', async ({ page }) => {
    await page.goto('/chat?guest=true');

    const input = page.locator('[data-testid="pertanyaan-input"]').first();
    await expect(input).toBeVisible({ timeout: 30_000 });

    // Step 1: Ketik "dimana tazkia"
    await input.fill('dimana tazkia');
    const submit = page.locator('[data-testid="submit-tanya"]').first();
    await expect(submit).toBeEnabled();
    await submit.click();

    // Step 2: Cek jawaban AI (harus mengandung Bogor/Sentul jika RAG aktif)
    const answer = page.locator('[data-testid="jawaban-text"]').last();
    await expect(answer).toBeVisible({ timeout: 60_000 });
    const text = (await answer.innerText()).toLowerCase();
    
    // Verifikasi relevansi (RAG check)
    const keywords = ['bogor', 'sentul', 'kampus'];
    const isRelevant = keywords.some(k => text.includes(k));
    expect(isRelevant).toBe(true);
  });
});
