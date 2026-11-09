## [completion-followup-2026-10-24] Implemented feasible completion requirements
- Added Playwright + axe E2E scaffolding, including mobile Chromium coverage and keyboard/error flows.
- Added attendance activity heatmap, semester milestone calendar integration, student-visible faculty contact fields, photo resize/compression, and challan PDF download action.
- Shared button classes now enforce 44px minimum touch targets.
- Frontend Vitest initially discovered E2E files; excluding `e2e/**` in Vite config kept unit and browser runners separate.
- Learnings consumed: [(none)]

## [completion-followup-2026-10-24-admin-observability] Closed locally feasible audit gaps
- Codebase/domain discoveries (gotchas, non-obvious behavior): admin routes already
  use granular permission middleware; notification rows can provide targeted
  delivery without a schema migration; generated Prisma client is stale versus
  the checked-in schema and blocks the backend suite before route assertions.
- Wrong assumptions and corrections: the root package is only a command wrapper;
  Sentry must be installed under `frontend/`, not at repository root.
- Debugging dead-ends and what actually worked: direct `npx prisma generate`
  attempted to fetch an incompatible RC and was stopped; syntax checks plus
  frontend tests/build provided reliable local validation.
- Techniques/patterns worth reusing for future tasks: preserve tenant-scoped
  Prisma calls, use bounded bulk limits, invalidate token versions on bulk
  password/status changes, and keep browser Sentry PII disabled.
- Learnings consumed: [modernize-rearchitecture-worker/completion-followup]

## [completion-followup-2026-10-24-hardening] Added accessible/privacy/i18n hardening
- Codebase/domain discoveries (gotchas, non-obvious behavior): the root package is a command wrapper, so its missing test script must delegate to the frontend; backend tests remain blocked by the generated Prisma/schema mismatch and database setup timeout.
- Wrong assumptions and corrections: the audit's email/photo entries were stale; HTML templates and photo upload already existed, while an admin preview endpoint was still missing.
- Debugging dead-ends and what actually worked: backend syntax checks must run from `backend`; root-relative checks falsely report missing modules.
- Techniques/patterns worth reusing for future tasks: keep full translation and viewport audits open when only foundations are implemented; use environment validation for production CORS invariants and side-effect-free admin previews.
- Learnings consumed: [modernize-rearchitecture-worker/admin-observability, modernize-rearchitecture-worker/completion-followup]

## [completion-final-targeted-pass] Implemented performance, branding, accessibility, and recovery evidence
- Codebase/domain discoveries (gotchas, non-obvious behavior): reference settings already have server-side TTL caching; audit logs and major admin lists already expose pagination metadata; backup code already includes S3 upload and webhook alert hooks.
- Wrong assumptions and corrections: a naive row window would hide audit records, so the virtualization helper uses native `content-visibility:auto` while retaining all rows and API pagination.
- Debugging dead-ends and what actually worked: adding a wrapper with `role="alert"` duplicated the Alert component's role and broke an existing test; a polite live region without a second role preserved semantics.
- Techniques/patterns worth reusing for future tasks: keep deployment-owned branding and backup values explicit in `.env.production.example`; reconcile audit checkboxes only when a file-level evidence link exists.
- Learnings consumed: [modernize-rearchitecture-worker/admin-observability, modernize-rearchitecture-worker/completion-followup, modernize-rearchitecture-worker/completion-hardening]

## [completion-local-coverage-2026-10-24] Added local accessibility, pagination, privacy, i18n, and responsive coverage
- Codebase/domain discoveries (gotchas, non-obvious behavior): the root package delegates to frontend scripts; backend Vitest reaches database setup and can fail before assertions when the generated Prisma client/schema or test database is unavailable. Oxlint's jsx-a11y plugin exposes a smaller rule set than eslint-plugin-jsx-a11y, so unsupported rules must not be configured.
- Wrong assumptions and corrections: pagination edits initially matched the wrong enrollment handler; syntax checks caught this before completion and the handlers were corrected. Playwright report artifacts can contend under parallel mobile/tablet runs, so the final tablet check used one worker.
- Debugging dead-ends and what actually worked: a global 44px CSS minimum was needed for captcha/text controls not using the shared input class; excluding checkbox/radio/hidden controls from touch assertions preserves native compact controls.
- Techniques/patterns worth reusing: explicit response mappers are safer than spreading Prisma user records; use stable `auth.*`/`common.*` i18n keys on entry pages and provide a fallback hook for isolated component tests.
- Learnings consumed: [modernize-rearchitecture-worker/admin-observability, modernize-rearchitecture-worker/completion-followup, modernize-rearchitecture-worker/completion-hardening, modernize-rearchitecture-worker/reference-caching-and-rendering]
