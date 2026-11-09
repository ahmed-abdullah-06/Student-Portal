const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');

exports.listCampuses = async (req, res, next) => {
  try {
    const campuses = await prisma.campus.findMany({ orderBy: { name: 'asc' } });
    res.json({ campuses });
  } catch (err) { next(err); }
};

exports.createCampus = async (req, res, next) => {
  try {
    const { name, city, address } = req.body;
    const campus = await prisma.campus.create({ data: { name, city, address } });
    logAudit('CREATE_CAMPUS', { userId: req.user.id, entity: 'Campus', entityId: campus.id, ipAddress: req.ip, details: name });
    res.status(201).json({ campus });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Campus already exists' });
    next(err);
  }
};

exports.updateCampus = async (req, res, next) => {
  try {
    const { name, city, address, isActive } = req.body;
    const data = {};
    if (name) data.name = name;
    if (city) data.city = city;
    if (address !== undefined) data.address = address;
    if (isActive !== undefined) data.isActive = isActive;
    const campus = await prisma.campus.update({ where: { id: req.params.id }, data });
    res.json({ campus });
  } catch (err) { next(err); }
};

exports.listDepartments = async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    res.json({ departments });
  } catch (err) { next(err); }
};

exports.createDepartment = async (req, res, next) => {
  try {
    const { name, code } = req.body;
    const department = await prisma.department.create({ data: { name, code } });
    logAudit('CREATE_DEPARTMENT', { userId: req.user.id, entity: 'Department', entityId: department.id, ipAddress: req.ip, details: name });
    res.status(201).json({ department });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Department already exists' });
    next(err);
  }
};

exports.updateDepartment = async (req, res, next) => {
  try {
    const { name, code, isActive } = req.body;
    const data = {};
    if (name) data.name = name;
    if (code) data.code = code;
    if (isActive !== undefined) data.isActive = isActive;
    const department = await prisma.department.update({ where: { id: req.params.id }, data });
    res.json({ department });
  } catch (err) { next(err); }
};

exports.listPrograms = async (req, res, next) => {
  try {
    const programs = await prisma.program.findMany({
      include: { campus: { select: { name: true } }, department: { select: { name: true } } },
      orderBy: { code: 'asc' },
    });
    res.json({ programs });
  } catch (err) { next(err); }
};

exports.createProgram = async (req, res, next) => {
  try {
    const { name, code, degreeLevel, totalCredits, campusId, departmentId } = req.body;
    const program = await prisma.program.create({
      data: {
        name,
        code,
        degreeLevel,
        totalCredits: totalCredits || 133,
        campusId: campusId || null,
        departmentId: departmentId || null,
      },
    });
    logAudit('CREATE_PROGRAM', { userId: req.user.id, entity: 'Program', entityId: program.id, ipAddress: req.ip, details: code });
    res.status(201).json({ program });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'Program already exists' });
    next(err);
  }
};

exports.updateProgram = async (req, res, next) => {
  try {
    const { name, degreeLevel, totalCredits, campusId, departmentId, isActive } = req.body;
    const data = {};
    if (name) data.name = name;
    if (degreeLevel) data.degreeLevel = degreeLevel;
    if (totalCredits) data.totalCredits = totalCredits;
    if (campusId !== undefined) data.campusId = campusId;
    if (departmentId !== undefined) data.departmentId = departmentId;
    if (isActive !== undefined) data.isActive = isActive;
    const program = await prisma.program.update({ where: { id: req.params.id }, data });
    res.json({ program });
  } catch (err) { next(err); }
};

// ---------- Reports / CSV ----------
function toCsv(rows, columns) {
  const headers = columns || (rows.length ? Object.keys(rows[0]) : []);
  if (!headers.length) return '';
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

exports.attendanceReport = async (req, res, next) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { status: { not: 'DROPPED' } },
      include: {
        student: { select: { rollNumber: true, name: true, department: true } },
        section: { include: { course: { select: { courseCode: true, title: true } } } },
        attendance: { select: { status: true } },
      },
    });
    const rows = enrollments.map((e) => {
      const total = e.attendance.length;
      const attended = e.attendance.filter((a) => a.status === 'PRESENT').length;
      const pct = total ? Math.round((attended / total) * 100) : 0;
      return {
        rollNumber: e.student.rollNumber,
        name: e.student.name,
        department: e.student.department,
        courseCode: e.section.course.courseCode,
        courseTitle: e.section.course.title,
        semester: e.semester,
        totalLectures: total,
        attended,
        percentage: pct,
        deficient: pct < 75 ? 'YES' : 'NO',
      };
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance-report.csv');
    res.send(toCsv(rows, ['rollNumber', 'name', 'department', 'courseCode', 'courseTitle', 'semester', 'totalLectures', 'attended', 'percentage', 'deficient']));
  } catch (err) { next(err); }
};

exports.feeDefaulterReport = async (req, res, next) => {
  try {
    const challans = await prisma.feeChallan.findMany({
      where: { status: 'UNPAID', dueDate: { lt: new Date() } },
      include: { student: { select: { rollNumber: true, name: true, department: true, phone: true } } },
      orderBy: { dueDate: 'asc' },
    });
    const rows = challans.map((c) => ({
      voucherId: c.voucherId,
      rollNumber: c.student.rollNumber,
      name: c.student.name,
      department: c.student.department,
      phone: c.student.phone || '',
      semester: c.semester,
      amount: c.totalAmount,
      dueDate: c.dueDate.toISOString().slice(0, 10),
      daysOverdue: Math.floor((Date.now() - new Date(c.dueDate)) / 86400000),
    }));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=fee-defaulters.csv');
    res.send(toCsv(rows, ['voucherId', 'rollNumber', 'name', 'department', 'phone', 'semester', 'amount', 'dueDate', 'daysOverdue']));
  } catch (err) { next(err); }
};

exports.resultGazette = async (req, res, next) => {
  try {
    const semester = Number(req.query.semester) || undefined;
    const where = { status: 'COMPLETED', gradeLetter: { not: null } };
    if (semester) where.semester = semester;
    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        student: { select: { rollNumber: true, name: true, department: true } },
        section: { include: { course: { select: { courseCode: true, title: true, creditHours: true } } } },
      },
    });
    const rows = enrollments.map((e) => ({
      rollNumber: e.student.rollNumber,
      name: e.student.name,
      department: e.student.department,
      semester: e.semester,
      courseCode: e.section.course.courseCode,
      courseTitle: e.section.course.title,
      creditHours: e.section.course.creditHours,
      totalMarks: e.totalMarks,
      grade: e.gradeLetter,
      gradePoints: e.gradePoints,
    }));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=result-gazette.csv');
    res.send(toCsv(rows, ['rollNumber', 'name', 'department', 'semester', 'courseCode', 'courseTitle', 'creditHours', 'totalMarks', 'grade', 'gradePoints']));
  } catch (err) { next(err); }
};

exports.enrollmentReport = async (req, res, next) => {
  try {
    const sections = await prisma.section.findMany({
      include: {
        course: { select: { courseCode: true, title: true, creditHours: true } },
        faculty: { select: { name: true } },
        _count: { select: { enrollments: { where: { status: 'REGISTERED' } } } },
      },
      orderBy: [{ semester: 'desc' }, { year: 'desc' }],
    });
    const rows = sections.map((s) => ({
      courseCode: s.course.courseCode,
      courseTitle: s.course.title,
      section: s.name,
      semester: s.semester,
      year: s.year,
      faculty: s.faculty?.name || 'Unassigned',
      capacity: s.capacity,
      enrolled: s._count.enrollments,
      seatsLeft: s.capacity - s._count.enrollments,
    }));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=enrollment-report.csv');
    res.send(toCsv(rows, ['courseCode', 'courseTitle', 'section', 'semester', 'year', 'faculty', 'capacity', 'enrolled', 'seatsLeft']));
  } catch (err) { next(err); }
};
