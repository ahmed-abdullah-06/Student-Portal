const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { env } = require('../config/env');

/**
 * Platform (SaaS operator) authentication — separate from tenant users.
 *
 * Platform tokens carry `scope: 'platform'` and are verified exclusively by
 * `platformAuth`. Tenant endpoints reject them, and platform endpoints reject
 * tenant tokens, so the two trust domains never mix.
 */

const PLATFORM_SCOPE = 'platform';

function signPlatformToken(admin) {
  return jwt.sign(
    { sub: admin.id, scope: PLATFORM_SCOPE, email: admin.email, name: admin.name },
    env().JWT_SECRET,
    { expiresIn: process.env.PLATFORM_JWT_EXPIRES_IN || '12h' }
  );
}

async function platformAuth(req, res, next) {
  try {
    const bearer = req.headers.authorization;
    const token = bearer && bearer.startsWith('Bearer ') ? bearer.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Platform authentication required' });

    let payload;
    try {
      payload = jwt.verify(token, env().JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired platform session' });
    }
    if (payload.scope !== PLATFORM_SCOPE) {
      return res.status(401).json({ message: 'Not a platform token' });
    }

    const admin = await prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, isActive: true },
    });
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Platform account is inactive or not found' });
    }

    req.platformAdmin = admin;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { signPlatformToken, platformAuth, PLATFORM_SCOPE };
