const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const { env } = require('../config/env');
const prisma = require('../config/db');

const clients = new Map();

function send(socket, event, data) {
  if (socket.readyState === 1) socket.send(JSON.stringify({ event, data }));
}

function broadcast(tenantId, userId, event, data) {
  for (const [socket, identity] of clients) {
    if (identity.tenantId === tenantId && (!userId || identity.userId === userId)) {
      send(socket, event, data);
    }

  }
}

function onlineUsers(tenantId) {
  return [...clients.values()]
    .filter((identity) => identity.tenantId === tenantId)
    .map((identity) => identity.userId)
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

function attach(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', async (socket, request) => {
    const token = new URL(request.url, 'http://localhost').searchParams.get('token');
    let payload;
    try {
      payload = jwt.verify(token || '', env().JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, tenantId: true, isActive: true, tokenVersion: true },
      });
      if (!user || !user.isActive || user.tenantId !== payload.tid || user.tokenVersion !== payload.tv) {
        socket.close(1008, 'Authentication failed');
        return;
      }
      clients.set(socket, { userId: user.id, tenantId: user.tenantId });
      send(socket, 'connected', { userId: user.id });
      broadcast(user.tenantId, null, 'presence', { userId: user.id, online: true, onlineUsers: onlineUsers(user.tenantId) });
      socket.on('message', (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          if (message.event === 'typing' && typeof message.userId === 'string') {
            broadcast(user.tenantId, message.userId, 'typing', { userId: user.id, typing: Boolean(message.typing) });
          }
        } catch {
          send(socket, 'error', { message: 'Invalid realtime message' });
        }
      });
      socket.on('close', () => {
        clients.delete(socket);
        broadcast(user.tenantId, null, 'presence', { userId: user.id, online: false, onlineUsers: onlineUsers(user.tenantId) });
      });
    } catch {
      socket.close(1008, 'Authentication failed');
    }
  });
  return wss;
}

module.exports = { attach, broadcast, onlineUsers };
