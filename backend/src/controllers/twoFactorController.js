const prisma = require('../config/db');
const bcrypt = require('bcryptjs');
const { generateSecret, verifyTOTP, otpauthURL } = require('../utils/totp');
const { logAudit } = require('../utils/logger');

/**
 * 2FA flow:
 *  1. POST /2fa/enable   → generates a secret (stored pending), returns otpauth URL + QR
 *  2. POST /2fa/confirm  → user proves the code works → 2FA switched on
 *  3. POST /2fa/disable  → requires current TOTP or password
 */

exports.enable2FA = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.twoFactorEnabled) return res.status(400).json({ message: 'Two-factor authentication is already enabled' });

    const secret = generateSecret();
    await prisma.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret } });

    const url = otpauthURL(secret, user.email);
    let qr = null;
    try {
      const QRCode = require('qrcode');
      qr = await QRCode.toDataURL(url);
    } catch { /* QR optional */ }

    logAudit('2FA_ENABLE_INIT', { userId: user.id, entity: 'User', entityId: user.id, ipAddress: req.ip, details: 'TOTP secret generated' });
    res.json({ secret, otpauthUrl: url, qr });
  } catch (err) {
    next(err);
  }
};

exports.confirm2FA = async (req, res, next) => {
  try {
    const { code } = req.validated || req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.twoFactorSecret) return res.status(400).json({ message: 'Two-factor setup not started' });

    if (!verifyTOTP(user.twoFactorSecret, code)) {
      return res.status(400).json({ message: 'Invalid code. Please try again.' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    logAudit('2FA_ENABLED', { userId: user.id, entity: 'User', entityId: user.id, ipAddress: req.ip, details: 'TOTP verified and enabled' });
    res.json({ message: 'Two-factor authentication enabled' });
  } catch (err) {
    next(err);
  }
};

exports.disable2FA = async (req, res, next) => {
  try {
    const { password, code } = req.validated || req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.twoFactorEnabled) return res.status(400).json({ message: 'Two-factor authentication is not enabled' });

    let ok = false;
    if (code && user.twoFactorSecret) ok = verifyTOTP(user.twoFactorSecret, code);
    if (!ok && password) ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Verification failed. Provide your password or current code.' });

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    logAudit('2FA_DISABLED', { userId: user.id, entity: 'User', entityId: user.id, ipAddress: req.ip, details: 'TOTP disabled' });
    res.json({ message: 'Two-factor authentication disabled' });
  } catch (err) {
    next(err);
  }
};
