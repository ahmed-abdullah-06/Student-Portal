const crypto = require('crypto');
const { log } = require('../utils/logger');

/** Attach a request id + start time; emit one structured log line per request. */
function requestContext(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  req.startedAt = process.hrtime.bigint();
  res.setHeader('X-Request-Id', req.id);
  res.on('finish', () => {
    const durMs = Number(process.hrtime.bigint() - req.startedAt) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    log(level, 'http_request', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durMs * 10) / 10,
      userId: req.user?.id || null,
      ip: req.ip,
    });
  });
  next();
}

module.exports = { requestContext };
