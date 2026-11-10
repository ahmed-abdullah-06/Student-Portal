# Production upgrade procedure

1. Review the release notes, dependency audit, migration SQL, and rollback plan.
2. Take and verify a database backup.
3. Apply Prisma migrations in a maintenance window with `npx prisma migrate deploy`.
4. Deploy the application image using the immutable release tag.
5. Verify `/api/status`, authentication, one read flow, one write flow, payments, and WebSocket connection.
6. Monitor error rate, latency, database connections, and queue/email delivery for at least 30 minutes.
7. Roll back the application image if needed. Roll back a schema only with a reviewed compensating migration; never edit migration history.

Record the release tag, migration names, operator, start/end times, checks, and rollback decision.
