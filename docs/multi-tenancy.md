# Multi-Tenancy

The portal supports serving multiple universities (tenants) from one deployment,
with identity, configuration, and all domain data isolated per tenant. This
document describes the implemented model and its enforcement.

## Model

**Row-level tenancy.** Every tenant-scoped table carries a `tenantId` column that
references `Tenant.id`. This is the pragmatic choice for a B2B SaaS: one database,
one migration history, cheap to operate, and easy to make per-tenant backups from.
Database-per-tenant is deliberately *not* used.

```
Tenant (id, slug, name, status, plan, domain)
  ├── User      (tenantId, email)  @@unique([tenantId, email])
  ├── Setting   (tenantId, key)    @@id([tenantId, key])
  └── …39 domain models, each with `tenantId` + `@@index([tenantId])`
```

The default tenant has the fixed id `"default"` so existing single-tenant installs
keep working unchanged.

## How a request is scoped

1. **`tenantResolver`** (`src/middlewares/tenant.js`) runs early in the chain
   (after `requestContext`, before all routes). It determines the tenant key:
   1. `X-Tenant` header — tenant **id or slug** (explicit; used by APIs/integrations)
   2. subdomain of `TENANT_BASE_DOMAIN` — e.g. `novastra.portal.example.com`
   3. the `default` tenant — single-tenant / local installs
2. The tenant is loaded (60s in-memory cache) and rejected if missing (`404`) or not
   `ACTIVE` (`403`). The record is attached as `req.tenant`.
3. The rest of the request runs inside that tenant's **AsyncLocalStorage** context
   (`src/tenancy/context.js`). Any service can call `getTenantId()` / `getTenant()`
   without threading it through function arguments.
4. On login the JWT is stamped with `tid` (tenant id). `authMiddleware` rejects a
   token whose `tid` does not match the resolved request tenant, and rejects users
   whose own `tenantId` differs.

### Provisioning a tenant

`src/tenancy/provision.js` creates the tenant, its first admin account, and
baseline branding in one step. Use the CLI (recommended):

```bash
cd backend
npm run tenants -- create --slug novastra-north --name "Novastra University North Campus" \
  --admin-email admin@vehari.edu.pk --admin-password '<password>' \
  [--domain vehari.edu.pk] [--must-change-password]
npm run tenants -- list
npm run tenants -- status novastra-north SUSPENDED   # or ACTIVE
```

Rules enforced by provisioning:

- slug: 2–40 chars, lowercase letters/digits/hyphens; reserved slugs (`www`,
  `api`, `admin`, …) refused; duplicate slug/domain refused
- admin password: minimum 8 characters
- branding derived from the tenant name (`CU Online` style initials, support
  email from the domain); everything else falls back to platform defaults
- all-or-nothing: if admin/branding creation fails, the tenant row is removed

Programmatic use (e.g. a future platform-admin API):

```js
const { createTenant } = require('./src/tenancy/provision');
await createTenant({ slug, name, domain, adminEmail, adminPassword });
```

Clients then send `X-Tenant: novastra-north` (or use its subdomain) on every
request.

## What is tenant-scoped today

| Area | Status |
|---|---|
| Tenant registry | ✅ `Tenant` model + migration + default tenant |
| Users / login / JWT | ✅ isolated — same email can exist in two tenants |
| Sessions | ✅ inherited (sessions belong to tenant-scoped users) |
| Settings / branding | ✅ per-tenant (`Setting` composite PK), per-tenant cache |
| All 39 domain models | ✅ `tenantId` column + relation + index + per-tenant unique keys |
| Enforcement | ✅ central Prisma client extension (`src/config/db.js`) |

### Domain models (Phase 2)

All domain models (`Student`, `Faculty`, `Course`, `Section`, `TimetableSlot`,
`Enrollment`, `AttendanceRecord`, `FeeStructure`, `FeeChallan`, `SemesterRecord`,
`TeacherEvaluation`, `Notice`, `AuditLog`, `Notification`, `ChatMessage`,
`LibraryBook`, `LibraryIssue`, `HostelAllocation`, `TransportRoute`,
`TransportAllocation`, `Payment`, `CourseWithdrawal`, `Complaint`, `Document`,
`Semester`, `ExamSchedule`, `ResultRecheck`, `SemesterFreeze`,
`InstallmentRequest`, `FeeRefundRequest`, `Scholarship`,
`ScholarshipApplication`, `CertificateRequest`, `BankPaymentProof`,
`CourseMaterial`, `Campus`, `Department`, `Program`, `EvaluationWindow`) carry
`tenantId` and were migrated in `20261019090000_tenancy_domain_models`.

Natural keys became composite to allow the same value (e.g. roll number, course
code, ISBN) in different tenants: `@@unique([tenantId, rollNumber])`,
`@@unique([tenantId, courseCode])`, `@@unique([tenantId, semester])`, and so on.

**Not scoped by design:** `UserSession`, `PasswordResetToken`, `NotificationRead`.
These already resolve through tenant-scoped parents (`User` / `Notification`), so
a cross-tenant ID mismatch is impossible without a token that also fails the
`tid` check.

## Central enforcement (Prisma extension)

`src/config/db.js` exports a Prisma client extended with a `tenant-scope`
query hook. Behavior:

- Models that have a `tenantId` field are detected from the Prisma DMMF at
  startup (`TENANT_MODELS`); `Tenant` itself is excluded.
- When a tenant is active (AsyncLocalStorage), the extension injects
  `tenantId` into:
  - `create` / `createMany` — forced into `data` (context wins over body input)
  - `findMany`, `findFirst`, `findFirstOrThrow`, `count`, `aggregate`,
    `groupBy`, `updateMany`, `deleteMany` — merged into `where`
  - `findUnique`, `findUniqueOrThrow`, `update`, `delete` — added to `where`
    when an `id` is present or the compound key carries `tenantId`, making
    cross-tenant access fail as `P2025` (surfaced as `404` by controllers)
- With **no** tenant context (CLI scripts, seeds, migrations, tests, retention
  jobs), operations run unscoped — an explicit privileged mode.
- `upsert` is scoped on the unique key and the `create` branch.

### Call-site rule for natural keys

Because keys like `rollNumber` are no longer globally unique, code must use
`findFirst({ where: { rollNumber, ... } })` (the extension adds the tenant), or
compound key syntax when a unique op is required:

```js
prisma.student.findUnique({ where: { tenantId_rollNumber: { tenantId, rollNumber } } })
```

The schema's unique names to use: `tenantId_rollNumber`, `tenantId_employeeId`,
`tenantId_courseCode`, `tenantId_isbn`, `tenantId_semester`,
`tenantId_voucherId`, `tenantId_reference`, `tenantId_name`, `tenantId_code`,
`tenantId_email`, `tenantId_semester_year`, `tenantId_name_degreeLevel`.

## Frontend tenant awareness

`frontend/src/services/tenant.js` resolves the active tenant in the browser:

1. `?tenant=<slug>` query param — persisted to `localStorage`, used for
   dev/testing and by the "Change" control on the login page
2. subdomain of `VITE_TENANT_BASE_DOMAIN` — production
3. previously selected tenant (`localStorage`)
4. otherwise the default tenant (no header sent)

`frontend/src/services/api.js` attaches `X-Tenant` to every request. Switching
tenants clears the stored token/user (tokens are tenant-bound) and returns to
`/login`. The login page shows the active university and surfaces a clear
message for unknown (404) or suspended (403) tenants.

## Platform administration

SaaS operators manage tenants through a platform-level identity that is fully
separate from tenant users (`PlatformAdmin` model, `platform_admins` table).

- **Auth boundary** — `POST /api/platform/login` issues a JWT with
  `scope: 'platform'`. Tenant endpoints reject platform tokens and platform
  endpoints reject tenant tokens, so the two trust domains never mix.
- **Mount order** — `/api/platform` routes are mounted **before** the tenant
  resolver, so they run without tenant context: queries are unscoped by design
  (the privileged mode) and can span all tenants.
- **Endpoints**

```
POST  /api/platform/login      operator login (rate-limited)
GET   /api/platform/me         current operator
GET   /api/platform/stats      platform-wide counts + plan catalog
GET   /api/platform/tenants    list w/ usage + effective limits (search, paging)
POST  /api/platform/tenants    provision a university (reuses createTenant)
PATCH /api/platform/tenants/:id  status | plan | maxStudents | maxFaculty | name | domain
```

- **Console UI** — `frontend/src/pages/platform/PlatformConsole.jsx` at
  `/platform`: login, stats, searchable tenant table, create-university modal,
  suspend/activate, and a plan & limits editor. It uses a separate token
  (`platformToken` in localStorage) and never sends `X-Tenant`.
- **Seeded operator** — `platform@novastra.edu.pk` / `platform123`
  (change it in any real deployment).

## Plans and quotas

`src/tenancy/plans.js` defines the catalog and enforcement:

| Plan | Max students | Max faculty |
|---|---|---|
| `starter` | 500 | 50 |
| `standard` (default) | 5 000 | 500 |
| `enterprise` | unlimited | unlimited |

`Tenant.maxStudents` / `Tenant.maxFaculty` override the plan per tenant (custom
deals); `null` means "use plan default", and a `null` plan limit means unlimited.

`enforceQuota('students' | 'faculty')` middleware runs on student/faculty
creation and CSV import. When a tenant is at its limit the API returns `403`
with `code: 'PLAN_LIMIT_REACHED'` and the current usage, e.g.:

```json
{ "message": "Plan limit reached: your Standard plan allows up to 0 students. ...",
  "code": "PLAN_LIMIT_REACHED", "resource": "students", "limit": 0, "current": 0, "plan": "standard" }
```

Quota changes take effect immediately (the tenant cache is invalidated on
platform updates).

## Configuration

| Env var | Purpose |
|---|---|
| `TENANT_BASE_DOMAIN` (backend) | Optional. Enables subdomain resolution (e.g. `portal.example.com`). |
| `VITE_TENANT_BASE_DOMAIN` (frontend) | Optional. Same value as backend; enables subdomain detection in the browser. |
| `X-Tenant` header | Per-request tenant id or slug (no configuration required). |

## Security notes

- A valid token is **not** portable across tenants (`tid` + `user.tenantId` checks).
- Unknown/inactive tenants are rejected before any handler runs.
- The public branding endpoint (`/api/public/branding`) is tenant-aware, so the
  login page is branded correctly before authentication.
- Switching tenants on the client clears the auth session; suspended tenants are
  blocked at resolution for every request, including branding.
- `TENANT_BASE_DOMAIN` / `VITE_TENANT_BASE_DOMAIN` should be set in production if
  you rely on subdomains; otherwise clients must send `X-Tenant` (the frontend
  does this automatically after `?tenant=` is used once).

## External callbacks (payment webhooks)

Payment providers cannot send tenant headers. The Stripe webhook route
(`/api/payments/webhook/stripe`) is therefore mounted **before** tenant
resolution, like the platform routes. The signature is verified against the raw
body, and the tenant travels inside the signed Checkout Session metadata
(`metadata.tenantId`). Settlement then re-enters the correct tenant context
with `runWithTenant(...)`, so Prisma scoping, audit logs and notifications land
in the right university. A webhook for an unknown tenant/payment is acknowledged
and ignored (idempotent), never applied to the default tenant.

## Production bootstrap

`npm run bootstrap` creates the default tenant and the platform operator
account **without** demo data (unlike `prisma/seed.js`, which is for
development). It reads `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` and
generates a strong password when none is given. Onboard each additional
university afterwards via `scripts/tenants.js create` or the `/platform`
console.
