import * as Sentry from '@sentry/react';

let enabled = false;

export function initTelemetry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || import.meta.env.MODE === 'test') return false;
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || undefined,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
  enabled = true;
  return true;
}

export function captureException(error, context = {}) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => scope.setExtra(key, value));
    Sentry.captureException(error);
  });
}

export { Sentry };
