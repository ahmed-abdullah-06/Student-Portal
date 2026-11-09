const prisma = require('../config/db');
const { env } = require('../config/env');
const { log, logAudit } = require('../utils/logger');

/**
 * Data retention: purge rows past their configured lifetime so the platform
 * meets data-minimisation obligations (GDPR-style) and keeps tables lean.
 */

async function counts(settings) {
  const now = new Date();
  const auditCut = new Date(now.getTime() - (settings.retention?.auditLogDays ?? env().AUDIT_RETENTION_DAYS) * 86400000);
  const chatCut = new Date(now.getTime() - (settings.retention?.chatMessageDays ?? env().CHAT_RETENTION_DAYS) * 86400000);
  const notifCut = new Date(now.getTime() - (settings.retention?.notificationDays ?? 90) * 86400000);

  const [audit, chat, notifications, usedResets, revokedSessions] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { lt: auditCut } } }),
    prisma.chatMessage.count({ where: { createdAt: { lt: chatCut }, readAt: { not: null } } }),
    prisma.notification.count({ where: { createdAt: { lt: notifCut } } }),
    prisma.passwordResetToken.count({ where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] } }),
    prisma.userSession.count({ where: { revokedAt: { lt: new Date(now.getTime() - 7 * 86400000) } } }),
  ]);
  return { audit, chat, notifications, usedResets, revokedSessions, cuts: { auditCut, chatCut, notifCut } };
}

exports.previewRetention = async (req, res, next) => {
  try {
    const { getSettings } = require('../services/settings');
    const settings = await getSettings();
    res.json(await counts(settings));
  } catch (err) { next(err); }
};

exports.runRetention = async (req, res, next) => {
  try {
    const { getSettings } = require('../services/settings');
    const settings = await getSettings();
    const before = await counts(settings);

    const results = await Promise.all([
      prisma.auditLog.deleteMany({ where: { createdAt: { lt: before.cuts.auditCut } } }),
      prisma.chatMessage.deleteMany({ where: { createdAt: { lt: before.cuts.chatCut }, readAt: { not: null } } }),
      prisma.notification.deleteMany({ where: { createdAt: { lt: before.cuts.notifCut } } }),
      prisma.passwordResetToken.deleteMany({
        where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: new Date() } }] },
      }),
      prisma.userSession.deleteMany({
        where: { revokedAt: { lt: new Date(Date.now() - 7 * 86400000) } },
      }),
    ]);

    const deleted = {
      auditLogs: results[0].count,
      chatMessages: results[1].count,
      notifications: results[2].count,
      passwordResetTokens: results[3].count,
      sessions: results[4].count,
    };

    log('info', 'retention_run', deleted);
    logAudit('RETENTION_RUN', {
      userId: req.user?.id || null, entity: 'System', ipAddress: req.ip,
      details: JSON.stringify(deleted),
    });
    res.json({ deleted, message: 'Retention cleanup completed' });
  } catch (err) { next(err); }
};

/** Callable from cron: `node scripts/retention.js` */
if (require.main === module) {
  (async () => {
    const fakeReq = { user: { id: null }, ip: 'cron' };
    await exports.runRetention(fakeReq, {
      json: (d) => console.log(JSON.stringify(d)),
      status: () => ({ json: console.log }),
    }, (e) => { console.error(e); process.exit(1); });
    process.exit(0);
  })();
}
