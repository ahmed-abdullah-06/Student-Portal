# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical-paths.spec.js >> critical public paths >> legal pages are reachable from landing page
- Location: e2e\critical-paths.spec.js:4:3

# Error details

```
Error: locator.click: Error: strict mode violation: getByRole('link', { name: /privacy/i }) resolved to 2 elements:
    1) <a href="/privacy" class="ml-1 font-semibold text-brand-700 underline">Read our privacy notice</a> aka getByRole('link', { name: 'Read our privacy notice' })
    2) <a href="/privacy" data-discover="true" class="text-[#1e3a8a] hover:underline">Privacy</a> aka getByRole('link', { name: 'Privacy', exact: true })

Call log:
  - waiting for getByRole('link', { name: /privacy/i })

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - dialog "Cookie preferences" [ref=e3]:
    - paragraph [ref=e4]:
      - text: We use essential cookies to keep you signed in and protect your account. Optional analytics cookies are off unless you opt in.
      - link "Read our privacy notice" [ref=e5] [cursor=pointer]:
        - /url: /privacy
      - text: .
    - generic [ref=e6]:
      - button "Essential only" [ref=e7] [cursor=pointer]
      - button "Allow optional cookies" [ref=e8] [cursor=pointer]
  - generic [ref=e10]:
    - generic [ref=e12]:
      - generic [ref=e13]: NU
      - generic [ref=e15]:
        - generic [ref=e16]: Novastra
        - generic [ref=e17]: Campus Portal
    - generic [ref=e18]:
      - generic [ref=e19]:
        - link "Choose a different portal" [ref=e20] [cursor=pointer]:
          - /url: /
        - text: CAMPUS PORTAL
        - heading "Welcome back" [level=2] [ref=e23]
        - paragraph [ref=e24]: Sign in with your university credentials.
        - button "Novastra University Change" [ref=e25] [cursor=pointer]:
          - text: Novastra University
          - generic [ref=e30]: Change
      - generic [ref=e31]:
        - generic [ref=e32]: Email / Registration Number
        - textbox "Email / Registration Number Use your email or registration number (e.g. SP23-BSCS-001)" [ref=e33]:
          - /placeholder: sp23-bscs-001@student.novastra.edu.pk or SP23-BSCS-001
        - generic [ref=e34]: Use your email or registration number (e.g. SP23-BSCS-001)
      - generic [ref=e35]:
        - generic [ref=e36]: Password
        - generic [ref=e37]:
          - textbox "Password Show password" [ref=e38]:
            - /placeholder: ••••••••
          - button "Show password" [ref=e39] [cursor=pointer]
      - generic [ref=e43]:
        - button "Refresh captcha" [ref=e45] [cursor=pointer]
        - textbox "Captcha answer" [ref=e51]:
          - /placeholder: Enter code
      - generic [ref=e52]:
        - generic [ref=e53] [cursor=pointer]:
          - checkbox "Remember me" [ref=e54]
          - text: Remember me
        - link "Forgot password?" [ref=e55] [cursor=pointer]:
          - /url: /forgot-password
      - button "Sign in to portal" [ref=e56] [cursor=pointer]
      - paragraph [ref=e59]:
        - text: Need help? Contact
        - strong [ref=e60]: IT Support
        - text: at +92-51-111-001-001 · support@novastra.edu.pk
      - generic [ref=e61]:
        - generic [ref=e62]: Demo accounts
        - generic [ref=e63]:
          - generic [ref=e64]: admin@novastra.edu.pk / admin123
          - generic [ref=e65]: ali.khan@novastra.edu.pk / faculty123
          - generic [ref=e66]: SP23-BSCS-001 / student123 (reg. no. login)
      - paragraph [ref=e67]:
        - text: © 2026 Novastra University. All rights reserved.
        - link "Privacy" [ref=e68] [cursor=pointer]:
          - /url: /privacy
        - text: ·
        - link "Terms" [ref=e69] [cursor=pointer]:
          - /url: /terms
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('critical public paths', () => {
  4  |   test('legal pages are reachable from landing page', async ({ page }) => {
  5  |     await page.goto('/login');
> 6  |     await page.getByRole('link', { name: /privacy/i }).click({ force: true });
     |                                                        ^ Error: locator.click: Error: strict mode violation: getByRole('link', { name: /privacy/i }) resolved to 2 elements:
  7  |     await expect(page).toHaveURL(/privacy|legal/i);
  8  |     await expect(page.getByRole('main')).toBeVisible();
  9  |   });
  10 | 
  11 |   test('invalid login shows an accessible error', async ({ page }) => {
  12 |     await page.goto('/login');
  13 |     await page.locator('input[autocomplete="username"]').fill('invalid@example.com');
  14 |     await page.locator('input[autocomplete="current-password"]').fill('invalid-password');
  15 |     await page.getByRole('button', { name: /sign in|login/i }).click();
  16 |     await expect(page.getByRole('alert')).toBeVisible({ timeout: 10000 });
  17 |   });
  18 | });
  19 | 
```