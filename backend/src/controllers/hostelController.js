const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');

exports.myAllocation = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    const allocation = await prisma.hostelAllocation.findUnique({ where: { studentId: student.id } });
    res.json({ allocation });
  } catch (err) {
    next(err);
  }
};

exports.apply = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const existing = await prisma.hostelAllocation.findUnique({ where: { studentId: student.id } });
    if (existing && existing.status !== 'RELEASED') {
      return res.status(409).json({ message: 'You already have an active or pending hostel application' });
    }

    const { block, roomNo } = req.body;
    if (!block || !roomNo) return res.status(400).json({ message: 'block and roomNo are required' });

    const allocation = existing
      ? await prisma.hostelAllocation.update({
          where: { studentId: student.id },
          data: { block, roomNo, status: 'REQUESTED', messCharges: Number(req.body.messCharges) || 18000, allocatedAt: new Date() },
        })
      : await prisma.hostelAllocation.create({
          data: {
            studentId: student.id,
            block,
            roomNo,
            status: 'REQUESTED',
            messCharges: Number(req.body.messCharges) || 18000,
          },
        });

    logAudit('HOSTEL_APPLIED', { userId: req.user.id, entity: 'HostelAllocation', entityId: allocation.id, ipAddress: req.ip, details: `${block}/${roomNo}` });
    res.status(201).json({ allocation });
  } catch (err) {
    next(err);
  }
};

exports.listAll = async (req, res, next) => {
  try {
    const allocations = await prisma.hostelAllocation.findMany({
      include: { student: { select: { rollNumber: true, name: true, department: true } } },
      orderBy: { allocatedAt: 'desc' },
    });
    res.json({ allocations });
  } catch (err) {
    next(err);
  }
};

exports.approve = async (req, res, next) => {
  try {
    const allocation = await prisma.hostelAllocation.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE', allocatedAt: new Date() },
      include: { student: { select: { rollNumber: true, name: true } } },
    });
    logAudit('HOSTEL_APPROVED', { userId: req.user.id, entity: 'HostelAllocation', entityId: allocation.id, ipAddress: req.ip, details: allocation.student.rollNumber });
    res.json({ allocation });
  } catch (err) {
    next(err);
  }
};

exports.release = async (req, res, next) => {
  try {
    const allocation = await prisma.hostelAllocation.update({
      where: { id: req.params.id },
      data: { status: 'RELEASED' },
      include: { student: { select: { rollNumber: true } } },
    });
    logAudit('HOSTEL_RELEASED', { userId: req.user.id, entity: 'HostelAllocation', entityId: allocation.id, ipAddress: req.ip, details: allocation.student.rollNumber });
    res.json({ allocation });
  } catch (err) {
    next(err);
  }
};

exports.deleteAllocation = async (req, res, next) => {
  try {
    await prisma.hostelAllocation.delete({ where: { id: req.params.id } });
    logAudit('HOSTEL_DELETED', { userId: req.user.id, entity: 'HostelAllocation', entityId: req.params.id, ipAddress: req.ip });
    res.json({ message: 'Allocation removed' });
  } catch (err) {
    next(err);
  }
};
