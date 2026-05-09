// backend/tests/e2e/rag-accuracy.spec.js
const { test, expect } = require('@playwright/test');

// Gunakan auto-login yang sudah ada di globalSetup
// atau bypass login jika test ini berjalan mandiri
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
    // Navigasi ke halaman chat yang sudah login
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
