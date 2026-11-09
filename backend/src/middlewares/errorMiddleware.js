const { log } = require('../utils/logger');
const { captureException } = require('../utils/telemetry');

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  log('error', err.message, { path: req.originalUrl, status, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });

  if (status >= 500) {
    captureException(err, { path: req.originalUrl, requestId: req.id, userId: req.user?.id });
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.issues?.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ message: 'A record with that value already exists' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ message: 'Record not found' });
  }
  if (err.code === 'P2003') {
    return res.status(400).json({ message: 'Related record not found' });
  }

  res.status(status).json({ message: err.message || 'Internal server error' });
}

module.exports = { notFound, errorHandler };
