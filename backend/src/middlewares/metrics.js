const crypto = require('crypto');

/**
 * Lightweight Prometheus metrics, no external dependency.
 *
 * - `metricsMiddleware` records request counters + durations by route group
 *   (first path segment after /api) to keep label cardinality low.
 * - `metricsHandler` renders the text exposition format on scrape, including
 *   process memory/uptime and a database reachability gauge.
 * - `metricsGuard` requires `Authorization: Bearer $METRICS_TOKEN`; the
 *   endpoint is hidden (404) when METRICS_TOKEN is not configured.
 */

const startedAt = Date.now();
const counters = new Map(); // "METHOD|2xx|/api/auth" -> count
const durations = new Map(); // "/api/auth" -> { sum, count }

function routeGroup(path) {
  const m = String(path || '/').match(/^\/api\/([^/]+)/);
  return m ? `/api/${m[1]}` : 'static';
}

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const group = routeGroup(req.path);
    const key = `${req.method}|${Math.floor(res.statusCode / 100)}xx|${group}`;
    counters.set(key, (counters.get(key) || 0) + 1);
    const d = durations.get(group) || { sum: 0, count: 0 };
    d.sum += seconds;
    d.count += 1;
    durations.set(group, d);
  });
  next();
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function metricsGuard(req, res, next) {
  const token = process.env.METRICS_TOKEN;
  if (!token) return res.status(404).json({ message: 'Not found' });
  const header = req.headers.authorization || '';
  if (!safeEqual(header, `Bearer ${token}`)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  return next();
}

async function metricsHandler(req, res) {
  const lines = [];
  lines.push('# HELP http_requests_total HTTP requests by method, status class and route group');
  lines.push('# TYPE http_requests_total counter');
  for (const [key, count] of counters) {
    const [method, status, group] = key.split('|');
    lines.push(`http_requests_total{method="${method}",status="${status}",group="${group}"} ${count}`);
  }

  lines.push('# HELP http_request_duration_seconds Request duration by route group (summary)');
  lines.push('# TYPE http_request_duration_seconds summary');
  for (const [group, d] of durations) {
    lines.push(`http_request_duration_seconds_sum{group="${group}"} ${d.sum.toFixed(6)}`);
    lines.push(`http_request_duration_seconds_count{group="${group}"} ${d.count}`);
  }

  const mem = process.memoryUsage();
  lines.push('# TYPE process_resident_memory_bytes gauge');
  lines.push(`process_resident_memory_bytes ${mem.rss}`);
  lines.push('# TYPE nodejs_heap_used_bytes gauge');
  lines.push(`nodejs_heap_used_bytes ${mem.heapUsed}`);
  lines.push('# TYPE process_uptime_seconds gauge');
  lines.push(`process_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`);

  let dbUp = 0;
  try {
    const prisma = require('../config/db');
    await prisma.$queryRaw`SELECT 1`;
    dbUp = 1;
  } catch { dbUp = 0; }
  lines.push('# TYPE portal_db_up gauge');
  lines.push(`portal_db_up ${dbUp}`);

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(`${lines.join('\n')}\n`);
}

module.exports = { metricsMiddleware, metricsHandler, metricsGuard };
