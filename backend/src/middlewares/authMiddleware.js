const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { env } = require('../config/env');
const { enforceUserRateLimit } = require('./rateLimit');

async function authMiddleware(req, res, next) {
  try {
    const bearer = req.headers.authorization;
    const token =
      req.cookies?.token || (bearer && bearer.startsWith('Bearer ') ? bearer.slice(7) : null);

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    let payload;
    try {
      payload = jwt.verify(token, env().JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    // Platform tokens (SaaS operators) never grant access to tenant endpoints.
    if (payload.scope === 'platform') {
      return res.status(401).json({ message: 'Platform tokens cannot access tenant endpoints' });
    }

    // Tenant isolation: a token minted for one tenant is rejected on another.
    if (payload.tid && req.tenant && payload.tid !== req.tenant.id) {
      return res.status(401).json({ message: 'Token is not valid for this tenant' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, role: true, isActive: true,
        mustChangePassword: true, tokenVersion: true, permissions: true,
        twoFactorEnabled: true, tenantId: true, termsAcceptedAt: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Account is inactive or not found' });
    }

    // The user's tenant must match the request tenant.
    if (req.tenant && user.tenantId !== req.tenant.id) {
      return res.status(401).json({ message: 'Account is inactive or not found' });
    }

    // Revocation check: password change / "logout everywhere" bumps tokenVersion.
    if (typeof payload.tv === 'number' && payload.tv !== user.tokenVersion) {
      return res.status(401).json({ message: 'Session was revoked. Please log in again.' });
    }

    // Best-effort session activity tracking (fire and forget).
    if (payload.sid) {
      prisma.userSession
        .updateMany({
          where: { id: payload.sid, revokedAt: null },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => {});
    }

    req.user = user;
    if (!enforceUserRateLimit(req, res)) return;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = authMiddleware;
