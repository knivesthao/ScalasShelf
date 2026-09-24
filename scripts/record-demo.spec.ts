/**
 * Textweaver Demo Video — Automated Recording Script
 *
 * Records 4 clips of the MVP for the demo/pitch video, each as a .webm in ./recordings.
 *
 *   1. Read:     library → book → animated panels → tap a word → quiz
 *   2. Offline:  download a book → it's in My Library, readable without internet
 *   3. Studio:   write a story line; the level check flags hard words
 *   4. Studio:   choose words to teach → the quiz drafts itself
 *
 * (Scene art generation and publishing are switched off for now; see src/lib/features.ts.)
 *
 * Prerequisites:
 *   1. Fresh demo data:       rm -rf .data
 *   2. Start the dev server:  npm run dev
 *   3. Record:                npm run record
 *   4. Videos land in:        ./recordings/   (convert to .mp4 with ffmpeg if needed)
 */

import { test, type Page } from '@playwright/test';

const PAUSE_SHORT = 600; // brief pause between clicks
const PAUSE_MED = 1200; // let the UI settle
const PAUSE_LONG = 2000; // hold so it's visible in the video
const PAUSE_READ = 2800; // hold on a comic panel while it animates

async function scrollTo(page: Page, selector: string) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForTimeout(PAUSE_SHORT);
}

test.describe('Textweaver Demo Video — Automated Recording', () => {
  test('clip-01-read', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.content-grid', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_MED);

    await page.getByText('Morning Market').first().click();
    await page.waitForSelector('.book-hero', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_LONG);

    await page.getByRole('link', { name: 'Read' }).click();
    await page.waitForSelector('.reader-panel .mp-layer', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_READ);

    // Tap a word to see its meaning
    await page.getByRole('button', { name: 'market', exact: true }).click();
    await page.waitForTimeout(PAUSE_LONG);
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(PAUSE_SHORT);

    // Scroll through the other panels
    const panels = page.locator('.reader-panel');
    for (let i = 1; i < (await panels.count()); i++) {
      await panels.nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(PAUSE_READ);
    }

    // Answer the first quiz question
    await scrollTo(page, '.quiz');
    await page.locator('.quiz-option-btn').first().click();
    await page.waitForTimeout(PAUSE_LONG);
  });

  test('clip-02-offline', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Morning Market').first().click();
    await page.waitForSelector('.book-hero', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_MED);

    await page.getByRole('button', { name: 'Download for offline' }).click();
    await page.waitForSelector('text=✓ Saved on this phone', { timeout: 15000 });
    await page.waitForTimeout(PAUSE_LONG);

    await page.goto('/my-library');
    await page.waitForSelector('.saved-item', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_LONG);
  });

  test('clip-03-studio-write', async ({ page }) => {
    await page.goto('/studio');
    await page.waitForSelector('.studio .content-card', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_LONG);

    await page.getByText('Noy and the Buffalo (my draft)').click();
    await page.waitForSelector('.studio-editor', { timeout: 10000 });
    await page.waitForTimeout(PAUSE_MED);

    // Write a line; the level check flags words above A1 as you type
    await page.getByText('+ Add line').click();
    const newLine = page.locator('.line-input').last();
    await newLine.click();
    await newLine.pressSequentially('The rice field is beautiful and quiet.', { delay: 40 });
    await page.waitForTimeout(PAUSE_LONG);
  });

  test('clip-04-studio-words-and-quiz', async ({ page }) => {
    await page.goto('/studio');
    await page.getByText('Noy and the Buffalo (my draft)').click();
    await page.waitForSelector('.studio-editor', { timeout: 10000 });

    // Teach three words
    await page.getByRole('tab', { name: 'Words' }).click();
    const words: [string, string][] = [
      ['morning.', 'the early part of the day'],
      ['buffalo.', 'a big farm animal with horns'],
      ['late!', 'not on time'],
    ];
    for (const [word, meaning] of words) {
      await page.getByRole('button', { name: word, exact: true }).click();
      await page.getByLabel('Simple meaning').pressSequentially(meaning, { delay: 20 });
      await page.getByLabel(/Teach this word/).check();
      await page.waitForTimeout(PAUSE_SHORT);
    }
    await page.waitForTimeout(PAUSE_MED);

    // The quiz drafts itself from those words
    await page.getByRole('tab', { name: 'Quiz' }).click();
    await page.getByRole('button', { name: /Draft quiz|Replace with a new draft/ }).click();
    await page.waitForTimeout(PAUSE_LONG);
  });
});
