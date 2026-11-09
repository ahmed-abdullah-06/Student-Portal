const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');

exports.listRoutes = async (req, res, next) => {
  try {
    const routes = await prisma.transportRoute.findMany({
      include: { _count: { select: { allocations: { where: { status: 'ACTIVE' } } } } },
      orderBy: { name: 'asc' },
    });
    res.json({ routes });
  } catch (err) {
    next(err);
  }
};

exports.myAllocation = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    const allocation = await prisma.transportAllocation.findUnique({
      where: { studentId: student.id },
      include: { route: true },
    });
    res.json({ allocation });
  } catch (err) {
    next(err);
  }
};

exports.enroll = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const { routeId } = req.body;
    if (!routeId) return res.status(400).json({ message: 'routeId is required' });

    const route = await prisma.transportRoute.findUnique({ where: { id: routeId } });
    if (!route) return res.status(404).json({ message: 'Route not found' });

    const existing = await prisma.transportAllocation.findUnique({ where: { studentId: student.id } });
    if (existing && existing.status === 'ACTIVE') {
      return res.status(409).json({ message: 'You are already enrolled in a route. Leave it first.' });
    }

    const allocation = existing
      ? await prisma.transportAllocation.update({
          where: { studentId: student.id },
          data: { routeId, status: 'ACTIVE', createdAt: new Date() },
          include: { route: true },
        })
      : await prisma.transportAllocation.create({
          data: { routeId, studentId: student.id, status: 'ACTIVE' },
          include: { route: true },
        });

    logAudit('TRANSPORT_ENROLLED', { userId: req.user.id, entity: 'TransportAllocation', entityId: allocation.id, ipAddress: req.ip, details: route.name });
    res.status(201).json({ allocation });
  } catch (err) {
    next(err);
  }
};

exports.leave = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const existing = await prisma.transportAllocation.findUnique({ where: { studentId: student.id } });
    if (!existing) return res.status(404).json({ message: 'No transport enrollment found' });

    await prisma.transportAllocation.update({ where: { studentId: student.id }, data: { status: 'LEFT' } });
    logAudit('TRANSPORT_LEFT', { userId: req.user.id, entity: 'TransportAllocation', entityId: existing.id, ipAddress: req.ip });
    res.json({ message: 'Left transport service' });
  } catch (err) {
    next(err);
  }
};

// ---------- Admin ----------
exports.listAll = async (req, res, next) => {
  try {
    const allocations = await prisma.transportAllocation.findMany({
      include: {
        route: { select: { name: true, fare: true } },
        student: { select: { rollNumber: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ allocations });
  } catch (err) {
    next(err);
  }
};

exports.createRoute = async (req, res, next) => {
  try {
    const { name, stops, vehicleNo, fare } = req.body;
    if (!name || !stops || fare === undefined) return res.status(400).json({ message: 'name, stops, fare are required' });
    const route = await prisma.transportRoute.create({
      data: { name, stops, vehicleNo: vehicleNo || null, fare: Number(fare) },
    });
    logAudit('TRANSPORT_ROUTE_CREATED', { userId: req.user.id, entity: 'TransportRoute', entityId: route.id, ipAddress: req.ip, details: name });
    res.status(201).json({ route });
  } catch (err) {
    next(err);
  }
};

exports.updateRoute = async (req, res, next) => {
  try {
    const { name, stops, vehicleNo, fare } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (stops !== undefined) data.stops = stops;
    if (vehicleNo !== undefined) data.vehicleNo = vehicleNo || null;
    if (fare !== undefined) data.fare = Number(fare);
    const route = await prisma.transportRoute.update({ where: { id: req.params.id }, data });
    res.json({ route });
  } catch (err) {
    next(err);
  }
};

exports.deleteRoute = async (req, res, next) => {
  try {
    await prisma.transportRoute.delete({ where: { id: req.params.id } });
    logAudit('TRANSPORT_ROUTE_DELETED', { userId: req.user.id, entity: 'TransportRoute', entityId: req.params.id, ipAddress: req.ip });
    res.json({ message: 'Route deleted' });
  } catch (err) {
    next(err);
  }
};
