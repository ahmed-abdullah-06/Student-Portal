const { env } = require('../config/env');

let pino = null;
if (env().NODE_ENV !== 'test') {
  try {
    pino = require('pino')({
      level: process.env.LOG_LEVEL || (env().NODE_ENV === 'production' ? 'info' : 'debug'),
      base: { service: 'novastra-api' },
      timestamp: pino => `,"time":"${new Date().toISOString()}"`,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password', 'token'],
        censor: '[REDACTED]',
      },
    });
  } catch {
    pino = null;
  }
}

function log(level, message, meta = {}) {
  if (pino && typeof pino[level] === 'function') {
    pino[level](meta, message);
    return;
  }
  const entry = { time: new Date().toISOString(), level, message, ...meta };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else console.log(line);
}

function logAudit(action, { userId = null, entity = null, entityId = null, details = null, ipAddress = null }) {
  // Fire and forget: auditing must never break the main request flow
  const prisma = require('../config/db');
  prisma.auditLog
    .create({ data: { action, userId, entity, entityId, details, ipAddress } })
    .catch((err) => log('error', 'audit_log_failed', { error: err.message }));
}

function logger() {
  return pino;
}

module.exports = { log, logAudit, logger };
