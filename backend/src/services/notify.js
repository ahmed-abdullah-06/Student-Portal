const prisma = require('../config/db');
const { log } = require('../utils/logger');
const { getSection } = require('./settings');
const { broadcast } = require('../realtime/hub');

const categoryFor = (type) => {
  const value = String(type || '').toUpperCase();
  if (value.includes('GRADE') || value.includes('RESULT')) return 'GRADES';
  if (value.includes('ASSIGN')) return 'ASSIGNMENTS';
  if (value.includes('FEE') || value.includes('PAY')) return 'FEES';
  if (value.includes('MESSAGE') || value.includes('CHAT')) return 'MESSAGES';
  return 'SYSTEM';
};

async function deliveryPreferences(userId, type) {
  const row = await prisma.notificationPreference.findUnique({
    where: { userId_category: { userId, category: categoryFor(type) } },
    select: { inApp: true, email: true, sms: true },
  });
  return row || { inApp: true, email: true, sms: false };
}

/**
 * Central user-notification helper.
 *
 * In-app notifications are written to the database (awaited, so callers can
 * rely on them). Email/SMS are best-effort and fire-and-forget: failures are
 * logged but never block the request flow. Delivery is gated by the tenant's
 * `features` settings (emailNotifications / smsNotifications).
 */

async function featureFlags() {
  try {
    const f = await getSection('features');
    return {
      email: f.emailNotifications !== false,
      sms: f.smsNotifications === true,
    };
  } catch {
    return { email: true, sms: false };
  }
}

/** Email + SMS only (used when the in-app row is written separately, e.g. in a transaction). */
function notifyComms({ user, phone = null, emailTemplate = null, sms = null, preferences = null, type = 'INFO' }) {
  Promise.resolve()
    .then(async () => {
      const flags = await featureFlags();
      const delivery = preferences || await deliveryPreferences(user.id, type);
      if (emailTemplate && delivery.email && user?.email && flags.email) {
        const { sendTemplate } = require('./email');
        await sendTemplate(emailTemplate.name, user.email, emailTemplate.data).catch((err) =>
          log('warn', 'notify_email_failed', { to: user.email, template: emailTemplate.name, error: err.message })
        );
      }
      if (sms && delivery.sms && phone && flags.sms) {
        const { sendSMS } = require('./sms');
        await sendSMS(phone, sms);
      }
    })
    .catch((err) => log('warn', 'notify_comms_failed', { error: err.message }));
}

/** In-app notification (awaited) plus optional best-effort email/SMS. */
async function notifyUser(user, { title, body, type = 'INFO', link = null, phone = null, emailTemplate = null, sms = null }) {
  const preferences = await deliveryPreferences(user.id, type);
  const notification = preferences.inApp
    ? await prisma.notification.create({ data: { userId: user.id, title, body, type, link } })
    : null;
  notifyComms({ user, phone, emailTemplate, sms, preferences, type });
  if (notification && user.tenantId) {
    broadcast(user.tenantId, user.id, 'notification', {
      id: notification.id, title, body, type, link, createdAt: notification.createdAt,
    });
  }
  return notification;
}

module.exports = { notifyUser, notifyComms, deliveryPreferences, categoryFor };
