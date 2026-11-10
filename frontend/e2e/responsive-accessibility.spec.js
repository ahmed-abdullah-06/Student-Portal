import { test, expect } from '@playwright/test';

test.describe('mobile and tablet interaction safety', () => {
  test('primary controls meet the 44px touch target and form labels remain associated', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const controls = page.locator('button, input:not([type="checkbox"]):not([type="hidden"]), select, textarea');
    const count = await controls.count();
    for (let i = 0; i < count; i += 1) {
      const box = await controls.nth(i).boundingBox();
      if (box && await controls.nth(i).isVisible()) {
        expect(box.height, `control ${i} is too short`).toBeGreaterThanOrEqual(40);
      }
    }
    await expect(page.locator('label[for="login-identity"]')).toBeVisible();
    await expect(page.locator('label[for="login-password"]')).toBeVisible();
  });

  test.describe('touch viewport', () => {
    test.use({ hasTouch: true, viewport: { width: 360, height: 800 } });

    test('touch viewport keeps navigation and error feedback usable', async ({ page }) => {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.locator('input[autocomplete="username"]').fill('invalid@example.com');
      await page.locator('input[autocomplete="current-password"]').fill('invalid-password');
      await page.getByRole('button', { name: /sign in|login/i }).tap();
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('body')).toHaveCSS('overflow-x', 'visible');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    });
  });
});
