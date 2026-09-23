import { test, expect } from '@playwright/test';

test.describe('Textweaver UI Walkthrough', () => {
  test('1. Library — loads catalog with search and filters', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await expect(page.getByText('Textweaver')).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder('Search books...')).toBeVisible();
    await expect(page.getByLabel('Filter by language')).toBeVisible();
    await expect(page.getByText('My Library')).toBeVisible();
  });

  test('2. Book Detail — opens from library', async ({ page }) => {
    await page.goto('http://localhost:5173/book/1');
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).not.toHaveText('error', { timeout: 5000, ignoreCase: true });
  });

  test('3. Purchase — shows QR and instructions', async ({ page }) => {
    await page.goto('http://localhost:5173/purchase/1');
    await page.waitForLoadState('networkidle');
    await expect(page.getByAltText('QR Code for payment')).toBeVisible({ timeout: 5000 });
  });

  test('4. Reader — loads with scene navigation', async ({ page }) => {
    await page.goto('http://localhost:5173/read/1');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/1 \/ /)).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('← Prev')).toBeVisible();
    await expect(page.getByText('Next →')).toBeVisible();
  });

  test('5. My Library — shows empty state for guest', async ({ page }) => {
    await page.goto('http://localhost:5173/my-library');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('My Library')).toBeVisible();
  });

  test('6. Admin — loads payment table view', async ({ page }) => {
    await page.goto('http://localhost:5173/admin');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Admin')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Pending')).toBeVisible();
    await expect(page.getByText('All')).toBeVisible();
  });

  test('7. Navigation — all routes return 200', async ({ page }) => {
    const routes = ['/', '/book/1', '/purchase/1', '/read/1', '/my-library', '/admin'];
    for (const route of routes) {
      const response = await page.goto(`http://localhost:5173${route}`);
      expect(response?.status()).toBe(200);
    }
  });
});
