# Security Overview & Pen-Test Prep Pack

Hand this document to a security reviewer / penetration tester before go-live.

## 1. Architecture summary

- SPA (React) served by nginx, API (Express 5 + Prisma) behind Caddy (auto-TLS).
- Postgres 18 in a private Docker network; only 80/443 are exposed publicly.
- Single-tenant-per-institution data model with **row-level tenant isolation**:
  every tenant-scoped query is automatically filtered by a Prisma client
  extension; JWT tokens are bound to a tenant and rejected on other tenants.
  Platform operator accounts (`/api/platform`) are fully separated (scope
  `platform` tokens are rejected by tenant APIs and vice versa).

## 2. Implemented controls (what to verify)

**Authentication & sessions**
- bcrypt (cost 12) password hashes; password policy: 8–64 chars, upper+lower+digit
- Account lockout: 5 failed logins → 15 minutes (`423 Locked`)
- Optional TOTP 2FA per user (leading-zero-safe implementation)
- `mustChangePassword` enforced after admin resets / imports
- JWT with `tid` (tenant) claim; signed with `JWT_SECRET` (min 16 chars enforced,
  recommend 48+ random bytes); access tokens expire after 15 minutes and refresh
  tokens are HTTP-only, 30-day cookies tied to the server session and token version
- Password reset tokens are single-use with expiry

**Authorization**
- Role middleware (`STUDENT`/`FACULTY`/`ADMIN`) plus granular permission strings
  (`students:import`, `fees:manage`, …) with wildcard support
- Platform console is a separate identity system (own table, own JWT scope)
- Quota middleware enforces per-tenant plan limits (403 `PLAN_LIMIT_REACHED`)

**Input & transport**
- zod validation on all sensitive bodies; Prisma parameterized queries (no raw SQL
  with user input except internal `TRUNCATE` in tests)
- Helmet with strict CSP in production, HSTS, `frame-ancestors 'none'`
- Origin/Referer CSRF guard for state-changing requests
- Rate limits: global 600 req/15 min/IP, login 20/15 min, uploads 60/h
- Upload allow-list (pdf/jpeg/png/webp/csv/xlsx), 10 MB cap
- Payment webhooks verified with Stripe signatures over the raw body
- CSV importers validate row-by-row and never execute content

**Operations**
- Audit log for all privileged mutations (`audit_logs`, tenant-scoped)
- Structured JSON logs with request IDs; optional Sentry
- `/api/metrics` behind bearer `METRICS_TOKEN`
- Secrets only via environment (`.env` gitignored); `gitleaks` + `npm audit`
  run in CI

## 3. External-only penetration test scope

Penetration testing is intentionally **external-only** and must target an
approved staging hostname. Do not run destructive checks against production,
local Docker services, or a shared demo tenant. The maintainer must provision
short-lived, least-privilege accounts out-of-band and revoke them after the
engagement; credentials are never stored in this repository or in test scripts.

Required evidence for sign-off:

- approved target hostname, test window, and written authorization;
- tester source IPs and rate-limit allow-list (if required);
- OWASP ZAP/Burp export with severity, endpoint, reproduction, and remediation;
- retest report showing all critical/high findings closed or explicitly risk-accepted.

## 4. Staging test personas (provision out-of-band)

| Role | Account | Notes |
|---|---|---|
| Student | short-lived staging persona | full student flows |
| Faculty | short-lived staging persona | marks, attendance |
| Admin | short-lived staging persona | only the permissions under test |
| Platform operator | short-lived staging persona | `/platform` console, if explicitly approved |

Create a dedicated tenant for testing via the platform console; do NOT run
destructive tests (delete/reset) against the shared demo tenant.

## 5. Suggested test checklist

1. **AuthN**: brute force against login (expect 429/423), lockout bypass via
   case/whitespace variations, JWT tampering, expired token handling.
2. **AuthZ**: student token accessing faculty/admin endpoints; admin without
   granular permission; platform token against tenant API and reverse.
3. **Tenant isolation**: with tokens for two tenants, attempt IDOR on students,
   challans, payments, notifications, files (swap `id` values). All must 404.
4. **IDOR on uploads/documents**: fetch another user's document/challan PDF.
5. **Injection**: SQL/NoSQL via search, sort, filter query params (Prisma should
   reject invalid field names); stored XSS via profile fields, complaints,
   notices, chat (check rendering).
6. **CSV import**: malformed rows, formula injection strings (`=cmd|...`),
   oversized files, non-CSV content with `.csv` name.
7. **Payments**: forged webhook without signature; replay of a signed webhook
   (must be idempotent); checkout for a challan of another student.
8. **Rate limiting**: burst login, OTP, forgot-password (expect 429s).
9. **File upload**: MIME spoofing, oversized payload, path traversal in name.
10. **Security headers/TLS**: CSP, HSTS, cookie flags, TLS config (ssllabs A+).

## 6. Accepted risks / out of scope for v1

- Single VM: no HA/failover; availability depends on the host and provider.
- No WAF/CDN in front (can be added at the hosting layer).
- SMS/payment depend on third-party providers (Twilio/Stripe) and their SLAs.
- Dev fallbacks (email outbox, simulated payments) must NOT be active in
  production — `GET /api/status` shows the active modes; alert if `simulated`.

## 7. Reporting & triage

- Report findings to the maintainer with reproduction steps and impact.
- Triage SLA: critical ≤ 48 h, high ≤ 7 days, medium ≤ 30 days.
- Fixes ship through CI; add a regression test for every security fix.
- Key rotation procedure: `docs/runbook.md` §10.
