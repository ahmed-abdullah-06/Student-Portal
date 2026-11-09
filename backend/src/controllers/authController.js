const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { env } = require('../config/env');
const { logAudit, log } = require('../utils/logger');
const { sendTemplate } = require('../services/email');

const SALT_ROUNDS = 12;

function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().NODE_ENV === 'production',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
}

function setRefreshCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  });
}

function issueCaptcha(req, res) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const token = jwt.sign({ code, iat: Date.now() }, env().JWT_SECRET, { expiresIn: '10m' });
  res.json({ code, token });
}

function verifyCaptcha(req, captcha, captchaToken) {
  if (!captchaToken || !captcha) return true;
  try {
    const payload = jwt.verify(captchaToken, env().JWT_SECRET);
    return payload.code === String(captcha).toUpperCase().replace(/\s/g, '');
  } catch {
    return false;
  }
}

async function findUserByEmailOrRoll(identifier, tenantId) {
  const id = String(identifier).toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: { email: id, ...(tenantId ? { tenantId } : {}) },
    include: { student: { select: { id: true, rollNumber: true } } },
  });
  if (user) return user;
  const student = await prisma.student.findFirst({
    where: { rollNumber: String(identifier).toUpperCase().trim() },
    include: { user: true },
  });
  if (student?.user && (!tenantId || student.user.tenantId === tenantId)) {
    return student.user;
  }
  return null;
}

async function handleFailedLogin(user) {
  if (!user) return;
  const attempts = (user.failedLoginAttempts || 0) + 1;
  const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: attempts, lockedUntil: lockUntil },
  });
}

async function createSession(req, user) {
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      userAgent: (req.headers['user-agent'] || '').slice(0, 300),
      ipAddress: req.ip,
    },
  });
  return session;
}

function signToken(user, session) {
  return jwt.sign(
    { sub: user.id, role: user.role, tv: user.tokenVersion, sid: session.id, tid: user.tenantId },
    env().JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function signRefreshToken(user, session) {
  return jwt.sign(
    { sub: user.id, tv: user.tokenVersion, sid: session.id, tid: user.tenantId, purpose: 'refresh' },
    env().JWT_SECRET,
    { expiresIn: '30d' }
  );
}

exports.captcha = issueCaptcha;

exports.login = async (req, res, next) => {
  try {
    const { email, password, captcha, captchaToken, totp, pendingToken, role: portalRole } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!verifyCaptcha(req, captcha, captchaToken)) {
      return res.status(400).json({ message: 'Invalid captcha. Please try again.' });
    }

    const user = await findUserByEmailOrRoll(email, req.tenant?.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({ message: `Account locked. Try again in ${mins} minute(s).` });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      await handleFailedLogin(user);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (portalRole && user.role !== portalRole) {
      const labels = { STUDENT: 'student', FACULTY: 'faculty', ADMIN: 'administrator' };
      return res.status(403).json({
        message: `This account cannot sign in to the ${labels[portalRole]} portal. Please use the ${labels[user.role] || 'correct'} portal.`,
      });
    }

    // 2FA step: credentials valid, but TOTP code required
    if (user.twoFactorEnabled && !totp) {
      const pending = jwt.sign({ sub: user.id, purpose: '2fa' }, env().JWT_SECRET, { expiresIn: '5m' });
      return res.json({ requires2FA: true, pendingToken: pending });
    }

    if (user.twoFactorEnabled && totp) {
      let pending = null;
      try {
        pending = jwt.verify(pendingToken, env().JWT_SECRET);
      } catch { /* invalid or expired pending token */ }
      if (!pending || pending.purpose !== '2fa' || pending.sub !== user.id) {
        return res.status(401).json({ message: 'Two-factor session expired. Please sign in again.' });
      }
      const { verifyTOTP } = require('../utils/totp');
      if (!user.twoFactorSecret || !verifyTOTP(user.twoFactorSecret, totp)) {
        await handleFailedLogin(user);
        return res.status(401).json({ message: 'Invalid two-factor code' });
      }
    }

    if (user.failedLoginAttempts > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    const session = await createSession(req, user);
    const token = signToken(user, session);
    const refreshToken = signRefreshToken(user, session);
    setTokenCookie(res, token);
    setRefreshCookie(res, refreshToken);

    logAudit('LOGIN', {
      userId: user.id,
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      details: `${user.email} logged in`,
    });

    res.json({
      user: {
        id: user.id, email: user.email, role: user.role,
        mustChangePassword: user.mustChangePassword,
        termsAcceptedAt: user.termsAcceptedAt,
        permissions: user.permissions || [],
        twoFactorEnabled: user.twoFactorEnabled,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
};

exports.acceptTerms = async (req, res, next) => {
  try {
    if (req.body.accepted !== true) return res.status(400).json({ message: 'Terms must be accepted to continue' });
    await prisma.user.update({ where: { id: req.user.id }, data: { termsAcceptedAt: new Date() } });
    res.json({ message: 'Terms accepted' });
  } catch (err) { next(err); }
};

exports.logout = async (req, res) => {
  const bearer = req.headers.authorization;
  const token = req.cookies?.token || (bearer && bearer.startsWith('Bearer ') ? bearer.slice(7) : null);
  if (token) {
    try {
      const payload = jwt.verify(token, env().JWT_SECRET, { ignoreExpiration: true });
      if (payload.sid) {
        await prisma.userSession.updateMany({
          where: { id: payload.sid, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch { /* token unreadable — cookie clear below is enough */ }
  }
  res.clearCookie('token', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ message: 'Logged out' });
};

exports.refresh = async (req, res, next) => {
  try {
    const payload = jwt.verify(req.cookies?.refreshToken || '', env().JWT_SECRET);
    if (payload.purpose !== 'refresh') return res.status(401).json({ message: 'Invalid refresh token' });
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, tokenVersion: true, tenantId: true, isActive: true },
    });
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) return res.status(401).json({ message: 'Session expired' });
    const session = await prisma.userSession.findFirst({ where: { id: payload.sid, userId: user.id, revokedAt: null } });
    if (!session) return res.status(401).json({ message: 'Session expired' });
    const token = signToken(user, session);
    setTokenCookie(res, token);
    res.json({ token });
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') return res.status(401).json({ message: 'Session expired' });
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, role: true, mustChangePassword: true,
        permissions: true, twoFactorEnabled: true, termsAcceptedAt: true,
        student: { select: { id: true, rollNumber: true, name: true, department: true, batch: true, currentSemester: true, degree: true, guardianName: true, phone: true, cnic: true, address: true, dateOfBirth: true, gender: true, bloodGroup: true, nationality: true, photoUrl: true, permanentAddress: true, guardianPhone: true, emergencyContactName: true, emergencyContactPhone: true, matricMarks: true, interMarks: true, advisorName: true } },
        faculty: { select: { id: true, employeeId: true, name: true, designation: true, department: true, phone: true, officeHours: true, bio: true } },
      },
    });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    if (oldPassword === newPassword) {
      return res.status(400).json({ message: 'New password must differ from current password' });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: false, tokenVersion: { increment: 1 } },
    });

    // revoke all sessions on password change
    await prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    sendTemplate('passwordChanged', user.email, { name: user.email })
      .catch((e) => log('warn', 'email_password_changed_failed', { error: e.message }));

    logAudit('CHANGE_PASSWORD', {
      userId: user.id,
      entity: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      details: 'Password changed by user',
    });

    res.json({ message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await findUserByEmailOrRoll(email, req.tenant?.id);

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });
      logAudit('FORGOT_PASSWORD', {
        userId: user.id,
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
        details: 'Reset token issued',
      });

      const link = `${env().CLIENT_URL}/reset-password?token=${token}`;
      sendTemplate('passwordReset', user.email, {
        name: user.email,
        link,
        expiresIn: '1 hour',
      }).catch((e) => log('warn', 'email_reset_failed', { error: e.message }));

      if (env().NODE_ENV !== 'production') {
        return res.json({ message: 'Reset token generated', devToken: token });
      }
    }
    res.json({ message: 'If the account exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || new Date(record.expiresAt) < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: {
          password: hashed, mustChangePassword: false,
          failedLoginAttempts: 0, lockedUntil: null,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.userSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    logAudit('RESET_PASSWORD', {
      userId: record.userId,
      entity: 'User',
      entityId: record.userId,
      ipAddress: req.ip,
      details: 'Password reset via token',
    });

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
};

// ---------- Active sessions ----------
exports.listSessions = async (req, res, next) => {
  try {
    const sessions = await prisma.userSession.findMany({
      where: { userId: req.user.id, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
      take: 20,
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true },
    });
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
};

exports.revokeSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await prisma.userSession.updateMany({
      where: { id, userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) return res.status(404).json({ message: 'Session not found' });
    res.json({ message: 'Session revoked' });
  } catch (err) {
    next(err);
  }
};

exports.revokeAllSessions = async (req, res, next) => {
  try {
    await prisma.userSession.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // bump tokenVersion so any lingering JWT also dies
    await prisma.user.update({
      where: { id: req.user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    res.json({ message: 'All sessions revoked' });
  } catch (err) {
    next(err);
  }
};

exports.hashPassword = (password) => bcrypt.hash(password, SALT_ROUNDS);
