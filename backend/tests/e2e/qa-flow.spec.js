// backend/tests/e2e/qa-flow.spec.js
//
// Functional / E2E test: user submits a question in the chatbot form and
// verifies that the answer is rendered on screen.
//
// Run locally:  npm run test:e2e
// Run against a deployed URL:  E2E_BASE_URL=https://staging.example.com npm run test:e2e
//
// IMPORTANT — replace the DUMMY_* constants below with real selectors once you
// confirm them in the frontend (right-click → Inspect → copy the attribute
// that uniquely targets the element, ideally `data-testid`).

const { test, expect } = require('./fixtures');

// -----------------------------------------------------------------------------
// DUMMY config — replace with your real page path and selectors.
// -----------------------------------------------------------------------------
const TANYA_PAGE_PATH = process.env.E2E_TANYA_PATH || '/chat';

// Prefer `data-testid` attributes for stability. Fallback to role-based
// queries if you don't want to add testids.
const SELECTORS = {
  questionInput:
    process.env.E2E_QUESTION_INPUT || '[data-testid="pertanyaan-input"]',
  submitButton:
    process.env.E2E_SUBMIT_BUTTON || '[data-testid="submit-tanya"]',
  answerText:
    process.env.E2E_ANSWER_TEXT || '[data-testid="jawaban-text"]',
};

const SAMPLE_QUESTION = 'Kapan jadwal KRS semester genap dibuka?';
// A lax pattern — tighten once you know the expected answer format.
const EXPECTED_ANSWER_PATTERN = /(jadwal|KRS|akademik|semester)/i;

test.describe('QA Flow — form tanya-jawab', () => {
  test('user submits a question and sees the answer rendered', async ({ page }) => {
    // 1. Open the page with the tanya-jawab form.
    await page.goto(TANYA_PAGE_PATH);

    // 2. Type the question into the input.
    const input = page.locator(SELECTORS.questionInput);
    await expect(input).toBeVisible();
    await input.fill(SAMPLE_QUESTION);

    // 3. Click submit.
    const submit = page.locator(SELECTORS.submitButton);
    await expect(submit).toBeEnabled();
    await submit.click();

    // 4. Wait for the answer to be rendered, then assert its content.
    const answer = page.locator(SELECTORS.answerText);
    await expect(answer).toBeVisible({ timeout: 20_000 });

    const answerText = (await answer.innerText()).trim();
    expect(answerText.length).toBeGreaterThan(0);
    expect(answerText).toMatch(EXPECTED_ANSWER_PATTERN);
  });

  test('empty submission is prevented or surfaces a validation error', async ({ page }) => {
    await page.goto(TANYA_PAGE_PATH);

    const submit = page.locator(SELECTORS.submitButton);
    // The submit button is either disabled (preferred) or shows a validation
    // message after being clicked — either behaviour is acceptable.
    const disabled = await submit.isDisabled().catch(() => false);
    if (!disabled) {
      await submit.click();
      const errorMsg = page.locator('[role="alert"], .error, [data-testid="form-error"]');
      await expect(errorMsg.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
