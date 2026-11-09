# Modernization Plan: Student Portal Completion

**Project**: Novastra Student Portal  
**Scope**: Unchecked, feasible requirements in `project_completion_audit.md` only

## Planning Constraints and Double-Check

- This is a JavaScript/React + Node/Express + PostgreSQL project, not Java or
  .NET. The modernization skill's required language values do not represent
  this repository; this plan therefore uses `javascript` in metadata and does
  not dispatch Java/.NET upgrade work.
- Existing uncommitted work is preserved. This plan is isolated under its own
  new directory and does not modify application files.
- The audit was checked against the current tree before planning. Items already
  present were excluded, including frontend unit/component tests and CI wiring,
  notification-preference UI/API, WebSocket server authentication and tenant
  checks, reconnection hook, photo upload endpoint/default avatar, lazy loading
  already present for major routes, error boundary/offline/session handling,
  systemd backup timers, rate-limit headers, frontend/backend Sentry
  foundations, calendar pages, faculty self-profile, and deployment
  documentation.
- Some audit checkboxes are conditional or already satisfied despite being
  unchecked. CSP currently has no inline scripts (only an inline-style
  allowance), CORS is configured from the exact `CLIENT_URL`, and raw SQL
  searches found only parameterized tagged health/metrics queries. These are
  verification gates in the security task, not duplicate implementation tasks.

## Technical Framework

- **Language**: JavaScript (Node.js CommonJS backend, React/JSX frontend)
- **Framework**: Express 5, React 19, Vite 8
- **Build tool**: npm
- **Database**: PostgreSQL via Prisma 7
- **Current validation**: Vitest, React Testing Library, Supertest, CI workflow

## Overview

The portal already provides the core university workflows. This plan closes the
remaining production-readiness gaps identified by the completion audit, starting
with P0 verification, accessibility, security, resilience, and compliance.
Later batches improve user experience, scale, observability, reporting, and
administrative quality of life. Each batch is independently validated before
the next sequential batch begins.

## Sequential Batches and Validation Strategy

### Batch 1 — P0 production gates

Implement the critical frontend E2E journeys, complete WCAG 2.1 AA coverage,
finish security hardening, and make backups off-site, observable, and
restore-drill-ready. Validate with browser tests, axe/Lighthouse and keyboard
checks, dependency/static/security tests, staging penetration evidence, backup
failure-alert tests, and a documented scratch-database restore.

### Batch 2 — P0 legal and communication completion

Complete terms/cookie/DPA deliverables and the missing branded email/template
preview behavior. Validate legal-page acceptance and consent persistence,
template rendering/snapshot checks, preview authorization, and delivery tests
against the existing email test harness.

### Batch 3 — P1 reliability and scale

Finish the missing real-time chat presence/typing UX, per-route crash
isolation, full-page i18n, large-data pagination/index/virtualization/caching,
and responsive mobile/tablet behavior. Validate WebSocket multi-user tests,
route-failure isolation, translation-key/RTL checks, representative
large-dataset performance tests, and 360/768/1024px browser runs.

### Batch 4 — P1 documents and observability

Complete branded transcript/certificate PDFs, challan/admit-card documents,
and frontend error reporting. Validate PDF text/layout/asset assertions,
print snapshots, and captured frontend error events without leaking secrets.

### Batch 5 — P2 product completeness

Finish photo processing/display hardening, attendance heatmap analytics,
semester-integrated calendar dates, student-facing faculty profiles, and bulk
admin operations/search/activity history. Validate role/tenant authorization,
workflow/API tests, accessibility checks for new controls, and seeded-data
acceptance scenarios.

## Explicitly Out of Scope

All checked audit items, the already-complete rate-limit-header category, the
already-complete deployment-documentation category, and any Java/.NET runtime
upgrade, Azure migration, container deployment, or source-code implementation
are out of scope. This deliverable is plan-only; no implementation or test
execution is performed.

## Open Questions & Questionnaire

- [ ] Confirm the staging host and approved scope for OWASP ZAP/Burp testing.
- [ ] Select the off-site backup provider and alert destination.
- [ ] Confirm the university's final logo, legal text, registrar details, and
  supported email/SMS channels before implementation.
- [ ] Confirm whether cookie consent is legally required for the deployment
  jurisdiction.
