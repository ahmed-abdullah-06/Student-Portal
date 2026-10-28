#!/usr/bin/env node
/**
 * Production readiness checker.
 *
 * Usage:
 *   npm run check:prod            (reads backend/.env + real environment)
 *
 * Prints PASS / WARN / FAIL for each go-live requirement and exits 1 when any
 * FAIL is present. WARN means "works but recommended before opening to users".
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const checks = [];
const fail = (name, detail) => checks.push({ level: 'FAIL', name, detail });
const warn = (name, detail) => checks.push({ level: 'WARN', name, detail });
const pass = (name, detail) => checks.push({ level: 'PASS', name, detail });

function main() {
  const e = process.env;
  const isProd = e.NODE_ENV === 'production';
  (isProd ? pass : fail)('NODE_ENV=production', isProd ? 'production mode' : `currently "${e.NODE_ENV || 'development'}"`);

  const jwt = e.JWT_SECRET || '';
  if (jwt.length >= 32 && !/change|secret|example/i.test(jwt)) pass('JWT_SECRET', `${jwt.length} chars`);
  else fail('JWT_SECRET', 'missing/short/placeholder — generate with: openssl rand -base64 48');

  const db = e.DATABASE_URL || '';
  if (!db) fail('DATABASE_URL', 'not set');
  else if (/localhost|127\.0\.0\.1/.test(db)) warn('DATABASE_URL', 'points at localhost — expected the server/container database');
  else pass('DATABASE_URL', db.replace(/:[^:@/]+@/, ':***@'));

  const client = e.CLIENT_URL || '';
  if (/^https:\/\//.test(client)) pass('CLIENT_URL', client);
  else warn('CLIENT_URL', `"${client || 'not set'}" — should be the public https URL for links in emails`);

  if (e.TENANT_BASE_DOMAIN) pass('TENANT_BASE_DOMAIN', e.TENANT_BASE_DOMAIN);
  else warn('TENANT_BASE_DOMAIN', 'empty — only needed for multi-tenant subdomains');

  const provider = e.PAYMENT_PROVIDER || 'simulated';
  if (provider === 'stripe') {
    if (/^sk_(live|test)_/.test(e.STRIPE_SECRET_KEY || '')) pass('STRIPE_SECRET_KEY', `set (${(e.STRIPE_SECRET_KEY || '').slice(0, 7)}…)`);
    else fail('STRIPE_SECRET_KEY', 'PAYMENT_PROVIDER=stripe but key missing/invalid');
    if (e.STRIPE_WEBHOOK_SECRET) pass('STRIPE_WEBHOOK_SECRET', 'set');
    else fail('STRIPE_WEBHOOK_SECRET', 'required so webhooks can be verified');
  } else {
    warn('PAYMENT_PROVIDER', `"${provider}" — cards are simulated; configure Stripe before real fee collection`);
  }

  if (e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS) pass('SMTP', `${e.SMTP_HOST} as ${e.SMTP_USER}`);
  else fail('SMTP', 'no real email — password resets would land in the dev outbox');
  if (e.SMTP_FROM) pass('SMTP_FROM', e.SMTP_FROM);
  else warn('SMTP_FROM', 'not set — defaults to Novastra <no-reply@novastra.edu.pk>');

  const metrics = e.METRICS_TOKEN || '';
  if (metrics.length >= 16 && !/change/i.test(metrics)) pass('METRICS_TOKEN', `${metrics.length} chars`);
  else fail('METRICS_TOKEN', 'missing/placeholder — protects /api/metrics');

  const sms = e.SMS_PROVIDER || 'none';
  if (sms === 'none') warn('SMS_PROVIDER', 'disabled — enable twilio/http only if the university wants SMS');
  else if (sms === 'twilio' && e.SMS_ACCOUNT_SID && e.SMS_AUTH_TOKEN) pass('SMS_PROVIDER', 'twilio configured');
  else if (sms === 'http' && e.SMS_HTTP_URL) pass('SMS_PROVIDER', 'http gateway configured');
  else fail('SMS_PROVIDER', `provider "${sms}" selected but credentials missing`);

  if (e.SENTRY_DSN) pass('SENTRY_DSN', 'error tracking on');
  else warn('SENTRY_DSN', 'empty — optional error tracking for production');

  const width = Math.max(...checks.map((c) => c.name.length));
  let failed = 0;
  let warned = 0;
  console.log('\nNovastra production readiness\n');
  for (const c of checks) {
    if (c.level === 'FAIL') failed += 1;
    if (c.level === 'WARN') warned += 1;
    const tag = c.level === 'PASS' ? '\x1b[32mPASS\x1b[0m' : c.level === 'WARN' ? '\x1b[33mWARN\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    console.log(`${tag}  ${c.name.padEnd(width)}  ${c.detail}`);
  }
  console.log(`\n${checks.length - failed - warned} pass · ${warned} warn · ${failed} fail`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
