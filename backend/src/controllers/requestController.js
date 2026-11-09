const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');
const { notifyUser } = require('../services/notify');

async function getStudent(userId) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    const err = new Error('Student profile not found');
    err.status = 404;
    throw err;
  }
  return student;
}

async function notify(userId, title, body, type = 'INFO', link = null) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, tenantId: true } });
  if (user) await notifyUser(user, { title, body, type, link });
}

async function notifyStudent(studentId, title, body, type = 'INFO', link = null) {
  const s = await prisma.student.findUnique({
    where: { id: studentId },
    select: { userId: true, name: true, user: { select: { id: true, email: true, tenantId: true } } },
  });
  if (!s?.userId) return;
  await notifyUser(s.user, { title, body, type, link, emailTemplate: { name: 'requestUpdate', data: { name: s.name, title, body } } });
  // Also email (fire and forget; dev mode writes to logs/outbox)
}

// ---------- Result Re-check ----------
exports.listMyRechecks = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const rechecks = await prisma.resultRecheck.findMany({
      where: { studentId: student.id },
      include: { enrollment: { include: { section: { include: { course: { select: { courseCode: true, title: true } } } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ rechecks });
  } catch (err) {
    next(err);
  }
};

exports.createRecheck = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { enrollmentId, reason } = req.validated || req.body;

    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, studentId: student.id, status: 'COMPLETED' },
    });
    if (!enrollment) return res.status(400).json({ message: 'Only completed courses can be re-checked' });

    const existing = await prisma.resultRecheck.findFirst({
      where: { studentId: student.id, enrollmentId, status: { in: ['PENDING', 'APPROVED'] } },
    });
    if (existing) return res.status(409).json({ message: 'A re-check request already exists for this course' });

    const recheck = await prisma.resultRecheck.create({
      data: { studentId: student.id, enrollmentId, reason },
    });
    logAudit('CREATE_RECHECK', { userId: req.user.id, entity: 'ResultRecheck', entityId: recheck.id, ipAddress: req.ip, details: reason });
    res.status(201).json({ recheck });
  } catch (err) {
    next(err);
  }
};

exports.listAllRechecks = async (req, res, next) => {
  try {
    const rechecks = await prisma.resultRecheck.findMany({
      include: {
        student: { select: { name: true, rollNumber: true } },
        enrollment: { include: { section: { include: { course: { select: { courseCode: true, title: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ rechecks });
  } catch (err) {
    next(err);
  }
};

exports.resolveRecheck = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const recheck = await prisma.resultRecheck.update({
      where: { id: req.params.id },
      data: { status, adminNote, resolvedAt: new Date() },
    });
    notifyStudent(recheck.studentId, 'Result Re-check Update', `Your re-check request is now ${status}.`, status === 'APPROVED' ? 'INFO' : status === 'REJECTED' ? 'ALERT' : 'SUCCESS');
    logAudit('RESOLVE_RECHECK', { userId: req.user.id, entity: 'ResultRecheck', entityId: recheck.id, ipAddress: req.ip, details: status });
    res.json({ recheck });
  } catch (err) {
    next(err);
  }
};

// ---------- Semester Freeze ----------
exports.listMyFreezes = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const freezes = await prisma.semesterFreeze.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ freezes });
  } catch (err) {
    next(err);
  }
};

exports.createFreeze = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { semester, year, reason } = req.validated || req.body;

    const existing = await prisma.semesterFreeze.findFirst({
      where: { studentId: student.id, semester, year, status: 'PENDING' },
    });
    if (existing) return res.status(409).json({ message: 'A freeze request already exists for this semester' });

    const freeze = await prisma.semesterFreeze.create({
      data: { studentId: student.id, semester, year, reason },
    });
    logAudit('CREATE_FREEZE', { userId: req.user.id, entity: 'SemesterFreeze', entityId: freeze.id, ipAddress: req.ip, details: `Sem ${semester}/${year}` });
    res.status(201).json({ freeze });
  } catch (err) {
    next(err);
  }
};

exports.listAllFreezes = async (req, res, next) => {
  try {
    const freezes = await prisma.semesterFreeze.findMany({
      include: { student: { select: { name: true, rollNumber: true, department: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ freezes });
  } catch (err) {
    next(err);
  }
};

exports.resolveFreeze = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const freeze = await prisma.semesterFreeze.update({
      where: { id: req.params.id },
      data: { status, adminNote, resolvedAt: new Date() },
    });
    notifyStudent(freeze.studentId, 'Semester Freeze Update', `Your freeze request is now ${status}.`, status === 'APPROVED' ? 'INFO' : 'ALERT');
    res.json({ freeze });
  } catch (err) {
    next(err);
  }
};

// ---------- Installments ----------
exports.listMyInstallments = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const requests = await prisma.installmentRequest.findMany({
      where: { studentId: student.id },
      include: { challan: { select: { voucherId: true, totalAmount: true, dueDate: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

exports.createInstallment = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { challanId, plan, reason } = req.validated || req.body;

    const challan = await prisma.feeChallan.findFirst({ where: { id: challanId, studentId: student.id, status: 'UNPAID' } });
    if (!challan) return res.status(400).json({ message: 'Challan not found or already paid' });

    const existing = await prisma.installmentRequest.findFirst({
      where: { studentId: student.id, challanId, status: 'PENDING' },
    });
    if (existing) return res.status(409).json({ message: 'An installment request already exists for this challan' });

    const request = await prisma.installmentRequest.create({
      data: { studentId: student.id, challanId, plan, reason },
    });
    logAudit('CREATE_INSTALLMENT', { userId: req.user.id, entity: 'InstallmentRequest', entityId: request.id, ipAddress: req.ip, details: plan });
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
};

exports.listAllInstallments = async (req, res, next) => {
  try {
    const requests = await prisma.installmentRequest.findMany({
      include: {
        student: { select: { name: true, rollNumber: true } },
        challan: { select: { voucherId: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

exports.resolveInstallment = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const request = await prisma.installmentRequest.update({
      where: { id: req.params.id },
      data: { status, adminNote, resolvedAt: new Date() },
    });
    notifyStudent(request.studentId, 'Installment Request Update', `Your installment request is now ${status}.`, status === 'APPROVED' ? 'SUCCESS' : 'ALERT');
    res.json({ request });
  } catch (err) {
    next(err);
  }
};

// ---------- Refunds ----------
exports.listMyRefunds = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const requests = await prisma.feeRefundRequest.findMany({
      where: { studentId: student.id },
      include: { challan: { select: { voucherId: true, totalAmount: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

exports.createRefund = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { challanId, amount, reason } = req.validated || req.body;

    const challan = await prisma.feeChallan.findFirst({ where: { id: challanId, studentId: student.id, status: 'PAID' } });
    if (!challan) return res.status(400).json({ message: 'Only paid challans can be refunded' });
    if (amount > Number(challan.totalAmount)) return res.status(400).json({ message: 'Refund amount exceeds challan total' });

    const request = await prisma.feeRefundRequest.create({
      data: { studentId: student.id, challanId, amount, reason },
    });
    logAudit('CREATE_REFUND', { userId: req.user.id, entity: 'FeeRefundRequest', entityId: request.id, ipAddress: req.ip, details: `PKR ${amount}` });
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
};

exports.listAllRefunds = async (req, res, next) => {
  try {
    const requests = await prisma.feeRefundRequest.findMany({
      include: {
        student: { select: { name: true, rollNumber: true } },
        challan: { select: { voucherId: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

exports.resolveRefund = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const request = await prisma.feeRefundRequest.update({
      where: { id: req.params.id },
      data: { status, adminNote, resolvedAt: new Date() },
    });
    notifyStudent(request.studentId, 'Fee Refund Update', `Your refund request is now ${status}.`, status === 'APPROVED' ? 'SUCCESS' : 'ALERT');
    res.json({ request });
  } catch (err) {
    next(err);
  }
};

// ---------- Scholarships ----------
exports.listScholarships = async (req, res, next) => {
  try {
    const scholarships = await prisma.scholarship.findMany({
      where: { isActive: true, deadline: { gte: new Date() } },
      orderBy: { deadline: 'asc' },
    });
    res.json({ scholarships });
  } catch (err) {
    next(err);
  }
};

exports.listMyScholarshipApps = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const applications = await prisma.scholarshipApplication.findMany({
      where: { studentId: student.id },
      include: { scholarship: { select: { title: true, amount: true, deadline: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ applications });
  } catch (err) {
    next(err);
  }
};

exports.applyScholarship = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const scholarshipId = req.params.id;
    const { statement } = req.validated || req.body;

    const scholarship = await prisma.scholarship.findFirst({ where: { id: scholarshipId, isActive: true } });
    if (!scholarship) return res.status(404).json({ message: 'Scholarship not found' });
    if (new Date(scholarship.deadline) < new Date()) return res.status(400).json({ message: 'Application deadline has passed' });

    const existing = await prisma.scholarshipApplication.findUnique({
      where: { scholarshipId_studentId: { scholarshipId, studentId: student.id } },
    });
    if (existing) return res.status(409).json({ message: 'You have already applied for this scholarship' });

    const transcript = await prisma.semesterRecord.findMany({ where: { studentId: student.id }, orderBy: { semester: 'desc' } });
    const cgpa = transcript[0]?.cgpa || 0;

    const application = await prisma.scholarshipApplication.create({
      data: { scholarshipId, studentId: student.id, cgpa, statement },
    });
    logAudit('APPLY_SCHOLARSHIP', { userId: req.user.id, entity: 'ScholarshipApplication', entityId: application.id, ipAddress: req.ip, details: scholarship.title });
    res.status(201).json({ application });
  } catch (err) {
    next(err);
  }
};

exports.listAllScholarshipApps = async (req, res, next) => {
  try {
    const applications = await prisma.scholarshipApplication.findMany({
      include: {
        student: { select: { name: true, rollNumber: true, department: true } },
        scholarship: { select: { title: true, amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ applications });
  } catch (err) {
    next(err);
  }
};

exports.resolveScholarshipApp = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const application = await prisma.scholarshipApplication.update({
      where: { id: req.params.id },
      data: { status, adminNote, resolvedAt: new Date() },
    });
    notifyStudent(application.studentId, 'Scholarship Application Update', `Your application is now ${status}.`, status === 'APPROVED' ? 'SUCCESS' : 'ALERT');
    res.json({ application });
  } catch (err) {
    next(err);
  }
};

exports.adminCreateScholarship = async (req, res, next) => {
  try {
    const d = req.validated || req.body;
    const scholarship = await prisma.scholarship.create({
      data: {
        title: d.title,
        description: d.description,
        amount: d.amount,
        eligibility: d.eligibility,
        deadline: new Date(d.deadline),
      },
    });
    res.status(201).json({ scholarship });
  } catch (err) {
    next(err);
  }
};

exports.adminListScholarships = async (req, res, next) => {
  try {
    const scholarships = await prisma.scholarship.findMany({
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ scholarships });
  } catch (err) {
    next(err);
  }
};

// ---------- Certificates ----------
exports.listMyCertificates = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const requests = await prisma.certificateRequest.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

exports.createCertificateRequest = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { type } = req.validated || req.body;

    const existing = await prisma.certificateRequest.findFirst({
      where: { studentId: student.id, type, status: { in: ['PENDING', 'APPROVED'] } },
    });
    if (existing) return res.status(409).json({ message: `A ${type} request is already in progress` });

    const request = await prisma.certificateRequest.create({
      data: { studentId: student.id, type },
    });
    logAudit('CREATE_CERT_REQUEST', { userId: req.user.id, entity: 'CertificateRequest', entityId: request.id, ipAddress: req.ip, details: type });
    res.status(201).json({ request });
  } catch (err) {
    next(err);
  }
};

exports.listAllCertRequests = async (req, res, next) => {
  try {
    const requests = await prisma.certificateRequest.findMany({
      include: { student: { select: { name: true, rollNumber: true, department: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (err) {
    next(err);
  }
};

exports.resolveCertRequest = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!['APPROVED', 'REJECTED', 'ISSUED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const request = await prisma.certificateRequest.update({
      where: { id: req.params.id },
      data: {
        status,
        adminNote,
        resolvedAt: new Date(),
        issuedAt: status === 'ISSUED' ? new Date() : undefined,
      },
    });
    notifyStudent(request.studentId, 'Certificate Request Update', `Your ${request.type} request is now ${status}.`, status === 'REJECTED' ? 'ALERT' : 'SUCCESS');
    res.json({ request });
  } catch (err) {
    next(err);
  }
};

// ---------- Bank Payment Proof ----------
exports.createBankProof = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { challanId, reference } = req.validated || req.body;

    const challan = await prisma.feeChallan.findFirst({ where: { id: challanId, studentId: student.id } });
    if (!challan) return res.status(404).json({ message: 'Challan not found' });

    const proof = await prisma.bankPaymentProof.create({
      data: {
        challanId,
        studentId: student.id,
        reference,
        fileName: req.file?.originalname || null,
        filePath: req.file?.filename || null,
      },
    });
    logAudit('BANK_PROOF', { userId: req.user.id, entity: 'BankPaymentProof', entityId: proof.id, ipAddress: req.ip, details: reference });
    res.status(201).json({ proof, message: 'Payment proof submitted for verification' });
  } catch (err) {
    next(err);
  }
};

exports.listMyBankProofs = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const proofs = await prisma.bankPaymentProof.findMany({
      where: { studentId: student.id },
      include: { challan: { select: { voucherId: true, totalAmount: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ proofs });
  } catch (err) {
    next(err);
  }
};

exports.listAllBankProofs = async (req, res, next) => {
  try {
    const proofs = await prisma.bankPaymentProof.findMany({
      include: {
        student: { select: { name: true, rollNumber: true } },
        challan: { select: { voucherId: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ proofs });
  } catch (err) {
    next(err);
  }
};

exports.resolveBankProof = async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!['VERIFIED', 'REJECTED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const proof = await prisma.bankPaymentProof.update({
      where: { id: req.params.id },
      data: { status, adminNote, verifiedAt: new Date() },
    });

    if (status === 'VERIFIED') {
      await prisma.feeChallan.update({
        where: { id: proof.challanId },
        data: { status: 'PAID', paidAt: new Date() },
      });
      await prisma.payment.create({
        data: {
          challanId: proof.challanId,
          studentId: proof.studentId,
          amount: (await prisma.feeChallan.findUnique({ where: { id: proof.challanId } })).totalAmount,
          method: 'BANK',
          reference: `BANK-${proof.reference}`,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      }).catch(() => {});
    }

    notifyStudent(proof.studentId, 'Bank Payment Update', `Your payment proof is ${status}.`, status === 'VERIFIED' ? 'SUCCESS' : 'ALERT');
    res.json({ proof });
  } catch (err) {
    next(err);
  }
};

// ---------- Degree Audit ----------
exports.degreeAudit = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);

    const completed = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'COMPLETED', gradeLetter: { not: null } },
      include: { section: { include: { course: true } } },
    });

    const inProgress = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'REGISTERED' },
      include: { section: { include: { course: true } } },
    });

    const totalCredits = 133;
    const creditsCompleted = completed.reduce((s, e) => s + (e.section.course.creditHours || 0), 0);
    const creditsInProgress = inProgress.reduce((s, e) => s + (e.section.course.creditHours || 0), 0);
    const creditsRemaining = Math.max(0, totalCredits - creditsCompleted - creditsInProgress);

    const allCourses = await prisma.course.findMany({ select: { id: true, courseCode: true, title: true, creditHours: true, department: true } });
    const completedCourseIds = completed.map((e) => e.section.courseId);
    const remainingCourses = allCourses
      .filter((c) => !completedCourseIds.includes(c.id) && !inProgress.some((e) => e.section.courseId === c.id))
      .slice(0, 30);

    const transcript = await prisma.semesterRecord.findMany({ where: { studentId: student.id }, orderBy: { semester: 'asc' } });
    const cgpa = transcript.length ? transcript[transcript.length - 1].cgpa : 0;

    let standing = 'Good Standing';
    if (cgpa < 2.0 && cgpa > 0) standing = 'Academic Probation';
    else if (cgpa < 2.5 && cgpa >= 2.0) standing = 'Academic Warning';
    else if (cgpa >= 3.8) standing = "Dean's List";

    res.json({
      student: { rollNumber: student.rollNumber, name: student.name, degree: student.degree, batch: student.batch, currentSemester: student.currentSemester },
      totalCredits,
      creditsCompleted,
      creditsInProgress,
      creditsRemaining,
      cgpa,
      standing,
      completed: completed.map((e) => ({
        courseCode: e.section.course.courseCode,
        title: e.section.course.title,
        creditHours: e.section.course.creditHours,
        grade: e.gradeLetter,
        gradePoints: e.gradePoints,
        semester: e.semester,
      })),
      inProgress: inProgress.map((e) => ({
        courseCode: e.section.course.courseCode,
        title: e.section.course.title,
        creditHours: e.section.course.creditHours,
        semester: e.semester,
      })),
      remainingCourses,
    });
  } catch (err) {
    next(err);
  }
};
