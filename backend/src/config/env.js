const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  SALT_ROUNDS: z.coerce.number().int().positive().default(12),

  // Email (SMTP). If SMTP_HOST is absent the service runs in dev mode and
  // writes messages to `backend/logs/outbox/` instead of sending.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Novastra <no-reply@novastra.edu.pk>'),

  // SMS gateway (Twilio-compatible). Absent = dev mode (logs only).
  SMS_PROVIDER: z.enum(['none', 'twilio', 'http']).default('none'),
  SMS_ACCOUNT_SID: z.string().optional(),
  SMS_AUTH_TOKEN: z.string().optional(),
  SMS_FROM: z.string().optional(),
  SMS_HTTP_URL: z.string().optional(),

  // Online fee payments. "simulated" = demo flow (no real charges);
  // "stripe" = Stripe Checkout (requires STRIPE_SECRET_KEY, webhook secret).
  PAYMENT_PROVIDER: z.enum(['simulated', 'stripe']).default('simulated'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYMENT_CURRENCY: z.string().default('pkr'),

  // Prometheus metrics endpoint bearer token (endpoint disabled when unset).
  METRICS_TOKEN: z.string().optional(),

  // Object storage. Absent = local disk (`backend/uploads`).
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  // Optional backup delivery and failure notification.
  BACKUP_S3_PREFIX: z.string().default('database-backups/'),
  BACKUP_ALERT_WEBHOOK: z.string().url().optional(),

  // Error tracking. Absent = disabled.
  SENTRY_DSN: z.string().optional(),

  // Data retention (days). 0 disables cleanup.
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(0).default(365),
  CHAT_RETENTION_DAYS: z.coerce.number().int().min(0).default(180),

  // Trust proxy (set 1 when behind nginx/load balancer for correct client IPs)
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  // Rate limits (requests per 15-minute window per IP)
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
}).superRefine((value, ctx) => {
  if (value.NODE_ENV === 'production') {
    const url = new URL(value.CLIENT_URL);
    if (url.protocol !== 'https:') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLIENT_URL'], message: 'CLIENT_URL must use HTTPS in production' });
    }
    if (url.hostname === '*' || value.CLIENT_URL.includes('*')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['CLIENT_URL'], message: 'Wildcard CORS origins are not allowed in production' });
    }
  }
});

let cached = null;

function env() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    // eslint-disable-next-line no-console
    console.error(`\nInvalid environment configuration:\n${details}\n`);
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}

module.exports = { env };
