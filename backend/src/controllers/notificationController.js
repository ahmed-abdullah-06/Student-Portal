const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');
const { broadcast } = require('../realtime/hub');
const { parsePagination, pageMeta } = require('../utils/pagination');

exports.list = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const where = { OR: [{ userId: null }, { userId: req.user.id }] };
    const [notifications, total] = await Promise.all([prisma.notification.findMany({
      where,
      include: { reads: { where: { userId: req.user.id }, select: { id: true } } },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
      select: {
        id: true, title: true, body: true, type: true, link: true, createdAt: true,
        reads: { where: { userId: req.user.id }, select: { id: true },
        },
      },
    }), prisma.notification.count({ where })]);

    res.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        link: n.link,
        createdAt: n.createdAt,
        read: n.reads.length > 0,
      })),
      pagination: pageMeta({ page, limit, total }),
    });
  } catch (err) {
    next(err);
  }
};

exports.unreadCount = async (req, res, next) => {
  try {
    const all = await prisma.notification.findMany({
      where: { OR: [{ userId: null }, { userId: req.user.id }] },
      select: { id: true, reads: { where: { userId: req.user.id }, select: { id: true } } },
    });
    const unread = all.filter((n) => n.reads.length === 0).length;
    res.json({ unread });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || (notification.userId && notification.userId !== req.user.id)) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    await prisma.notificationRead.upsert({
      where: { notificationId_userId: { notificationId: id, userId: req.user.id } },
      create: { notificationId: id, userId: req.user.id },
      update: {},
    });
    res.json({ message: 'Read' });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { OR: [{ userId: null }, { userId: req.user.id }] },
      select: { id: true },
    });
    await prisma.$transaction(
      notifications.map((n) =>
        prisma.notificationRead.upsert({
          where: { notificationId_userId: { notificationId: n.id, userId: req.user.id } },
          create: { notificationId: n.id, userId: req.user.id },
          update: {},
        })
      )
    );
    res.json({ message: 'All marked read' });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { title, body, type, link, userId } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'title and body are required' });

    let notification;
    if (userId) {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, tenantId: true } });
      if (!target) return res.status(404).json({ message: 'Recipient not found' });
      const { notifyUser } = require('../services/notify');
      notification = await notifyUser(target, { title, body, type: type || 'INFO', link: link || null });
      if (!notification) return res.status(202).json({ message: 'Notification suppressed by recipient preferences' });
    } else {
      notification = await prisma.notification.create({
        data: { title, body, type: type || 'INFO', link: link || null, userId: null, tenantId: req.user.tenantId },
        select: { id: true, title: true, body: true, type: true, link: true, createdAt: true },
      });
    }
    broadcast(req.user.tenantId, userId || null, 'notification', {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.type,
      link: notification.link,
      createdAt: notification.createdAt,
    });

    logAudit('NOTIFICATION_SENT', {
      userId: req.user.id, entity: 'Notification', entityId: notification.id, ipAddress: req.ip,
      details: userId ? 'Direct notification' : 'Broadcast',
    });

    res.status(201).json({ notification });
  } catch (err) {
    next(err);
  }
};

const CATEGORIES = ['GRADES', 'ASSIGNMENTS', 'FEES', 'SYSTEM', 'MESSAGES'];

exports.preferences = async (req, res, next) => {
  try {
    const rows = await prisma.notificationPreference.findMany({
      where: { userId: req.user.id },
      orderBy: { category: 'asc' },
    });
    const byCategory = new Map(rows.map((row) => [row.category, row]));
    res.json({
      preferences: CATEGORIES.map((category) => byCategory.get(category) || {
        category, inApp: true, email: true, sms: false,
      }),
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePreferences = async (req, res, next) => {
  try {
    const preferences = Array.isArray(req.body.preferences) ? req.body.preferences : [];
    if (preferences.some((item) => !CATEGORIES.includes(item.category))) {
      return res.status(400).json({ message: 'Invalid notification category' });
    }
    const saved = await prisma.$transaction(preferences.map((item) => prisma.notificationPreference.upsert({
      where: { userId_category: { userId: req.user.id, category: item.category } },
      create: {
        userId: req.user.id,
        category: item.category,
        inApp: Boolean(item.inApp),
        email: Boolean(item.email),
        sms: Boolean(item.sms),
      },
      update: {
        inApp: Boolean(item.inApp),
        email: Boolean(item.email),
        sms: Boolean(item.sms),
      },
    })));
    res.json({ preferences: saved, message: 'Notification preferences updated' });
  } catch (err) {
    next(err);
  }
};
