// backend/tests/e2e/rag-accuracy.spec.js
const { test, expect, request: playwrightRequest } = require('@playwright/test');

// Override global storage state — we handle auth ourselves via API login
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('RAG Accuracy Validation', () => {
  
  const QA_PAIRS = [
    {
      question: 'Apa saja program studi yang ada di Tazkia?',
      // AI menjawab dengan nama program studi modern — cocokkan dengan keyword aktual
      mustContain: ['Digital Business', 'Accounting', 'Finance', 'Halal', 'Ekonomi', 'Bisnis', 'Informatika', 'AI & Data'],
      minKeywords: 2
    },
    {
      question: 'Dimana alamat utama kampus Tazkia?',
      mustContain: ['Sentul', 'Bogor', 'Jawa Barat'],
      minKeywords: 1
    },
    {
      question: 'Siapa pendiri STEI Tazkia?',
      mustContain: ['Syafii Antonio', 'Muhammad Syafii', "Syafi'i", 'Antonio'],
      minKeywords: 1
    }
  ];

  test.beforeEach(async ({ page }) => {
    // 1. Login via API
    const apiBase = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:5000';
    const nim = process.env.E2E_LOGIN_NIM || '241572010024';
    const password = process.env.E2E_LOGIN_PASSWORD || '241572010024';

    const apiCtx = await playwrightRequest.newContext({ baseURL: apiBase });
    const res = await apiCtx.post('/api/auth/login', {
      data: { identifier: nim, password },
    });
    const body = await res.json();
    await apiCtx.dispose();

    // 2. Inject token ke localStorage
    const frontendBase = process.env.E2E_BASE_URL || 'http://127.0.0.1:3100';
    await page.goto(frontendBase);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }, { token: body.token, user: body.user });

    // 3. Navigasi ke halaman chat yang sudah login
    await page.goto('/chat');
    await expect(page.locator('[data-testid="pertanyaan-input"]').first()).toBeVisible({ timeout: 30_000 });
  });

  for (const qa of QA_PAIRS) {
    test(`RAG Accuracy: "${qa.question}"`, async ({ page }) => {
      const input = page.locator('[data-testid="pertanyaan-input"]').first();
      const submit = page.locator('[data-testid="submit-tanya"]').first();

      // Kirim pertanyaan
      await input.fill(qa.question);
      await submit.click();

      // Tunggu jawaban AI
      const answer = page.locator('[data-testid="jawaban-text"]').last();
      await expect(answer).toBeVisible({ timeout: 60_000 });
      
      const answerText = (await answer.innerText()).toLowerCase();
      
      // Validasi akurasi RAG
      const foundKeywords = qa.mustContain.filter(keyword => 
        answerText.includes(keyword.toLowerCase())
      );
      
      console.log(`[RAG TEST] Question: ${qa.question}`);
      console.log(`[RAG TEST] Found keywords: ${foundKeywords.join(', ')}`);
      
      expect(foundKeywords.length).toBeGreaterThanOrEqual(qa.minKeywords);
    });
  }
});
