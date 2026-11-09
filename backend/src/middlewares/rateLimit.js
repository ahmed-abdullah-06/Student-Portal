const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { env } = require('../config/env');
const userBuckets = new Map();

function enforceUserRateLimit(req, res) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const limit = 300;
  const current = userBuckets.get(req.user.id);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  userBuckets.set(req.user.id, bucket);
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count > limit) {
    res.status(429).json({ message: 'Too many requests for this account. Please wait and try again.' });
    return false;
  }
  return true;
}

const json = (req, res, msg = 'Too many requests, please try again later.') =>
  req.accepts('json') ? res.status(429).json({ message: msg }) : res.status(429).send(msg);

/** Broad ceiling for every API request. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env().RATE_LIMIT_API_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  ipv6Subnet: 56,
  handler: (req, res) => json(req, res),
});

/** Strict limiter for credential endpoints. */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env().RATE_LIMIT_AUTH_MAX,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => json(req, res, 'Too many login attempts. Please wait 15 minutes and try again.'),
});

/** Password reset / captcha — moderate. */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => json(req, res, 'Too many attempts. Please try again later.'),
});

/** Strict limiter for second-factor submissions. Initial login requests skip this
 * limiter; only requests carrying a pending 2FA token are counted. */
const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skip: (req) => !req.body?.pendingToken,
  keyGenerator: (req) => req.body?.pendingToken ? String(req.body.pendingToken) : ipKeyGenerator(req.ip),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => json(req, res, 'Too many two-factor attempts. Please sign in again later.'),
});

/** Write-heavy admin imports / uploads. */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => json(req, res, 'Upload limit reached. Try again later.'),
});

/** Payment gateway webhooks (signature-verified; generous but bounded). */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => json(req, res),
});

module.exports = { apiLimiter, authLimiter, sensitiveLimiter, twoFactorLimiter, uploadLimiter, webhookLimiter, enforceUserRateLimit, isProd: () => env().NODE_ENV === 'production' };
