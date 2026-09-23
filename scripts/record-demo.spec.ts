/**
 * Textweaver Pitch Video — Automated Recording Script
 *
 * Records 4 polished clips demonstrating the Textweaver platform for the
 * Epic MegaGrant pitch video. Each clip saves as a separate .webm file
 * in the ./recordings directory.
 *
 * Prerequisites:
 *   1. Start the dev server:  npm run dev
 *   2. Run this script:       npx playwright test --config=playwright.record.config.ts
 *   3. Videos land in:        ./recordings/
 *
 * Viewport:  1920×1080
 * Output:    .webm (Playwright default — convert to .mp4 with ffmpeg if needed)
 */

import { test } from '@playwright/test';

const PAUSE_SHORT = 600;  // brief pause between clicks
const PAUSE_MED = 1200;   // pause to let UI settle
const PAUSE_LONG = 2000;  // hold on a scene so it's visible in video
const PAUSE_READ = 2500;  // hold on reader scenes

/**
 * Inject mock auth so the supabase stub returns a logged-in user.
 * This enables Studio, Admin, and purchase flows without a real backend.
 */
async function enableMockAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as any).__TEXTWEAVER_MOCK_AUTH__ = true;
  });
}

test.describe('Textweaver Pitch Video — Automated Recording', () => {
  // ────────────────────────────────────────────────────────
  // CLIP 1: Browse & Purchase  (~12s)
  // ────────────────────────────────────────────────────────
  test('clip-01-browse-and-buy', async ({ page }) => {
    await enableMockAuth(page);

    // 1a. Landing — Library catalog
    await page.goto('/');
    await page.waitForSelector('.content-grid', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_MED);

    // 1b. Smooth scroll down through the book grid
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: 'smooth' }));
    await page.waitForTimeout(PAUSE_SHORT);
    await page.evaluate(() => window.scrollBy({ top: -100, behavior: 'smooth' }));
    await page.waitForTimeout(PAUSE_MED);

    // 1c. Click a book card — navigate to Book Detail
    const bookCard = page.locator('.content-card').first();
    await bookCard.hover();
    await page.waitForTimeout(PAUSE_SHORT);
    await bookCard.click();
    await page.waitForSelector('.book-hero', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_LONG);

    // 1d. Click "Buy" (DEV mode: navigates to My Library)
    const buyBtn = page.getByRole('button', { name: 'Buy' });
    await buyBtn.hover();
    await page.waitForTimeout(PAUSE_SHORT);
    await buyBtn.click();
    await page.waitForTimeout(PAUSE_LONG);
    // Should now be on /my-library with the purchased book

    // 1e. Show Purchase page separately — QR code flow
    await page.goto('/purchase/1');
    await page.waitForSelector('.qr-code', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_MED);

    // Scroll down to show instructions + QR together
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await page.waitForTimeout(PAUSE_SHORT);
    await page.evaluate(() => window.scrollBy({ top: -150, behavior: 'smooth' }));
    await page.waitForTimeout(PAUSE_MED);

    // Click "I've Paid" → success state
    const paidBtn = page.getByRole('button', { name: /I've Paid/i });
    await paidBtn.hover();
    await page.waitForTimeout(PAUSE_SHORT);
    await paidBtn.click();
    await page.waitForSelector('.success-icon', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_LONG); // hold on success checkmark
  });

  // ────────────────────────────────────────────────────────
  // CLIP 2: Reader Experience  (~14s)
  // ────────────────────────────────────────────────────────
  test('clip-02-reader', async ({ page }) => {
    await enableMockAuth(page);

    // 2a. Open reader
    await page.goto('/read/1');
    await page.waitForSelector('.scene-viewport', { timeout: 15000 });
    await page.waitForTimeout(PAUSE_MED);

    // 2b. Click "Download All" — shows progress bar animation
    const downloadBtn = page.getByRole('button', { name: /Download All/i });
    const hasDownloadBtn = await downloadBtn.isVisible().catch(() => false);
    if (hasDownloadBtn) {
      await downloadBtn.hover();
      await page.waitForTimeout(PAUSE_SHORT);
      await downloadBtn.click();
      // Let the progress bar animate — wait a few seconds
      await page.waitForTimeout(3000);
    }

    // 2c. Navigate through scenes with pauses
    // Scene 1 is already showing. Hold.
    await page.waitForTimeout(PAUSE_READ);

    // Go to Scene 2
    const nextBtn = page.getByRole('button', { name: /Next →/i });
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(PAUSE_READ);
    }

    // Go to Scene 3
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(PAUSE_READ);
    }

    // Go to Scene 4
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await page.waitForTimeout(PAUSE_READ);
    }

    // Go back one to show bidirectional nav
    const prevBtn = page.getByRole('button', { name: /← Prev/i });
    if (await prevBtn.isEnabled()) {
      await prevBtn.click();
      await page.waitForTimeout(PAUSE_MED);
    }
  });

  // ────────────────────────────────────────────────────────
  // CLIP 3: Creator Studio UX  (~12s)
  // ────────────────────────────────────────────────────────
  test('clip-03-studio', async ({ page }) => {
    await enableMockAuth(page);

    // 3a. Studio Dashboard — show project list
    await page.goto('/studio');
    await page.waitForSelector('.studio', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_MED);

    // 3b. Click the existing project card to open the editor
    const projectCard = page.locator('.content-card').first();
    await projectCard.hover();
    await page.waitForTimeout(PAUSE_SHORT);
    await projectCard.click();
    await page.waitForSelector('.studio-editor', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_MED);

    // 3c. Scroll to the first scene card
    await page.locator('.scene-card').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(PAUSE_SHORT);

    // 3d. Type Lao narration into the first textarea (use fill for Unicode safety)
    const narrationInput = page.locator('.narration-input').first();
    await narrationInput.click();
    await page.waitForTimeout(PAUSE_SHORT);
    await narrationInput.fill('');
    await narrationInput.fill('ຄວາຍໃຫຍ່ຍ່າງຜ່ານທົ່ງນາໃນຕອນເຊົ້າ ຕາເວັນຂຶ້ນຢູ່ເທິງພູເຂົາ');
    await page.waitForTimeout(PAUSE_SHORT);

    // Blur to save
    await page.locator('.editor-toolbar').click();
    await page.waitForTimeout(PAUSE_MED);

    // 3e. Wait for Generate button to become enabled, then click
    const generateBtn = page.locator('.generate-btn').first();
    await generateBtn.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(PAUSE_SHORT);
    await generateBtn.hover();
    await page.waitForTimeout(PAUSE_SHORT);
    await generateBtn.click();

    // 3f. Wait for the 2-second stub generation + preview iframe to appear
    await page.waitForSelector('.scene-preview-frame', { timeout: 15000 });
    await page.waitForTimeout(PAUSE_LONG);

    // 3g. Scroll to show scene card + preview in frame
    await page.evaluate(() => window.scrollBy({ top: 100, behavior: 'smooth' }));
    await page.waitForTimeout(PAUSE_MED);
  });

  // ────────────────────────────────────────────────────────
  // CLIP 4: Admin Payment Verification  (~8s)
  // ────────────────────────────────────────────────────────
  test('clip-04-admin', async ({ page }) => {
    await enableMockAuth(page);

    // 4a. Admin panel
    await page.goto('/admin');
    await page.waitForSelector('.admin-table', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_MED);

    // 4b. Scroll the table to show data
    await page.evaluate(() => window.scrollBy({ top: 150, behavior: 'smooth' }));
    await page.waitForTimeout(PAUSE_SHORT);

    // 4c. Click the "Confirm" (✓) button on the first pending payment
    const confirmBtn = page.locator('.action-btn.confirm').first();
    const hasConfirm = await confirmBtn.isVisible().catch(() => false);
    if (hasConfirm) {
      await confirmBtn.hover();
      await page.waitForTimeout(PAUSE_SHORT);
      await confirmBtn.click();
      await page.waitForTimeout(PAUSE_LONG); // hold on updated table
    }

    // 4d. Switch to "All" tab to show the full payment history
    const allTab = page.getByRole('button', { name: 'All' });
    await allTab.click();
    await page.waitForTimeout(PAUSE_LONG);
  });
});
