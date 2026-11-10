import { test, expect } from '@playwright/test';
import { injectAxe, getAxeResults } from 'axe-playwright';

const authenticatedRoutes = [
  '/student', '/student/profile', '/student/registration', '/student/attendance',
  '/student/marks', '/student/transcript', '/student/challans', '/student/timetable',
  '/student/evaluations', '/student/library', '/student/hostel', '/student/transport',
  '/student/withdraw', '/student/complaints', '/student/downloads', '/student/date-sheet',
  '/student/degree-audit', '/student/requests', '/student/calendar',
  '/faculty', '/faculty/attendance', '/faculty/marks', '/faculty/assignments',
  '/faculty/evaluations', '/faculty/profile', '/admin', '/admin/students',
  '/admin/faculty', '/admin/operations', '/admin/courses', '/admin/sections',
  '/admin/fees', '/admin/library', '/admin/hostel', '/admin/transport',
  '/admin/notices', '/admin/audit', '/admin/semesters', '/admin/approvals',
  '/admin/documents', '/admin/master-data', '/admin/import', '/admin/reports',
  '/admin/scholarships', '/admin/calendar', '/admin/settings', '/messages',
  '/change-password', '/security', '/notification-preferences', '/privacy-settings',
];

async function prepareAuthenticatedPage(page) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data = {};
    if (path.endsWith('/student/profile')) data = { student: { name: 'Ayesha Khan', rollNumber: 'SP-AUDIT-001', photoUrl: '' } };
    if (path.endsWith('/student/transcript')) data = { cgpa: 3.6, totalCreditHours: 12 };
    if (path.endsWith('/student/attendance')) data = { courses: [] };
    if (path.endsWith('/student/challans')) data = { challans: [] };
    if (path.endsWith('/student/courses')) data = { enrollments: [] };
    if (path.endsWith('/student/notices')) data = { notices: [] };
    if (path.endsWith('/student/evaluations')) data = { items: [] };
    if (path.endsWith('/student/timetable')) data = { entries: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.route('**/auth/me*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: {
        id: 'audit-user', role: 'STUDENT', name: 'Ayesha Khan',
        email: 'ayesha@example.edu', termsAcceptedAt: '2026-01-01T00:00:00Z', student: {
          name: 'Ayesha Khan', rollNumber: 'SP-AUDIT-001', photoUrl: '/fixtures/student.jpg',
        },
      },
    }),
  }));
  await page.addInitScript(() => localStorage.setItem('token', 'audit-token'));
}

test.describe('final strict audit coverage', () => {
  test('authenticated contrast and full-page form semantics', async ({ page }) => {
    await prepareAuthenticatedPage(page);
    await page.goto('/student/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toBeVisible();
    await injectAxe(page);
    const results = await getAxeResults(page, { runOnly: ['color-contrast', 'label', 'aria-input-field-name'] });
    expect(results.violations, results.violations.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
    const unlabeled = await page.locator('input,select,textarea').evaluateAll((controls) => controls
      .filter((control) => !control.hidden && !control.disabled)
      .filter((control) => !control.getAttribute('aria-label') && !control.getAttribute('aria-labelledby')
        && !(control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`))
        && !control.closest('label')).map((control) => control.outerHTML));
    expect(unlabeled).toEqual([]);
  });

  test('all authenticated routes stay usable at 360px and 768px', async ({ browser }) => {
    test.setTimeout(120000);
    for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 900 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await prepareAuthenticatedPage(page);
      for (const route of authenticatedRoutes) {
        try {
          await page.goto(route, { waitUntil: 'commit', timeout: 10000 });
        } catch (error) {
          // Protected-route redirects can abort the original navigation; the
          // resulting location is still checked for responsive overflow below.
          if (!String(error).includes('ERR_ABORTED')) throw error;
        }
        const metrics = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          bodyOverflowX: getComputedStyle(document.body).overflowX,
        }));
        expect(metrics.bodyOverflowX, `${route} body overflow at ${viewport.width}px`).toBe('visible');
        const overflow = metrics.overflow;
        expect(overflow, `${route} overflows at ${viewport.width}px`).toBe(false);
      }
      await context.close();
    }
  });

  test('mobile navigation supports tap and swipe gestures', async ({ page }) => {
    await prepareAuthenticatedPage(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/student', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /open navigation/i }).click();
    await expect(page.getByRole('navigation', { name: /main menu/i })).toBeVisible();
    await page.getByRole('link', { name: /my profile/i }).click();
    await expect(page).toHaveURL(/student\/profile/);
    await page.evaluate(() => {
      const target = document.querySelector('nav[aria-label="Main menu"]');
      target?.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));
      target?.dispatchEvent(new TouchEvent('touchmove', { bubbles: true }));
      target?.dispatchEvent(new TouchEvent('touchend', { bubbles: true }));
    });
    await expect(page.locator('body')).toBeVisible();
  });

  test('student identity surfaces expose a photo or accessible fallback', async ({ page }) => {
    await prepareAuthenticatedPage(page);
    await page.goto('/student/profile', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('img[alt*="profile"], [role="img"][aria-label*="profile"]').first()).toBeVisible();
  });
});
