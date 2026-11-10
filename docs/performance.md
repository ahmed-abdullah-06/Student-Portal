# Performance Baseline

Measured 2026-10-19 with [autocannon](https://github.com/mcollina/autocannon)
(25 concurrent connections, 10 s per scenario, pipelined 10 on public routes).

**Environment:** Windows development machine, Node 22, Postgres 18 (localhost),
backend in production mode via `node server.js`. Production on a Linux VM
should be equal or faster; treat these as conservative reference numbers.

| Scenario | Endpoint | Avg req/s | p50 | p99 | Requests |
|---|---|---:|---:|---:|---:|
| Liveness (no DB) | `GET /api/health` | 1,842 | 128 ms | 274 ms | 19k |
| Public branding (cached settings + tenant resolution) | `GET /api/public/branding` | 2,022 | 103 ms | 830 ms | 20k |
| Authenticated dashboard aggregate (9 DB queries) | `GET /api/admin/stats` | 111 | 208 ms | 461 ms | 1k |

Note: health/branding latencies include Windows loopback + connection setup
overhead; the DB-heavy `/api/admin/stats` number (111 req/s at 25 concurrent
connections) is the meaningful capacity signal.

## Interpretation for a single university

- Peak concurrency for a university portal of 5–10k users is typically
  100–300 simultaneous sessions; even the heaviest endpoint (admin dashboard)
  has an order-of-magnitude headroom on a 2 vCPU VM.
- Student-facing DB-bound pages (marks, attendance, timetable) are lighter than
  `/api/admin/stats` and cached settings/branding queries are effectively free.
- Saturation points: Postgres connection pool and single backend replica.
  First scaling step is a bigger VM (4 vCPU/8 GB), second is a second backend
  replica behind Caddy (`reverse_proxy backend:5000 backend2:5000`).

## Reproduce

```bash
# Raise the rate limiter for the duration of a load test
RATE_LIMIT_API_MAX=1000000 node server.js

npx autocannon -c 25 -d 10 -p 10 http://127.0.0.1:5000/api/health
npx autocannon -c 25 -d 10 -p 10 http://127.0.0.1:5000/api/public/branding

TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@novastra.edu.pk","password":"admin123"}' | jq -r .token)
npx autocannon -c 25 -d 10 -H "Authorization=Bearer $TOKEN" http://127.0.0.1:5000/api/admin/stats
```

For staging, the k6 script in `backend/loadtest/k6.js` covers login and page
flows; run it against a staging URL before go-live:

```bash
k6 run -e BASE_URL=https://staging.university.edu backend/loadtest/k6.js
```
