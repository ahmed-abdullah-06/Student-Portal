import { test, expect } from '@playwright/test';

test.describe('critical public paths', () => {
  test('legal pages are reachable from landing page', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /privacy/i }).click({ force: true });
    await expect(page).toHaveURL(/privacy|legal/i);
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('invalid login shows an accessible error', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[autocomplete="username"]').fill('invalid@example.com');
    await page.locator('input[autocomplete="current-password"]').fill('invalid-password');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 });
  });
});
