# Admin and observability completion patterns

Bulk admin workflows should invalidate token versions, cap request sizes, and use existing tenant-scoped models wherever possible; frontend Sentry should be PII-disabled and configured only with public build-time DSN values.

## What Happened
The Student-Portal completion follow-up added bounded bulk user operations, targeted in-app notices, a cross-entity admin search/activity view, browser Sentry boundaries, and a request-scoped CSP nonce.

## Takeaway
Use existing notification and audit models before adding schema fields, and record deployment-owned Sentry/staging prerequisites separately from code validation.

## History
- 2026-10-24 (Student-Portal/completion-followup-admin-observability): initial
