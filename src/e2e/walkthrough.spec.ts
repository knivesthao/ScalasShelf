// Smoke test of the MVP in a real browser. Needs `npm run dev` running (fresh .data/).
import { test, expect } from '@playwright/test';

test.describe('Scala’s Shelf walkthrough', () => {
  test('library → book → reader → word meaning → quiz', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await expect(page.getByRole('heading', { name: 'Scala’s Shelf' })).toBeVisible();
    await page.getByText('Morning Market').first().click();
    await expect(page.getByText(/new words/)).toBeVisible();
    await page.getByRole('link', { name: 'Read' }).click();
    await expect(page.locator('.reader-panel')).toHaveCount(3);
    await page.getByRole('button', { name: 'market', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Word meaning' }).getByText('a place where people buy and sell food')).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByText('Check your understanding')).toBeVisible();
  });

  test('download for offline shows up in My Library', async ({ page }) => {
    await page.goto('http://localhost:5173/book/book-demo-market');
    await page.getByRole('button', { name: 'Download for offline' }).click();
    await expect(page.getByText('✓ Saved on this phone')).toBeVisible({ timeout: 15000 });
    await page.goto('http://localhost:5173/my-library');
    await expect(page.locator('.saved-item')).toHaveCount(1);
  });

  test('studio: write on this device, no art generation yet', async ({ page }) => {
    await page.goto('http://localhost:5173/studio');
    await page.getByText('Noy and the Buffalo (my draft)').click();
    await expect(page.locator('.line-input').first()).toBeVisible();
    await expect(page.getByRole('tab')).toHaveText(['Script', 'Words', 'Quiz', 'Publish']);
    await expect(page.getByText('Generate scene art')).toHaveCount(0);
  });
});
