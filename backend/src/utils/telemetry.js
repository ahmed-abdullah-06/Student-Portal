const { env } = require('../config/env');
const { log } = require('../utils/logger');

let initialized = false;

function initTelemetry() {
  const dsn = env().SENTRY_DSN;
  if (!dsn || initialized) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: env().NODE_ENV,
      tracesSampleRate: 0.1,
      maxBreadcrumbs: 50,
    });
    initialized = true;
    log('info', 'telemetry_enabled', { provider: 'sentry' });
  } catch (err) {
    log('error', 'telemetry_init_failed', { error: err.message });
  }
}

function captureException(err, context = {}) {
  log('error', 'unhandled_exception', { error: err.message, stack: err.stack, ...context });
  if (!initialized) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.withScope((scope) => {
      for (const [k, v] of Object.entries(context)) scope.setExtra(k, v);
      Sentry.captureException(err);
    });
  } catch { /* never let telemetry break requests */ }
}

function captureMessage(message, level = 'info') {
  if (!initialized) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.captureMessage(message, level);
  } catch { /* ignore */ }
}

module.exports = { initTelemetry, captureException, captureMessage };
