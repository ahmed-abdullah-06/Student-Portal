# Novastra Go-live checklist

Run this checklist against the production environment and attach the completed copy to the release record.

- [ ] DNS points to the production host and health checks pass.
- [ ] Caddy serves the configured domain with a valid TLS certificate.
- [ ] `JWT_SECRET` and `POSTGRES_PASSWORD` are generated with `openssl rand -hex 32`.
- [ ] Production environment validation passes (`npm run check:prod --prefix backend`).
- [ ] Database migrations and the bootstrap command complete successfully.
- [ ] The first tenant and an administrator account are created.
- [ ] Student, faculty, and administrator sign-in and role isolation are verified.
- [ ] SMTP test email and password reset delivery are verified.
- [ ] Backup and retention timers are installed and a backup artifact is present off-host.
- [ ] Prometheus metrics and alert notifications are reachable.
- [ ] Firewall exposes only 80/443 (and SSH from the approved administration network).
- [ ] The initial data import is validated against row counts and sample records.
- [ ] UAT evidence is signed off by the university owner.

Record release version, migration identifier, operator, date, and any exceptions below.
