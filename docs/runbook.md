# Operations Runbook

Single-VM production deployment for one university (or many, via tenants).

```
Internet ──► Caddy (80/443, auto-TLS) ──► frontend (nginx SPA)
                    │
                    └──► backend (Express :5000) ──► Postgres 18
```

Everything runs under Docker Compose. Images are built by CI
(`.github/workflows/deploy.yml`) and published to GHCR; the server pulls them.
Caddy obtains and renews Let's Encrypt certificates automatically.

---

## 1. Server prerequisites

- Ubuntu 22.04/24.04 VM, 2 vCPU / 4 GB RAM / 40 GB disk minimum
- Docker Engine + Compose plugin **v2.24 or newer** (`docker compose version`)
- DNS: `A` record for your domain (e.g. `portal.university.edu`) → server IP
- Firewall: allow 22 (SSH), 80, 443 only

```bash
curl -fsSL https://get.docker.com | sh
sudo ufw allow 22,80,443/tcp && sudo ufw enable
```

## 2. First deploy

```bash
sudo mkdir -p /opt/student-portal && sudo chown $USER /opt/student-portal
git clone <repo-url> /opt/student-portal
cd /opt/student-portal

cp .env.production.example .env
nano .env          # fill DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, JWT_SECRET (openssl rand -base64 48)

# Build locally for the first deploy (later deploys pull CI images)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Bootstrap the platform operator + default tenant (no demo data)
docker compose exec backend npm run bootstrap
# → prints the platform operator email; store the generated password

# Health check
curl -fsS https://$DOMAIN/api/health
```

Create the university tenant + first admin either from the platform console
(`https://$DOMAIN/platform`) or the CLI:

```bash
docker compose exec backend node scripts/tenants.js create \
  --slug novastra --name "Novastra University" \
  --domain novastra.edu.pk --admin-email admin@novastra.edu.pk --admin-password '<strong>'
```

## 3. CI deploys (GHCR + SSH)

Configure these GitHub repository secrets once:

| Secret          | Purpose                                        |
|-----------------|------------------------------------------------|
| `DEPLOY_HOST`   | server IP / hostname                           |
| `DEPLOY_USER`   | SSH user (e.g. `deploy`)                       |
| `DEPLOY_KEY`    | SSH private key (no passphrase)                |
| `DEPLOY_PATH`   | `/opt/student-portal`                          |
| `GHCR_TOKEN`    | PAT with `read:packages` (server docker login) |

Deploy a release: `git tag v1.2.3 && git push --tags` (or run the workflow
manually). The workflow builds SHA-tagged images, writes `deploy/.env.images`,
pulls and restarts the stack. Migrations run automatically on backend start
(`prisma migrate deploy` in the container command).

## 4. Upgrades & rollback

- **Upgrade**: tag/redeploy as above. Compose recreates containers; Caddy keeps
  serving during the ~2–5 s backend restart (existing connections drain).
- **Rollback**: point images at the previous SHA and restart:

```bash
printf 'BACKEND_IMAGE=%s\nFRONTEND_IMAGE=%s\n' \
  ghcr.io/<org>/<repo>/backend:<old-sha> \
  ghcr.io/<org>/<repo>/frontend:<old-sha> > deploy/.env.images
docker compose --env-file deploy/.env.images -f docker-compose.yml -f docker-compose.prod.yml up -d
```

- **Migrations**: forward-only. Take a backup before every deploy that ships a
  migration (see below). A rollback of code does not undo a migration.

## 5. Backups & restore drill

Nightly logical backup (runs on the host, dumps from the db container):

```bash
# /etc/cron.d/portal-backup
0 2 * * * root cd /opt/student-portal && docker compose exec -T db \
  pg_dump -U postgres -Fc student_portal > backups/portal-$(date +\%F).dump \
  && find backups -name 'portal-*.dump' -mtime +30 -delete
```

Restore drill (do this once before go-live, and quarterly):

```bash
# 1. Create scratch DB and restore
docker compose exec -T db createdb -U postgres restore_check
docker compose exec -T db pg_restore -U postgres -d restore_check --no-owner < backups/portal-YYYY-MM-DD.dump

# 2. Sanity-check row counts
docker compose exec db psql -U postgres -d restore_check -c \
  'SELECT (SELECT count(*) FROM users) users, (SELECT count(*) FROM students) students, (SELECT count(*) FROM fee_challans) challans;'

# 3. Drop scratch DB
docker compose exec -T db dropdb -U postgres restore_check
```

Full restore: stop backend, `pg_restore` into `student_portal`, start backend.

**Alternative (non-Docker installs / laptops):** the repo ships matching scripts
that use local `pg_dump`/`psql` (auto-detected under `Program Files/PostgreSQL`
on Windows):

```bash
cd backend
npm run backup                    # → ../backups/student_portal_<ts>.sql.gz (keeps 14, --keep N)
npm run restore -- ../backups/student_portal_<ts>.sql.gz --url postgresql://host/db --yes
```

`restore` intentionally refuses to read the target from `.env` — you must pass
`--url` explicitly, so a drill can never overwrite the live database by accident.
Run the drill into a scratch database (`createdb restore_check`) and drop it after.

## 6. Payments (Stripe)

1. In the Stripe dashboard create a **webhook endpoint**:
   `https://<domain>/api/payments/webhook/stripe` with events
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`.
2. Put `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` in `.env`, set
   `PAYMENT_PROVIDER=stripe`, restart backend.
3. Test with card `4242 4242 4242 4242` (any future expiry/CVC) in test mode.
4. Reconciliation safety net (catches webhooks lost during downtime):

```bash
# /etc/cron.d/portal-reconcile
*/30 * * * * root cd /opt/student-portal && docker compose exec -T backend \
  node scripts/reconcile-payments.js >> /var/log/portal-reconcile.log 2>&1
```

Admins can also trigger it from the UI/API: `POST /api/payments/reconcile`.

## 7. Email & SMS

- **Email**: set `SMTP_*` in `.env`. Without SMTP the API writes to
  `backend/logs/outbox/` (dev only). Verify delivery with
  `cd backend && npm run test:email you@example.com` (prints `SENT` or the
  dev-outbox path), then request a password reset end-to-end.
- **SMS**: set `SMS_PROVIDER=twilio` (+`SMS_ACCOUNT_SID`, `SMS_AUTH_TOKEN`,
  `SMS_FROM`) or `SMS_PROVIDER=http` (+`SMS_HTTP_URL` with `{to}`/`{text}`
  placeholders). SMS only sends when the tenant enables it in
  **Settings → Features → SMS notifications**.

## 8. Monitoring & logs

- `GET /api/health` — liveness; `GET /api/status` — deep checks (db, storage,
  email mode, payment provider).
- `GET /api/metrics` — Prometheus metrics (requires `METRICS_TOKEN`; send
  `Authorization: Bearer <token>`).
- Structured JSON logs on stdout: `docker compose logs -f backend`.
- Caddy access logs: `/data/access.log` inside the caddy volume.
- Optional: set `SENTRY_DSN` for error tracking.

Suggested free monitoring: Uptime Kuma against `/api/health`, plus a
Prometheus/Grafana pair scraping `/api/metrics` (alert rules:
`deploy/alerts.yml`).

## 9. Tenant subdomains (optional)

Subdomain-based tenant routing (`novastra.portal.university.edu`) needs a
**wildcard certificate**, which requires the DNS-01 challenge. Run Caddy with a
DNS plugin:

1. Build a custom Caddy image with e.g. `caddy-dns/cloudflare`.
2. Set `CLOUDFLARE_API_TOKEN` and extend `deploy/Caddyfile`:

```
*.{$DOMAIN} {
    tls {
        dns cloudflare {$CLOUDFLARE_API_TOKEN}
    }
    import common_site
}
```

Until then: tenants are selected via `X-Tenant` header, the login-page
university switcher, or `?tenant=<slug>` query (persisted in the browser).

## 10. Incident quick reference

| Symptom | Check |
|---|---|
| 502 from Caddy | `docker compose ps`, `docker compose logs backend` |
| Login fails after deploy | `docker compose logs backend` for migration errors; check JWT_SECRET unchanged |
| Payments not settling | Stripe dashboard → webhooks (delivery log); run `npm run reconcile`; check `STRIPE_WEBHOOK_SECRET` |
| Emails not delivered | `docker compose logs backend | grep email_`; verify SMTP creds; check spam/DNS (SPF/DKIM) |
| Disk full | prune old backups/images: `docker system prune -a`, review `/var/log` |
| Suspected key leak | Rotate `JWT_SECRET` (logs everyone out), rotate `POSTGRES_PASSWORD` (update `.env` + `ALTER USER`), rotate Stripe/SMTP tokens |

## 11. Go-live checklist

Run `cd backend && npm run check:prod` first — it prints PASS/WARN/FAIL for every
item below and exits non-zero on failures.

- [ ] `npm run check:prod` has zero FAILs
- [ ] `JWT_SECRET`, `POSTGRES_PASSWORD`, `METRICS_TOKEN` are unique and strong
- [ ] Demo accounts removed; platform operator password rotated
- [ ] Stripe live keys set + webhook verified with a real small payment
- [ ] SMTP verified (SPF/DKIM records for sending domain) + `npm run test:email` sends
- [ ] Nightly backup cron installed + one successful restore drill
- [ ] Monitoring/uptime alerts configured
- [ ] UAT signed off (docs/uat.md) and admin training done (docs/handover.md)
- [ ] `npm audit` clean in CI; pen-test findings triaged (docs/security.md)
