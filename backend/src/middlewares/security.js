const { env } = require('../config/env');

/**
 * Origin/Referer check for state-changing requests.
 * The API is consumed by a known frontend origin (CLIENT_URL) or the same
 * origin. Requests with a JSON body that carry a browser Origin header
 * from somewhere else are rejected — this is the practical CSRF defence
 * for cookie-based JWT auth.
 */
function csrfGuard(req, res, next) {
  const safe = ['GET', 'HEAD', 'OPTIONS'];
  if (safe.includes(req.method)) return next();

  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser client (curl, Postman, server-to-server)

  const allowed = new Set([env().CLIENT_URL]);
  try { allowed.add(new URL(env().CLIENT_URL).origin); } catch { /* ignore */ }
  try {
    if (req.headers.host) allowed.add(`http://${req.headers.host}`, `https://${req.headers.host}`);
  } catch { /* ignore */ }

  if (allowed.has(origin)) return next();
  return res.status(403).json({ message: 'Cross-origin request blocked' });
}

module.exports = { csrfGuard };
