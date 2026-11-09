const prisma = require('../config/db');
const { broadcast } = require('../realtime/hub');

function peerName(user) {
  return user.student?.name || user.faculty?.name || user.email;
}

exports.getPeers = async (req, res, next) => {
  try {
    const others = await prisma.user.findMany({
      where: { id: { not: req.user.id }, tenantId: req.user.tenantId, isActive: true },
      select: {
        id: true, email: true, role: true,
        student: { select: { rollNumber: true, name: true } },
        faculty: { select: { employeeId: true, name: true } },
      },
    });

    const messages = await prisma.chatMessage.findMany({
      where: { tenantId: req.user.tenantId, OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
      orderBy: { createdAt: 'desc' },
      take: 300,
      select: { senderId: true, receiverId: true, body: true, createdAt: true, readAt: true },
    });

    const peers = others.map((u) => {
      const conv = messages.filter(
        (m) => (m.senderId === u.id && m.receiverId === req.user.id) || (m.receiverId === u.id && m.senderId === req.user.id)
      );
      const last = conv[0] || null;
      const unread = messages.filter(
        (m) => m.senderId === u.id && m.receiverId === req.user.id && !m.readAt
      ).length;
      return {
        id: u.id,
        name: peerName(u),
        email: u.email,
        role: u.role,
        meta: u.student?.rollNumber || u.faculty?.employeeId || '',
        lastMessage: last?.body || null,
        lastAt: last?.createdAt || null,
        unread,
      };
    });

    peers.sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
    res.json({ peers });
  } catch (err) {
    next(err);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const peerId = req.params.userId;
    const peer = await prisma.user.findUnique({
      where: { id: peerId, tenantId: req.user.tenantId },
      select: {
        id: true, email: true, role: true,
        student: { select: { rollNumber: true, name: true } },
        faculty: { select: { employeeId: true, name: true } },
      },
    });
    if (!peer) return res.status(404).json({ message: 'User not found' });

    const messages = await prisma.chatMessage.findMany({
      where: {
        tenantId: req.user.tenantId,
        OR: [
          { senderId: req.user.id, receiverId: peerId },
          { senderId: peerId, receiverId: req.user.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, Number(req.query.limit) || 50)),
      ...(req.query.before ? { where: {
        OR: [
          { senderId: req.user.id, receiverId: peerId },
          { senderId: peerId, receiverId: req.user.id },
        ],
        createdAt: { lt: new Date(req.query.before) },
      } } : {}),
      select: { id: true, senderId: true, receiverId: true, body: true, createdAt: true, readAt: true },
    });

    await prisma.chatMessage.updateMany({
      where: { tenantId: req.user.tenantId, senderId: peerId, receiverId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({
      peer: { id: peer.id, name: peerName(peer), email: peer.email, role: peer.role },
      messages: messages.reverse(),
      pagination: { hasMore: messages.length === Math.min(100, Math.max(1, Number(req.query.limit) || 50)) },
    });
  } catch (err) {
    next(err);
  }
};

exports.send = async (req, res, next) => {
  try {
    const receiverId = req.params.userId;
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ message: 'Message body is required' });
    if (body.length > 2000) return res.status(400).json({ message: 'Message too long (max 2000 chars)' });

    const receiver = await prisma.user.findUnique({ where: { id: receiverId, tenantId: req.user.tenantId }, select: { id: true, isActive: true } });
    if (!receiver || !receiver.isActive) return res.status(404).json({ message: 'Recipient not found' });

    const message = await prisma.chatMessage.create({
      data: { tenantId: req.user.tenantId, senderId: req.user.id, receiverId, body: body.trim() },
      select: { id: true, senderId: true, receiverId: true, body: true, createdAt: true, readAt: true },
    });

    broadcast(req.user.tenantId, receiverId, 'chat.message', message);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
};
