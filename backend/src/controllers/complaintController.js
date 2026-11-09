const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');

exports.listMine = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    const complaints = await prisma.complaint.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ complaints });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const { category, subject, description } = req.body;
    if (!category || !subject || !description) {
      return res.status(400).json({ message: 'category, subject and description are required' });
    }

    const complaint = await prisma.complaint.create({
      data: { studentId: student.id, category, subject, description },
    });

    logAudit('COMPLAINT_CREATED', {
      userId: req.user.id,
      entity: 'Complaint',
      entityId: complaint.id,
      ipAddress: req.ip,
      details: subject,
    });
    res.status(201).json({ complaint });
  } catch (err) {
    next(err);
  }
};

exports.listAll = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = status ? { status } : {};
    const complaints = await prisma.complaint.findMany({
      where,
      include: { student: { select: { rollNumber: true, name: true, department: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ complaints });
  } catch (err) {
    next(err);
  }
};

exports.resolve = async (req, res, next) => {
  try {
    const { resolution } = req.body;
    const complaint = await prisma.complaint.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolution: resolution || null },
    });
    logAudit('COMPLAINT_RESOLVED', {
      userId: req.user.id,
      entity: 'Complaint',
      entityId: complaint.id,
      ipAddress: req.ip,
    });
    res.json({ complaint });
  } catch (err) {
    next(err);
  }
};
