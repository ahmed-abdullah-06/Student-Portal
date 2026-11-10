# Frontend telemetry and CSP deployment notes

## Sentry

Set `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_TRACES_SAMPLE_RATE`
and (optionally) `VITE_APP_VERSION` in the frontend build environment. These
values are intentionally public build-time configuration; never put a Sentry
auth token in Vite variables or browser code. The browser SDK disables PII,
session replay, and telemetry during tests. The outer React error boundary and
the shared boundary both report uncaught render errors.

Set `SENTRY_DSN` on the API process separately. The backend SDK uses a low
transaction sample rate and redacts request logging through the existing pino
configuration. Configure Sentry's retention, alert routing, and release
health checks in the organization's Sentry project; those are external
prerequisites and cannot be verified from this repository.

## CSP nonce

Production Express responses generate a fresh `res.locals.cspNonce` per
request. Helmet emits it in `script-src` while retaining `script-src 'self'`;
the SPA currently has no inline scripts. If a server-rendered bootstrap script
is added, apply the response nonce to that script tag. Do not reintroduce
`unsafe-inline` for scripts. Inline styles remain allowed because tenant
branding uses CSS custom properties; moving those values to a stylesheet is a
future hardening option.

## Mobile and accessibility validation

Run `npm run test:e2e --prefix frontend` with Chromium at 360, 390, 430, 768,
and 1024px widths. The shared buttons use a 44px minimum touch target, tables
use overflow wrappers, and alerts expose `role="alert"` plus polite live
announcements. A full authenticated 42-page contrast and label audit still
requires seeded staging credentials and is an external validation prerequisite.
