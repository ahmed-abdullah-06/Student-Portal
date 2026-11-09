const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');

exports.listMine = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });
    const withdrawals = await prisma.courseWithdrawal.findMany({
      where: { studentId: student.id },
      include: { section: { include: { course: { select: { courseCode: true, title: true, creditHours: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ withdrawals });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const { sectionId, reason, comments } = req.body;
    if (!sectionId || !reason) return res.status(400).json({ message: 'sectionId and reason are required' });

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: student.id, sectionId } },
    });
    if (!enrollment || enrollment.status !== 'REGISTERED') {
      return res.status(404).json({ message: 'Active enrollment not found for this section' });
    }
    if (enrollment.isLocked) {
      return res.status(409).json({ message: 'Result is frozen — withdrawal not allowed' });
    }

    const existing = await prisma.courseWithdrawal.findUnique({
      where: { studentId_sectionId: { studentId: student.id, sectionId } },
    });
    if (existing && existing.status === 'PENDING') {
      return res.status(409).json({ message: 'A withdrawal request is already pending for this course' });
    }

    const withdrawal = await prisma.courseWithdrawal.upsert({
      where: { studentId_sectionId: { studentId: student.id, sectionId } },
      update: { reason, comments: comments || null, status: 'PENDING', createdAt: new Date(), resolvedAt: null },
      create: {
        studentId: student.id,
        sectionId,
        semester: enrollment.semester,
        year: enrollment.year,
        reason,
        comments: comments || null,
      },
    });

    logAudit('WITHDRAWAL_REQUESTED', {
      userId: req.user.id,
      entity: 'CourseWithdrawal',
      entityId: withdrawal.id,
      ipAddress: req.ip,
      details: reason,
    });
    res.status(201).json({ withdrawal });
  } catch (err) {
    next(err);
  }
};

exports.listAll = async (req, res, next) => {
  try {
    const withdrawals = await prisma.courseWithdrawal.findMany({
      include: {
        student: { select: { rollNumber: true, name: true, department: true } },
        section: { include: { course: { select: { courseCode: true, title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ withdrawals });
  } catch (err) {
    next(err);
  }
};

exports.resolve = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'status must be APPROVED or REJECTED' });
    }

    const withdrawal = await prisma.courseWithdrawal.findUnique({ where: { id: req.params.id } });
    if (!withdrawal) return res.status(404).json({ message: 'Withdrawal request not found' });

    const updated = await prisma.courseWithdrawal.update({
      where: { id: req.params.id },
      data: { status, resolvedAt: new Date() },
    });

    if (status === 'APPROVED') {
      await prisma.enrollment.updateMany({
        where: { studentId: withdrawal.studentId, sectionId: withdrawal.sectionId, status: 'REGISTERED' },
        data: { status: 'DROPPED' },
      });
    }

    logAudit(`WITHDRAWAL_${status}`, {
      userId: req.user.id,
      entity: 'CourseWithdrawal',
      entityId: withdrawal.id,
      ipAddress: req.ip,
    });
    res.json({ withdrawal: updated });
  } catch (err) {
    next(err);
  }
};
