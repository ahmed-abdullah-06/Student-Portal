# Disaster recovery plan

## Targets

- **RPO:** 24 hours for database data; payment provider events remain replayable from the provider dashboard.
- **RTO:** 4 hours for a complete single-host restoration.

## Recovery procedure

1. Provision a clean host with Docker, Compose, and the approved firewall rules.
2. Restore the latest verified PostgreSQL backup using `npm run restore --prefix backend -- <backup-file>`.
3. Restore the production environment file from the secrets manager; never copy it into source control.
4. Pull the exact application image identified by the release record.
5. Run `docker compose -f docker-compose.prod.yml up -d` and verify `/api/status`.
6. Replay payment webhooks that arrived after the backup and run `npm run reconcile --prefix backend`.
7. Run the UAT smoke checklist and record the recovery duration and data-loss window.

Perform and record a restore drill monthly. A backup is not considered valid until it has been restored and the health and UAT checks pass.

## Monthly restore-drill evidence template

Copy this section into the incident/runbook record for each drill:

- **Drill date / operator:**
- **Source backup:** filename, SHA-256, created-at, off-site object URI
- **Restore host / release image:**
- **Restore command:** `npm run restore --prefix backend -- <backup-file>`
- **Restore start/end (UTC):**
- **Health check:** `curl -fsS https://<host>/api/status` → HTTP ___
- **UAT checklist:** login, dashboard, read/write transaction, payment reconciliation
- **Observed RPO / RTO:** ___ / ___
- **Issues and remediation owner:** ___
- **Evidence links:** logs, screenshots, object-storage upload, reconciliation report
