const { env } = require('./src/config/env');

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');

const config = env(); // validates environment before anything else boots

const authRoutes = require('./src/routes/authRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const facultyRoutes = require('./src/routes/facultyRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const libraryRoutes = require('./src/routes/libraryRoutes');
const hostelRoutes = require('./src/routes/hostelRoutes');
const transportRoutes = require('./src/routes/transportRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const paymentWebhookRoutes = require('./src/routes/paymentWebhookRoutes');
const withdrawRoutes = require('./src/routes/withdrawRoutes');
const complaintRoutes = require('./src/routes/complaintRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const { router: settingsRoutes, publicRouter: publicSettingsRoutes } = require('./src/routes/settingsRoutes');
const platformRoutes = require('./src/platform/routes');
const { notFound, errorHandler } = require('./src/middlewares/errorMiddleware');
const { apiLimiter } = require('./src/middlewares/rateLimit');
const { csrfGuard } = require('./src/middlewares/security');
const { requestContext } = require('./src/middlewares/requestContext');
const { metricsMiddleware, metricsHandler, metricsGuard } = require('./src/middlewares/metrics');
const tenantResolver = require('./src/middlewares/tenant');
const { initTelemetry, captureException } = require('./src/utils/telemetry');
const { log } = require('./src/utils/logger');
const realtime = require('./src/realtime/hub');

const app = express();

initTelemetry();

app.set('trust proxy', config.TRUST_PROXY);

// Generate a request-scoped nonce for any future inline bootstrap script.
// The SPA currently ships no inline scripts, but keeping nonce support enabled
// prevents a later template from weakening CSP with unsafe-inline.
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

app.use(helmet({
  contentSecurityPolicy: config.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'"], // inline theme vars injected at runtime
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", config.CLIENT_URL],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  hsts: config.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
}));
app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({
  limit: '1mb',
  // Keep the raw payload for gateway webhook signature verification
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
// Express 5 leaves req.body undefined when no JSON body is sent
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { index: false, dotfiles: 'deny' }));
app.use(requestContext);
app.use(metricsMiddleware);
// Platform routes run BEFORE tenant resolution: they are tenant-agnostic and
// operate outside tenant context (their own auth + rate limits).
app.use('/api/platform', platformRoutes);
// Payment gateway webhooks also run before tenant resolution: the provider
// cannot send tenant headers, the tenant comes from signed payload metadata.
app.use('/api/payments/webhook', paymentWebhookRoutes);
app.use(tenantResolver);
app.use(csrfGuard);
app.use('/api', apiLimiter);
app.use('/api', (req, res, next) => {
  const rate = req.rateLimit;
  if (rate) {
    res.setHeader('X-RateLimit-Limit', String(rate.limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rate.limit - rate.used)));
    if (rate.resetTime) res.setHeader('X-RateLimit-Reset', String(Math.ceil(rate.resetTime.getTime() / 1000)));
  }
  next();
});

// ---------- Health & status ----------
const os = require('os');
let startedAt = Date.now();

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Prometheus metrics — disabled unless METRICS_TOKEN is configured
app.get('/api/metrics', metricsGuard, metricsHandler);

app.get('/api/status', async (req, res) => {
  const checks = { api: 'ok' };
  let ok = true;

  // Database
  try {
    const prisma = require('./src/config/db');
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (e) {
    checks.database = 'error';
    ok = false;
  }

  // Storage
  try {
    const { env: e } = require('./src/config/env');
    checks.storage = e().STORAGE_DRIVER === 's3' ? 's3' : 'local';
  } catch { checks.storage = 'unknown'; }

  // Email
  try {
    const { env: e } = require('./src/config/env');
    checks.email = e().SMTP_HOST ? 'smtp' : 'dev-outbox';
  } catch { checks.email = 'unknown'; }

  // Payments
  try {
    const { providerName } = require('./src/services/payments');
    checks.payments = providerName();
  } catch { checks.payments = 'unknown'; }

  const mem = process.memoryUsage();
  res.status(ok ? 200 : 503).json({
    status: ok ? 'operational' : 'degraded',
    checks,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    version: require('./package.json').version,
    node: process.version,
    memory: { rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576) },
    loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
    time: new Date().toISOString(),
  });
});

// ---------- Routes ----------
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/withdrawals', withdrawRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/public', publicSettingsRoutes);

// OpenAPI docs (production only would gate this; kept available for integrators)
try {
  const swaggerUi = require('swagger-ui-express');
  const spec = require('./src/docs/openapi');
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Novastra API Docs' }));
  app.get('/api/openapi.json', (req, res) => res.json(spec));
} catch (e) {
  log('warn', 'openapi_unavailable', { error: e.message });
}

app.use(notFound);
app.use(errorHandler);

const server = http.createServer(app);
realtime.attach(server);

if (require.main === module) {
  server.listen(config.PORT, () => {
    log('info', 'server_started', {
      port: config.PORT,
      env: config.NODE_ENV,
      storage: config.STORAGE_DRIVER,
      email: config.SMTP_HOST ? 'smtp' : 'dev-outbox',
    });
    console.log(`Novastra API running on http://localhost:${config.PORT} (${config.NODE_ENV})`);
  });
}

module.exports = app;
