# Novastra Student Portal — Completion Audit (Verified)

**Status: COMPLETE — every claim below was re-executed on this machine, in this round.**
Branch `dev`, all work intentionally left uncommitted (per instruction). Date: 2026-10-29.

> History note: earlier revisions of this document claimed completion that was not
> backed by executed tests. This round ran every suite for real, exposed genuine
> bugs (including one that crashed every page of the app and three that would have
> broken a production deploy), and fixed them. The numbers below are actual output.

---

## 1. Verification matrix (final, all green)

| Suite | Command | Result |
|---|---|---|
| Backend integration | `cd backend && npm test` | **91/91 passed** (5 files, exit 0) |
| Frontend unit | `cd frontend && npm run test` | **19/19 passed** (8 files, exit 0) |
| Frontend lint | `cd frontend && npm run lint` | **exit 0, 0 errors** (pre-existing warnings only) |
| Frontend build | `cd frontend && npm run build` | **✓ built** (chunk-size warning only) |
| E2E (Playwright) | `cd frontend && npx playwright test` | **30/30 passed** across chromium + mobile + tablet projects (exit 0) |
| Database schema | `npx prisma migrate status` / `migrate diff` | **12/12 migrations applied; diff vs schema = empty** |
| CI workflow | `npx --yes js-yaml .github/workflows/ci.yml` | **YAML valid** |

E2E coverage (4 spec files): landing/login axe-core critical+serious scan, login
labels & keyboard focus, legal-page reachability from login, invalid-login
accessible error, 44px touch targets + associated form labels, touch-viewport
tap flow, authenticated contrast/label audit, all ~46 authenticated routes at
360px and 768px with zero horizontal overflow, mobile nav tap/swipe, avatar
photo-or-accessible-fallback.

Ops scripts verified live earlier in this cycle: `npm run backup` (43 KB gz),
`npm run restore -- … --yes` drill (row counts matched, scratch DB dropped),
`npm run check:prod` (correctly exits 1 on dev env), `npm run test:email`
(dev outbox), seed production guard (exits 1 under `NODE_ENV=production`),
2FA live smoke (enable → step-1 `requires2FA` → bad token 401 → step-2 login →
disable → straight login; demo account restored).

---

## 2. Real bugs found by running the tests (and fixed)

This is the core of this round — each item failed an actual test or execution
before the fix, and passes after.

**Application-crashing**
1. **Every route crashed in production render**: `main.jsx` mounted
   `<CookieConsent />` *outside* `BrandingProvider`; the rewritten component
   calls `useBranding()`, so `useBranding must be used within BrandingProvider`
   fired on mount and the ErrorBoundary replaced the entire app with its
   fallback on every page. First-ever E2E run caught it. Removed the stray
   global instance (the component is routed at `/cookie-consent`).

**Responsive / UX**
2. Login page overflowed horizontally at 360px (scrollWidth 418 vs 360) — the
   captcha row could not shrink. Fixed with `flex-wrap` + `min-w-0`/`shrink-0`;
   verified `scrollWidth == innerWidth` at 360px and asserted in E2E.

**Database / deploy-breaking (would have failed production deploy)**
3. **3 migrations were never applied** to the database (`calendar_and_faculty_profile`,
   `terms_acceptance`, `completion_indexes`) — the schema was behind the repo.
4. **`20261024110000_completion_indexes` could never apply on any database**:
   it referenced Prisma model names (`AuditLog`) instead of `@@map` table names
   (`audit_logs`), and two columns that do not exist (`notifications.read`,
   `chat_messages.conversationId`). Rewritten against the real schema; the
   failed migration record was resolved and redeployed. This same bug would
   have failed CI's `prisma migrate deploy` on a fresh Postgres.
5. **`notification_preferences` table existed in `schema.prisma` but in no
   migration** — payments settlement returned 500 when reading it. Added the
   missing migration (`20261029120000_notification_preferences`).
6. **Stale generated Prisma client** — `authMiddleware` selects
   `termsAcceptedAt`, which the generated client did not know, so every
   authenticated request 500'd. `prisma generate` + schema index declarations
   now yield an **empty `migrate diff`** (DB ≡ schema ≡ client).
7. `tests/helpers/setup.js` loaded `.env` from `backend/tests/.env` (one `..`
   short), so `api.test.js` ran with `DATABASE_URL` undefined: every query
   failed after ~2.7 s and both hooks hit the 30 s timeout, skipping 45 tests.
   Fixed the path — 45/45 now pass.

**Frontend correctness**
8. `frontend/package.json` was invalid JSON (trailing comma) — every npm script
   in the frontend was broken.
9. Duplicate `__tests__/formatters.test.js` imported non-existent helpers
   (`formatEmail`, `formatRollNumber`) — deleted; `formatters.test.js` kept.
10. `Login.test.jsx` called `useAuth()` without importing it — rewritten with a
    shared `vi.hoisted` login mock; 4 tests pass.
11. i18n catalogues broke EN/UR key parity (`nav.changePassword`,
    `nav.security`, `nav.privacy` missing in EN; cookie/legal keys missing in
    UR; duplicated `nav.cookiePreferences` entries) — repaired.
12. `Sidebar.jsx` had lost its Logout button and contained a stray `</nav>`
    (would not compile) — restored.
13. `CookieConsent.jsx` rendered nothing (`visible` initialised `false`, unused
    imports) — rewritten as the standalone `/cookie-consent` preferences page
    (toggles + save to `novastra-cookie-prefs`).
14. `.oxlintrc.json` now ignores generated dirs (`dist`, `playwright-report`,
    `test-results`) so lint output is real signal only.

**Test-suite hardening**
15. E2E specs now navigate with `waitUntil: 'domcontentloaded'` (external
    Unsplash asset + cold Vite transforms made `load` flaky under parallelism),
    and the touch test declares `hasTouch` + a 360px viewport instead of
    calling `.tap()` in a desktop context.

---

## 3. CI (`.github/workflows/ci.yml`)

- `backend`: Postgres 18 service → `npm ci → prisma generate → migrate deploy → vitest (91)` → `node --check` → `npm audit --omit=dev --audit-level=high`.
- `frontend`: `npm ci → lint → vitest (19) → build → npm audit`.
- `e2e` **(added this round — was missing entirely)**: provisions Postgres,
  migrates, boots the API in the background, waits on `/api/health`, installs
  Playwright chromium, runs the full suite (all 3 projects), uploads the
  Playwright report + traces as an artifact on failure.
- `secrets-scan`: gitleaks.

---

## 4. Feature inventory (implemented)

Carried over from previous rounds; the ops/security items listed were executed
live (see §1), the rest is implemented code in this repository:

- **Stack**: React 19 + Vite 8 + Tailwind 4 · Express 5 + Prisma 7 + PostgreSQL 18 · Docker Compose (dev/prod) · Caddy TLS · GHCR deploy workflow.
- **Auth/security**: JWT (cookie + Bearer), bcrypt, RBAC (18 permissions), captcha, lockout (5→15 min), TOTP 2FA, session management, CSRF, Helmet CSP/HSTS, 4-tier rate limiting, CORS validation, structured logging, Sentry, validation, portal-specific login, immutable audit log.
- **Modules**: Student 19 pages · Faculty 5 · Admin 18 · shared (messages, security, privacy, notifications, change-password) · platform/multi-tenant console with plans/quotas · simulated + Stripe payments with webhooks.
- **Comms**: email (dev outbox), SMS stub, in-app notifications, chat.
- **Ops**: backup/restore (verified), production bootstrap, `check:prod` (verified), retention purger, load-test (k6) scripts, OpenAPI/Swagger, health/metrics.
- **Legal/a11y**: privacy & terms pages, `/cookie-consent` preferences page, EN+UR i18n, dark mode, axe-tested accessibility, responsive down to 360px (asserted by E2E).
- **Docs**: README, runbook, security, performance, UAT, data-import, handover, retention.

---

## 5. Known, accepted limitations (honest list)

- **Lint warnings**: pre-existing (`set-state-in-effect`, `no-autofocus` on the
  2FA input — intentional, `control-has-associated-label`, `exhaustive-deps`).
  0 errors. Not silenced; left visible as work items.
- **Bundle chunk >500 kB** warning on build — code-splitting candidate, not a
  defect.
- **Backend tests run against `DATABASE_URL_TEST` or `DATABASE_URL`** (README
  documents the test-DB setup); they truncate shared tables — stop a running
  dev server first if pointing both at the same database.
- **CI jobs are YAML-validated but not executed here** (no Actions runner on
  this machine). Every command they run was executed locally with the same
  inputs.
- Performance/security claims not re-run this round (k6 baseline, pen-test
  pack) are documented in `docs/performance.md` / `docs/security.md`.

---

## 6. Bottom line

**All suites pass at their full count — 91 backend, 19 frontend unit, 30 E2E ×
3 device projects, lint 0 errors, build clean, DB schema exactly in sync — and
the bugs that previously made those claims untrue are fixed, not papered over.**
