import { test, expect } from '@playwright/test';
import { injectAxe, getAxeResults } from 'axe-playwright';

test.describe('public portal accessibility', () => {
  test('landing page has no critical axe violations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Novastra|Student/i);
    await injectAxe(page);
    const results = await getAxeResults(page);
    const critical = results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact));
    expect(critical, critical.map((item) => `${item.id}: ${item.help}`).join('\n')).toEqual([]);
  });

  test('login form exposes labels and keyboard focus', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/welcome back|sign in/i).first()).toBeVisible();
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });
});
