# Handover & Admin Training

Target audience: university IT + registrar staff who will run the portal daily.
Two 90-minute sessions (admin-heavy, then faculty helpers). Everything below is
doable from the UI unless marked *(CLI)*.

## Session 1 — Administration essentials

1. **Portal chooser & sign-in** — the three role portals; why wrong-role logins
   are rejected; where the platform console sits (`/platform`, operator only).
2. **People** — onboard/edit students & faculty, activate/deactivate, reset
   passwords, permission toggles per admin account.
3. **Academics** — courses (+prerequisites), sections, faculty assignment,
   timetable builder (room conflicts show 409), semester lifecycle:
   registration dates → evaluation window → result freeze.
4. **Fees** — fee structures, bulk challan generation, manual reconciliation,
   approvals hub (installments, refunds, proofs), reports/exports.
5. **Daily rhythm demo** — approve 2 requests, publish 1 notice, check the audit
   feed; show where errors appear if something fails.

## Session 2 — Faculty & student support

1. **Faculty flow** — attendance register, marks entry, result freeze,
   assignments/quizzes + submission review.
2. **Student flow** — registration, attendance, results, challans/payments,
   requests & documents, complaints; course workspace incl. file uploads.
3. **Support playbook** — top 5 tickets (forgot password, challan not showing
   paid, wrong marks, attendance dispute, upload problems) and the exact admin
   screens to resolve each.
4. **Comms** — email templates (reset, welcome, receipt), when SMS sends (tenant
   feature flag), outbox location in dev *(CLI: `npm run test:email`)*.

## Handy CLI (give them these exactly)

```bash
cd backend
npm run check:prod                     # production readiness report
npm run backup                         # gzipped SQL backup → ../backups
npm run restore -- <file.sql.gz> --url postgresql://host/db --yes   # drills only
npm run reconcile                      # catch missed Stripe webhooks
npm run tenants -- create --slug <name> --name "<Campus Name>" --admin-email <email> --admin-password '<pw>'
```

## Ownership matrix (fill in with the university)

| Area | Responsible | Contact |
|---|---|---|
| Portal admin (day-to-day) | | |
| Database & backups | | |
| Payments/Stripe account | | |
| Email domain (SPF/DKIM) | | |
| Student data imports | | |
| Incident escalation | | |

## Day-1 quick reference

- Login problems → user list → reset password (temp password prompt forces change)
- Challan paid but still overdue → Approvals → Bank proofs, or Fees → reconcile
- Wrong marks → Faculty re-enters; if frozen, admin unfreezes for that section
- Emergency mass logout → rotate `JWT_SECRET` and restart *(CLI, see runbook §10)*
