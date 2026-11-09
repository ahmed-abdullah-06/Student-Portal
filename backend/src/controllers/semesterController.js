const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');

exports.listSemesters = async (req, res, next) => {
  try {
    const semesters = await prisma.semester.findMany({ orderBy: [{ year: 'desc' }, { term: 'asc' }] });
    res.json({ semesters });
  } catch (err) {
    next(err);
  }
};

exports.createSemester = async (req, res, next) => {
  try {
    const d = req.validated || req.body;
    const toDt = (s) => (s ? new Date(s) : null);
    const semester = await prisma.semester.create({
      data: {
        name: d.name,
        year: d.year,
        term: d.term,
        registrationOpen: toDt(d.registrationOpen),
        registrationClose: toDt(d.registrationClose),
        evaluationOpen: toDt(d.evaluationOpen),
        evaluationClose: toDt(d.evaluationClose),
        resultPublishDate: toDt(d.resultPublishDate),
        feeDueDate: toDt(d.feeDueDate),
      },
    });
    logAudit('CREATE_SEMESTER', { userId: req.user.id, entity: 'Semester', entityId: semester.id, ipAddress: req.ip, details: semester.name });
    res.status(201).json({ semester });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Semester name already exists' });
    next(err);
  }
};

exports.updateSemester = async (req, res, next) => {
  try {
    const d = req.validated || req.body;
    const toDt = (s) => (s ? new Date(s) : undefined);
    const data = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.year !== undefined) data.year = d.year;
    if (d.term !== undefined) data.term = d.term;
    if (d.registrationOpen !== undefined) data.registrationOpen = toDt(d.registrationOpen);
    if (d.registrationClose !== undefined) data.registrationClose = toDt(d.registrationClose);
    if (d.evaluationOpen !== undefined) data.evaluationOpen = toDt(d.evaluationOpen);
    if (d.evaluationClose !== undefined) data.evaluationClose = toDt(d.evaluationClose);
    if (d.resultPublishDate !== undefined) data.resultPublishDate = toDt(d.resultPublishDate);
    if (d.feeDueDate !== undefined) data.feeDueDate = toDt(d.feeDueDate);
    if (d.isCurrent !== undefined) data.isCurrent = d.isCurrent;
    if (d.isActive !== undefined) data.isActive = d.isActive;

    if (d.isCurrent === true) {
      await prisma.semester.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    }

    const semester = await prisma.semester.update({ where: { id: req.params.id }, data });
    res.json({ semester });
  } catch (err) {
    next(err);
  }
};

exports.deleteSemester = async (req, res, next) => {
  try {
    await prisma.semester.delete({ where: { id: req.params.id } });
    res.json({ message: 'Semester deleted' });
  } catch (err) {
    next(err);
  }
};

exports.listExams = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.semesterId) where.semesterId = req.query.semesterId;
    if (req.query.type) where.type = req.query.type;
    const exams = await prisma.examSchedule.findMany({
      where,
      include: {
        section: { include: { course: { select: { courseCode: true, title: true, creditHours: true } }, faculty: { select: { name: true } } } },
        semester: { select: { id: true, name: true, isCurrent: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    res.json({ exams });
  } catch (err) {
    next(err);
  }
};

exports.createExam = async (req, res, next) => {
  try {
    const d = req.validated || req.body;
    const exam = await prisma.examSchedule.create({
      data: {
        sectionId: d.sectionId,
        semesterId: d.semesterId,
        type: d.type,
        date: new Date(d.date),
        startTime: d.startTime,
        endTime: d.endTime,
        room: d.room || null,
      },
    });
    res.status(201).json({ exam });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Exam already scheduled for this section and type' });
    next(err);
  }
};

exports.deleteExam = async (req, res, next) => {
  try {
    await prisma.examSchedule.delete({ where: { id: req.params.id } });
    res.json({ message: 'Exam removed' });
  } catch (err) {
    next(err);
  }
};

exports.studentDateSheet = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'REGISTERED' },
      select: { sectionId: true },
    });
    const sectionIds = enrollments.map((e) => e.sectionId);

    const exams = await prisma.examSchedule.findMany({
      where: { sectionId: { in: sectionIds } },
      include: {
        section: { include: { course: { select: { courseCode: true, title: true, creditHours: true } } } },
        semester: { select: { name: true, isCurrent: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ student: { rollNumber: student.rollNumber, name: student.name }, exams });
  } catch (err) {
    next(err);
  }
};

exports.admitCard = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const type = req.query.type || 'MIDTERM';
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'REGISTERED' },
      select: { sectionId: true },
    });

    const exams = await prisma.examSchedule.findMany({
      where: { sectionId: { in: enrollments.map((e) => e.sectionId) }, type },
      include: {
        section: { include: { course: { select: { courseCode: true, title: true } }, faculty: { select: { name: true } } } },
        semester: { select: { name: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json({
      student: {
        name: student.name,
        rollNumber: student.rollNumber,
        program: student.degree,
        batch: student.batch,
        department: student.department,
        currentSemester: student.currentSemester,
        photoUrl: student.photoUrl,
      },
      type,
      exams,
    });
  } catch (err) {
    next(err);
  }
};

exports.admitCardPdf = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const type = req.query.type || 'MIDTERM';
    if (!['MIDTERM', 'FINAL'].includes(type)) return res.status(400).json({ message: 'type must be MIDTERM or FINAL' });
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'REGISTERED' },
      select: { sectionId: true },
    });
    const exams = await prisma.examSchedule.findMany({
      where: { sectionId: { in: enrollments.map((e) => e.sectionId) }, type },
      include: { section: { include: { course: { select: { courseCode: true, title: true } } } } },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    const { generateAdmitCardPDF } = require('../utils/certificateGenerator');
    generateAdmitCardPDF(res, {
      student: {
        name: student.name, rollNumber: student.rollNumber, degree: student.degree,
        batch: student.batch, department: student.department, currentSemester: student.currentSemester,
      },
      exams,
      type,
    });
  } catch (err) { next(err); }
};

exports.getEvalWindow = async (req, res, next) => {
  try {
    const semester = Number(req.query.semester) || 5;
    const year = Number(req.query.year) || 2026;
    let win = await prisma.evaluationWindow.findFirst({ where: { semester, year } });
    if (!win) {
      win = { semester, year, isOpen: false };
    }
    res.json({ window: win });
  } catch (err) {
    next(err);
  }
};

exports.setEvalWindow = async (req, res, next) => {
  try {
    const { semester, year, isOpen } = req.body;
    const data = {
      isOpen: !!isOpen,
      openedAt: isOpen ? new Date() : undefined,
      closedAt: isOpen ? undefined : new Date(),
    };
    const existing = await prisma.evaluationWindow.findFirst({
      where: { semester: Number(semester), year: Number(year) },
    });
    const win = existing
      ? await prisma.evaluationWindow.update({ where: { id: existing.id }, data })
      : await prisma.evaluationWindow.create({
          data: { semester: Number(semester), year: Number(year), isOpen: !!isOpen, openedAt: isOpen ? new Date() : null, closedAt: isOpen ? null : new Date() },
        });
    res.json({ window: win });
  } catch (err) {
    next(err);
  }
};
