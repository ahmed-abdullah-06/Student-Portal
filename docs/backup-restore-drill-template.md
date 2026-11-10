# Monthly Database Restore Drill

Use this record for a monthly restore exercise. Do not run a restore against
the production database.

## Prerequisites

- An approved scratch PostgreSQL instance and database owner credentials.
- A recent backup object from the configured off-site provider.
- `pg_restore`/`psql` client tools matching the PostgreSQL major version.
- A named operator and reviewer, with the drill window approved by operations.
- Production values for `STORAGE_DRIVER=s3`, `S3_BUCKET`, and (if applicable)
  `S3_ENDPOINT`; credentials must be supplied through the secret manager.

## Evidence record

- Drill date/time (UTC):
- Operator / reviewer:
- Backup object key and SHA-256:
- Scratch database identifier:
- Restore command and client version:
- Schema migration/version check:
- Sample row/count checks:
- Application smoke checks:
- Duration:
- Result: `pass` / `fail`
- Failure and remediation ticket:
- Evidence links (logs/screenshots, with secrets removed):

## Acceptance criteria

1. The selected backup can be retrieved without production credentials on a
   developer workstation.
2. Restore completes in the approved scratch database.
3. Schema, tenant boundaries, and representative counts match the source
   evidence.
4. A read-only application smoke test succeeds against the restored database.
5. The operator records recovery time and any remediation ticket.
