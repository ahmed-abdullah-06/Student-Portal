# Novastra — University Campus Portal

A full-stack campus portal for the fictional **Novastra University** with **Student**, **Faculty**, and **Admin** modules, designed with the Inter font, a navy `#1e3a8a` + teal `#0f9d8a` palette, and a white sidebar/topbar shell.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 8 + Tailwind CSS 4 + React Router 7 + Axios + Lucide icons |
| Backend | Node.js + Express 5 + JWT (HTTP-only cookies) + bcrypt |
| Database | PostgreSQL 18 + Prisma ORM 7 (driver adapter `@prisma/adapter-pg`) |
| Design | Figma-matched tokens: Inter, navy/teal theme, subtle layered shadows, white shell |

## Quick Start

### 1. Database (one time)
```bash
createdb student_portal    # already created in this environment
```
Connection string lives in `backend/.env` (`DATABASE_URL`).

### 2. Backend
```bash
cd backend
npm install
npx prisma migrate dev     # apply schema
npx prisma generate        # regenerate client after schema changes
node prisma/seed.js        # seed demo data
node server.js             # http://localhost:5000
```
> After any schema change, always run `npx prisma generate` explicitly. Use plain `node server.js` (no nodemon).

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

## Demo Accounts

| Role | Email / Roll | Password |
|---|---|---|
| Platform operator | `platform@novastra.edu.pk` (console at `/platform`) | `platform123` |
| Admin | `admin@novastra.edu.pk` | `admin123` |
| Faculty | `ali.khan@novastra.edu.pk` | `faculty123` |
| Faculty | `sana.malik@novastra.edu.pk` | `faculty123` |
| Faculty | `usman.tariq@novastra.edu.pk` | `faculty123` |
| Student | `SP23-BSCS-001` (or email) | `student123` |
| Student | `SP23-BSCS-002` (or email) | `student123` |

Students: `SP23-BSCS-001` … `SP23-BSCS-010`. Login accepts email **or** roll number.

## Design System (Figma Match)

- **Font**: Inter (400/500/600/700)
- **Colors**: primary navy `#1e3a8a`, teal accent `#0f9d8a`, bg `#f3f4f6`, text `#172033`, muted `#697386`, border `#e4e7ec`
- **Status**: green `#11875d`, red `#d14545`, amber `#d18a17`
- **Layout**: fixed white topbar (70px desktop / 62px mobile) + white sidebar (250px) with student mini-profile, MAIN MENU / ACCOUNT section labels, active-state navy highlight + right indicator bar
- **UI kit**: `Card`, `PageHeader`, `StatCard`, `Badge`, `Alert`, `Spinner`, `Field`, `Modal`, `Tabs`, `EmptyState`, consistent button/table/input classes
- **Dark mode**: toggleable via `.dark` class on `<html>`, full override set in `index.css`

## Sign-in Portals

Opening the app lands on a 3D portal chooser at `/`. Each card opens a dedicated sign-in page — `/login/student`, `/login/faculty`, `/login/admin` — that only accepts accounts with that role. The restriction is enforced server-side: `POST /api/auth/login` accepts an optional `role` and returns **403** when the credentials belong to another role, so a portal cannot be bypassed from the client. The generic `/login` remains available for deep links and password-reset flows.

## Features

### Student
- Dashboard: welcome banner, stat cards, current courses table, today's classes, GPA trend SVG, notices
- **Course workspace** — click any course row to open per-course tabs (notices, attendance, marks summary, learning resources, assignments, quizzes, course info)
- Course registration (add/drop) with **credit-hour limits (21)**, **prerequisite checks**, **capacity limits** — two-column layout with live selection sidebar + confirmation modal
- Attendance tracker with **75% deficiency alerts**, per-lecture history, progress bars, detail modal
- Marks breakdown (Assignments 10% · Quizzes 10% · Midterms 20% · Final 60%) with **semester tabs** and SGPA/CGPA cards
- Transcript with **SGPA/CGPA** and a standard 4.0 grading scale (A=4.00 … F=0.00), downloadable **Transcript PDF** and **Domicile Certificate** (PDFKit)
- Fee challans with stat cards + challan history + **online card checkout** (demo: 4242 succeeds, 4000 0002 declines)
- Weekly timetable grid (color-coded course blocks)
- **Teacher evaluation** (star rating) — enforced by evaluation window; blocked when admin closes the window
- **Course withdraw** request (approve drops enrollment)
- **Complaints / Help Desk**
- **Date sheet & admit card** (midterm/final exam schedule per enrolled section)
- **Degree audit** (credits completed/in-progress/remaining vs 133, CGPA, academic standing, remaining course suggestions)
- **Requests & Services hub** — 7 tabs: result re-check, semester freeze, fee installments, fee refunds, scholarships (browse + apply), certificate requests, bank payment proof upload
- **Downloads** — real document repository with category filter + authenticated blob download
- **Profile** — editable bio-data (DOB, gender, blood group, guardian, emergency contact, matric/inter marks) with live completion %
- Library catalogue + issued books, hostel status, transport enrollment
- Notification bell, chat/messaging, dark mode toggle
- **Assignments & quizzes** — download task files, upload/replace submissions (PDF/image/CSV/Excel, 10 MB), see teacher comments and marks

### Faculty
- Assigned-sections dashboard with quick-link cards (attendance, marks, evaluations)
- Digital attendance register (P/A toggles, bulk save, re-mark same lecture)
- Marks entry per component with live grade computation
- **Result freeze/unlock**
- **Assignments & quizzes** — post tasks per section with description, dates, optional attachment; review student submissions, download files, assign marks and comments
- Anonymous evaluation analytics (bar charts) + written feedback

### Admin
- Dashboard stats + audit activity feed + system health panel
- Student/Faculty onboarding, edit modal, activate/deactivate, password reset
- Course registry + **prerequisite editor**
- Section creation, faculty assignment, **timetable builder with room conflict detection (409)**
- **Semester & exam management** — create terms (registration/evaluation/result/fee dates), schedule midterm/final exams per section, manage evaluation window (open/close)
- **Approvals hub** — 7 tabs with pending counts for re-checks, freezes, installments, refunds, scholarship applications, certificates (approve / mark issued / reject), bank payment proofs (verify auto-marks challan paid)
- **Scholarship management** — create opportunities with amount, eligibility, deadline
- **Document management** — multer file upload (PDF/PNG/JPEG, 10 MB) to shared repository, delete
- **Master data** — campuses, departments, programs CRUD
- **Reports** — CSV exports: attendance (per-enrollment % + 75% deficiency flag), fee defaulters (overdue unpaid), result gazette (per semester), enrollment (per section capacity vs enrolled)
- Fee structures, **bulk challan generation**, mark paid/unpaid reconciliation
- Notice publishing, library book management, hostel allocation, transport routes
- **Withdrawal request approval**, **complaint resolution**
- Immutable **audit log** (login, marks changes, freezes, withdrawals, password changes, profile updates, etc.)

### Auth & Account
- **Server-generated captcha** (JWT-signed, 10 min TTL) on login
- **Account lockout** after 5 failed attempts (15 min)
- **Change password** (validates current, forbids reuse, min 8 chars w/ upper+lower+digit)
- **Forgot / reset password** (DB-backed token, 1 h TTL, dev token returned in non-prod)

## Security
- bcrypt (12 rounds) password hashing
- JWT in **HTTP-only cookies** + Bearer fallback, 24 h expiry, **token-version revocation** (password change signs out every device)
- **Server-side sessions** (`UserSession`): list, revoke one, revoke all; last-seen tracking
- **Two-factor authentication (TOTP)** — RFC-6238, QR enrollment, password/TOTP-confirmed disable, login second step
- **Granular RBAC**: 18 permission strings (`students:write`, `reports:export`, …) with wildcard support, editable per user in the UI; ADMIN bypasses
- Role middleware: `STUDENT` / `FACULTY` / `ADMIN` route isolation
- Rate-limit tiers: global 600/15 min, auth 20/15 min, sensitive (reset/2FA) 30/h, uploads 60/h
- CSRF **Origin/Referer check** on cookie-authenticated mutations; helmet CSP/HSTS (prod), `X-Request-Id` correlation
- Server captcha + account lockout on repeated failures
- Password policy: min 8 chars, uppercase, lowercase, digit; reuse forbidden
- Password reset tokens: DB-backed, single-use, 1 h TTL
- File uploads: multer disk storage, 10 MB limit, MIME whitelist (PDF/PNG/JPEG/WebP/CSV/XLSX)
- Parameterized queries via Prisma (no raw SQL injection surface)
- Structured logs (pino, redacted) + centralized error handler + immutable audit ledger with IP logging
- Optional Sentry error telemetry (`SENTRY_DSN`), env validated with zod at boot
- Data retention purger (audit logs, chat, notifications, reset tokens, dead sessions) — UI + cron script

## Production & Operations

### Configuration
All settings come from environment variables (validated at boot; the app exits on invalid config). See `backend/src/config/env.js` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Token signing secret (min 32 chars) |
| `NODE_ENV` | `production` enables HSTS/CSP strictness |
| `TRUST_PROXY` | `1` behind nginx/load balancer (correct client IPs in audit logs) |
| `SMTP_HOST/PORT/USER/PASS`, `EMAIL_FROM` | Outbound email (nodemailer). Unset ⇒ messages written to `backend/logs/outbox/*.json` |
| `SMS_PROVIDER` | `twilio` \| `http` \| `none` |
| `S3_BUCKET/REGION/ACCESS_KEY_ID/SECRET_ACCESS_KEY/ENDPOINT` | Object storage; unset ⇒ local `backend/uploads` |
| `SENTRY_DSN` | Optional error reporting |
| `CLIENT_URL` | CORS origin |
| `TENANT_BASE_DOMAIN` | Optional. Enables subdomain-based tenant resolution |

### Admin UI surface
- **Settings** (`/admin/settings`): branding (name, colors, contacts — applied live site-wide), academic policy (max credit hours, attendance, weights), fees, feature flags, retention windows + **run cleanup now**
- **Security** (`/security`, all roles): active sessions with revoke/revoke-all, 2FA enrollment (QR + confirm) and disable
- **Users**: pagination + server search, CSV bulk import (template download, per-row skip report, default `Welcome123`), per-user permission editor
- **Audit logs**: pagination + CSV export

### Endpoints for ops
```
GET  /api/status              deep health (db/storage/email/memory) → 200/503
GET  /api/health              liveness
GET  /api/openapi.json        OpenAPI 3.1 spec (Swagger UI at /api/docs)
GET  /api/public/branding     unauthenticated branding for the login page
```

### Tests
```bash
cd backend
$env:DATABASE_URL_TEST='postgresql://postgres:123456@127.0.0.1:5432/student_portal_test'
npx prisma migrate deploy      # once, against the test DB
npm run test                   # vitest: 91 integration tests (auth, RBAC, sessions, 2FA login, settings, pagination, docs, multi-tenancy, platform, payments/Stripe webhooks, CSV importers, course workspace, task submissions, portal role gating)
```

### Docker
```bash
docker compose up --build      # db + backend (:5000) + frontend behind nginx (:8080)

# Production (single VM): images from GHCR, Caddy auto-TLS, no exposed app ports
cp .env.production.example .env   # fill DOMAIN/ACME_EMAIL/secrets
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec backend npm run bootstrap   # platform operator (no demo data)
```
`backend/Dockerfile` runs `prisma migrate deploy` on start; set `JWT_SECRET` (and optionally `POSTGRES_PASSWORD`) in the environment. Full deploy/backup/rollback guide: [docs/runbook.md](docs/runbook.md). CI publishing to GHCR + SSH deploy: `.github/workflows/deploy.yml`.

### Backup / load test / retention
```bash
npm run backup        # pg_dump custom format → backend/backups/  (BACKUP_KEEP=14 prunes by age)
npm run retention     # one-shot data-retention purge (safe with defaults)
npm run loadtest      # k6 smoke+load scenarios against a running server (BASE_URL env)
```

### CI
`.github/workflows/ci.yml` runs on push/PR: backend `npm ci → prisma generate → migrate deploy → vitest` against a `postgres:18` service, frontend `lint + build`.

## Multi-Tenancy

The backend can serve multiple universities from one deployment. Each request is
scoped to a tenant via the `X-Tenant` header (tenant id/slug) or a subdomain
(`TENANT_BASE_DOMAIN`), falling back to the built-in `default` tenant for
single-tenant installs. Users, sessions, settings, branding and all domain data
(students, courses, fees, library, hostel, …) are isolated per tenant, JWT
tokens are bound to the tenant they were issued for (`tid` claim), and a Prisma
client extension enforces tenant scoping centrally. See
[docs/multi-tenancy.md](docs/multi-tenancy.md).

Provision a new university (creates the tenant, its first admin, and baseline
branding):

```bash
cd backend
npm run tenants -- create --slug novastra-north --name "Novastra University North Campus" \
  --admin-email admin@novastra.edu.pk --admin-password '<password>' [--domain novastra.edu.pk]
npm run tenants -- list
npm run tenants -- status novastra-north SUSPENDED   # or ACTIVE
```

The frontend detects the tenant from `?tenant=<slug>` (persisted for dev/testing,
switchable from the login page) or from a subdomain of `VITE_TENANT_BASE_DOMAIN`
and sends `X-Tenant` on every API call; branding, features, and all data follow
the tenant.

Operators can also manage everything from the **platform console** at
`/platform` (separate platform-operator login): platform stats, tenant creation,
suspend/activate, and plan & quota management. Plans (`starter` 500 students /
`standard` 5 000 / `enterprise` unlimited, with per-tenant overrides) are
enforced on student/faculty creation and CSV import (`403 PLAN_LIMIT_REACHED`).

## Fee Payments

Students pay challans online. With `PAYMENT_PROVIDER=simulated` (default) an
in-built demo gateway settles immediately; with `PAYMENT_PROVIDER=stripe` the
student is redirected to Stripe Checkout and the challan is marked paid by a
signed webhook (`/api/payments/webhook/stripe`, tenant taken from the signed
session metadata). A reconciliation job (`npm run reconcile` or
`POST /api/payments/reconcile`) settles payments whose webhooks were missed.
Payment receipts go out by email (and SMS when the tenant enables it).

## Data Migration

Admins import CSV data from **Data Import** (`/admin/import`): faculty, the
course catalog, historical semester records (transcript GPAs) and historical
course grades. Every importer supports `?dryRun=1` (full validation + conflict
report, no writes) and is idempotent — reruns update instead of duplicating.

## Operations Docs

- [docs/runbook.md](docs/runbook.md) — deploy, backups & restore drill, rollback, incidents, go-live checklist
- [docs/uat.md](docs/uat.md) — pilot UAT checklist (admin/faculty/student scenarios + sign-off)
- [docs/data-import.md](docs/data-import.md) — real-data CSV formats and import order of operations
- [docs/handover.md](docs/handover.md) — admin training agenda, CLI cheat sheet, ownership matrix
- [docs/security.md](docs/security.md) — implemented controls + pen-test prep pack
- [docs/performance.md](docs/performance.md) — measured load-test baseline and interpretation
- [docs/multi-tenancy.md](docs/multi-tenancy.md) — tenant model, provisioning, platform admin

## API Overview
```
POST /api/auth/login (optional `role` portal) | logout     GET /api/auth/me | captcha
POST /api/auth/change-password | forgot-password | reset-password
GET/DELETE /api/auth/sessions (+ /revoke-all), POST /api/auth/2fa/enable | confirm | disable
/api/platform/*   login, me, stats, tenants (list/create), tenants/:id (PATCH)
                  — operator token, tenant-agnostic
/api/settings (GET, PUT /:section)   GET /api/public/branding
POST /api/admin/students/import      PUT /api/admin/users/:id/permissions
POST /api/admin/import/faculty | courses | semester-records | historical-grades  (?dryRun=1)
GET  /api/admin/permission-catalog   GET/POST /api/admin/retention/preview | run
GET  /api/admin/audit-logs/export (CSV)
/api/student/*    profile (GET/PUT), courses (+ /:id workspace),
                  tasks/:id/download | submit, registration, attendance,
                  marks, transcript, challans (+ /:id/pdf), timetable,
                  notices, evaluations, certificates/:type,
                  date-sheet, admit-card, eval-window, degree-audit,
                  rechecks, freezes, installments, refunds,
                  scholarships (+ /my, /:id/apply),
                  cert-requests, bank-proofs
/api/faculty/*    sections, roster, attendance, marks, freeze, evaluations,
                  sections/:id/tasks, tasks/:id/download,
                  submissions/:id (PATCH marks/comment, /download)
/api/admin/*      stats, students, faculty, users, courses, sections,
                  timetable, fee-structures, challans, notices, audit-logs,
                  withdrawals, complaints,
                  semesters, exams, eval-window,
                  rechecks, freezes, installments, refunds,
                  scholarship-apps, scholarships (create/list),
                  cert-requests, bank-proofs,
                  campuses, departments, programs,
                  reports/attendance | fee-defaulters | result-gazette | enrollment (CSV)
/api/documents    GET list, GET /:id/download, POST upload (admin), DELETE (admin)
/api/withdrawals  GET list mine, POST create
/api/complaints   GET list mine, POST create
/api/notifications, /api/chat, /api/library, /api/hostel,
/api/transport, /api/payments (+ POST /reconcile, webhook /webhook/stripe)
GET  /api/health | /api/status | /api/metrics (bearer METRICS_TOKEN)
```

## Project Structure
```
├── backend/
│   ├── prisma/            schema.prisma, seed.js, migrations/
│   ├── generated/prisma/  Prisma client output
│   ├── scripts/           tenants.js (CLI), bootstrap.js (prod init),
│   │                      reconcile-payments.js (cron), backup.js, revert-pass.js
│   ├── uploads/           uploaded documents (bank proofs, files)
│   ├── src/
│   │   ├── config/        db.js (tenant-scoping client), env.js (zod)
│   │   ├── controllers/   auth, student, faculty, admin, withdraw,
│   │   │                  complaint, chat, library, hostel, transport,
│   │   │                  notification, payment, document, semester,
│   │   │                  request, profile, masterData
│   │   ├── middlewares/   auth, role, error, validate (zod), upload (multer),
│   │   │                  rateLimit, metrics, tenant, permissions
│   │   ├── platform/      platform-operator API (console backend)
│   │   ├── routes/        auth, student, faculty, admin, payment, ...
│   │   ├── services/      email, sms, notify, settings, storage,
│   │   │                  importers (CSV), payments/ (Stripe + simulated)
│   │   ├── tenancy/       context (ALS), resolve, provision, plans/quotas
│   │   └── utils/         gpaCalculator, pdfGenerator, certificateGenerator, logger
│   ├── prisma7.config.ts
│   └── server.js
├── Figma Design/          reference design (src/App.tsx, src/index.css)
└── frontend/
    └── src/
        ├── components/    ui/UI.jsx (kit), shared/ (Sidebar, Navbar, Logo)
        ├── context/       AuthContext
        ├── layouts/       DashboardLayout
        ├── pages/         Login, auth/ (ForgotPassword, ResetPassword),
        │                  student/ (incl. DateSheet, DegreeAudit, Requests),
        │                  faculty/,
        │                  admin/ (incl. SemesterManagement, AdminApprovals,
        │                          ScholarshipManagement, DocumentManagement,
        │                          MasterData, DataImport, Reports),
        │                  shared/ (Messages, ChangePassword)
        └── services/      api.js (axios)
```

## Lint
```bash
cd frontend
npm run lint    # oxlint — 0 errors target
npm run build   # vite build — must succeed
```
