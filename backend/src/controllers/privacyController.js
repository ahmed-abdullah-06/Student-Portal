const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');

async function collectStudentData(studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { id: true, email: true, role: true, createdAt: true } } },
  });
  if (!student) return null;
  const [enrollments, records, challans, complaints, requests] = await Promise.all([
    prisma.enrollment.findMany({ where: { studentId }, include: { section: { include: { course: true } } } }),
    prisma.semesterRecord.findMany({ where: { studentId } }),
    prisma.feeChallan.findMany({ where: { studentId } }),
    prisma.complaint.findMany({ where: { studentId } }),
    prisma.certificateRequest.findMany({ where: { studentId } }),
  ]);
  return { exportedAt: new Date().toISOString(), student, enrollments, semesterRecords: records, challans, complaints, certificateRequests: requests };
}

exports.exportOwnData = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id }, select: { id: true } });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const data = await collectStudentData(student.id);
    res.setHeader('Content-Disposition', 'attachment; filename="student-data-export.json"');
    res.json(data);
  } catch (err) { next(err); }
};

exports.exportStudentData = async (req, res, next) => {
  try {
    const data = await collectStudentData(req.params.id);
    if (!data) return res.status(404).json({ message: 'Student not found' });
    logAudit('EXPORT_STUDENT_DATA', { userId: req.user.id, entity: 'Student', entityId: req.params.id, ipAddress: req.ip, details: 'Admin data export' });
    res.setHeader('Content-Disposition', `attachment; filename="student-${req.params.id}-data.json"`);
    res.json(data);
  } catch (err) { next(err); }
};

exports.anonymizeStudent = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true } });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const marker = crypto.randomBytes(8).toString('hex');
    const disabledPassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: student.userId },
        data: {
          email: `deleted-${marker}@invalid.local`,
          password: disabledPassword,
          isActive: false,
          twoFactorSecret: null,
          tokenVersion: { increment: 1 },
        },
      }),
      prisma.student.update({
        where: { id: student.id },
        data: {
          name: 'Anonymized Student',
          cnic: null, phone: null, address: null, permanentAddress: null,
          guardianName: null, guardianPhone: null, emergencyContactName: null,
          emergencyContactPhone: null, photoUrl: null,
        },
      }),
    ]);
    logAudit('ANONYMIZE_STUDENT', { userId: req.user.id, entity: 'Student', entityId: req.params.id, ipAddress: req.ip, details: 'Personal data anonymized by administrator' });
    res.json({ message: 'Student personal data anonymized and account disabled' });
  } catch (err) { next(err); }
};
