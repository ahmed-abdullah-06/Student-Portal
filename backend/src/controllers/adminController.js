const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { logAudit } = require('../utils/logger');
const { round2 } = require('../utils/gpaCalculator');
const { parsePagination, pageMeta } = require('../utils/pagination');
const importers = require('../services/importers');
const { sanitizeUser, sanitizeStudent, sanitizeFaculty } = require('../utils/responseSanitizers');

exports.getStats = async (req, res, next) => {
  try {
    const [students, faculty, courses, sections, enrollments, pendingChallans, notices, evaluations] =
      await Promise.all([
        prisma.student.count(),
        prisma.faculty.count(),
        prisma.course.count(),
        prisma.section.count({ where: { isActive: true } }),
        prisma.enrollment.count({ where: { status: 'REGISTERED' } }),
        prisma.feeChallan.count({ where: { status: 'UNPAID' } }),
        prisma.notice.count(),
        prisma.teacherEvaluation.count(),
      ]);

    const revenue = await prisma.feeChallan.aggregate({
      where: { status: 'PAID' },
      _sum: { totalAmount: true },
    });

    res.json({
      stats: {
        students,
        faculty,
        courses,
        sections,
        enrollments,
        pendingChallans,
        notices,
        evaluations,
        collectedFees: round2(revenue._sum.totalAmount || 0),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [enrollmentTrend, feeBreakdown, gpaDistribution, activeUsers, registrationStarted, registrationCompleted] = await Promise.all([
      prisma.enrollment.groupBy({
        by: ['semester'],
        _count: { _all: true },
        orderBy: { semester: 'asc' },
      }),
      prisma.feeChallan.groupBy({
        by: ['status'],
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.semesterRecord.groupBy({
        by: ['semester'],
        _avg: { cgpa: true },
        _count: { _all: true },
        orderBy: { semester: 'asc' },
      }),
      prisma.userSession.count({ where: { lastSeenAt: { gte: since } } }),
      prisma.auditLog.count({ where: { action: 'COURSE_REGISTRATION_STARTED', createdAt: { gte: since } } }),
      prisma.auditLog.count({ where: { action: 'COURSE_REGISTERED', createdAt: { gte: since } } }),
    ]);
    res.json({
      analytics: {
        enrollmentTrend: enrollmentTrend.map((row) => ({ semester: row.semester, count: row._count._all })),
        feeBreakdown: feeBreakdown.map((row) => ({ status: row.status, count: row._count._all, amount: row._sum.totalAmount || 0 })),
        gpaDistribution: gpaDistribution.map((row) => ({ semester: row.semester, averageCgpa: round2(row._avg.cgpa || 0), students: row._count._all })),
        activeUsers30d: activeUsers,
        registrationFunnel: { started: registrationStarted, completed: registrationCompleted },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---------- Users ----------
exports.listStudents = async (req, res, next) => {
  try {
    const { skip, take, search, sort, order } = parsePagination(req, { sortable: ['rollNumber', 'name', 'batch', 'currentSemester', 'createdAt'] });
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { rollNumber: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { user: { select: { email: true, isActive: true, permissions: true, twoFactorEnabled: true } } },
        orderBy: { [sort || 'rollNumber']: order },
        skip,
        take,
      }),
      prisma.student.count({ where }),
    ]);
    res.json({ students: students.map(sanitizeStudent), pagination: pageMeta({ page: skip / take + 1, limit: take, total }) });
  } catch (err) {
    next(err);
  }
};

exports.listFaculty = async (req, res, next) => {
  try {
    const { skip, take, search, sort, order } = parsePagination(req, { sortable: ['employeeId', 'name', 'department', 'designation', 'createdAt'] });
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { employeeId: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const [faculty, total] = await Promise.all([
      prisma.faculty.findMany({
        where,
        include: { user: { select: { email: true, isActive: true, permissions: true, twoFactorEnabled: true } } },
        orderBy: { [sort || 'employeeId']: order },
        skip,
        take,
      }),
      prisma.faculty.count({ where }),
    ]);
    res.json({ faculty: faculty.map(sanitizeFaculty), pagination: pageMeta({ page: skip / take + 1, limit: take, total }) });
  } catch (err) {
    next(err);
  }
};

exports.listUsers = async (req, res, next) => {
  try {
    const { skip, take, search } = parsePagination(req, { sortable: ['createdAt', 'email', 'role'] });
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { role: { equals: search.toUpperCase() } },
          ],
        }
      : undefined;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, email: true, role: true, isActive: true, createdAt: true,
          permissions: true, twoFactorEnabled: true,
          student: { select: { rollNumber: true, name: true } },
          faculty: { select: { employeeId: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users: users.map(sanitizeUser), pagination: pageMeta({ page: skip / take + 1, limit: take, total }) });
  } catch (err) {
    next(err);
  }
};

// ---------- Bulk administration, global search and student activity ----------
exports.bulkUpdateUsers = async (req, res, next) => {
  try {
    const { userIds, isActive } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 500) {
      return res.status(400).json({ message: 'userIds must contain between 1 and 500 users' });
    }
    if (typeof isActive !== 'boolean') return res.status(400).json({ message: 'isActive must be a boolean' });
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { isActive, tokenVersion: { increment: 1 } },
    });
    logAudit('USERS_BULK_STATUS', { userId: req.user.id, entity: 'User', ipAddress: req.ip, details: JSON.stringify({ requested: userIds.length, updated: result.count, isActive }) });
    res.json({ updated: result.count, isActive });
  } catch (err) { next(err); }
};

exports.bulkResetPasswords = async (req, res, next) => {
  try {
    const { userIds, password } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 200) {
      return res.status(400).json({ message: 'userIds must contain between 1 and 200 users' });
    }
    if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
      return res.status(400).json({ message: 'password must be at least 8 characters when supplied' });
    }
    const temporaryPassword = password || `${require('crypto').randomBytes(9).toString('base64url')}A1!`;
    const hash = await bcrypt.hash(temporaryPassword, 12);
    const result = await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { password: hash, mustChangePassword: true, tokenVersion: { increment: 1 } },
    });
    logAudit('USERS_BULK_PASSWORD_RESET', { userId: req.user.id, entity: 'User', ipAddress: req.ip, details: JSON.stringify({ requested: userIds.length, updated: result.count }) });
    res.json({ updated: result.count, temporaryPassword, mustChangePassword: true });
  } catch (err) { next(err); }
};

exports.bulkTargetNotice = async (req, res, next) => {
  try {
    const { title, body, department, batch, role = 'STUDENT' } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'title and body are required' });
    if (!['STUDENT', 'FACULTY', 'ALL'].includes(role)) return res.status(400).json({ message: 'role must be STUDENT, FACULTY or ALL' });
    const studentWhere = { ...(department ? { department } : {}), ...(batch ? { batch } : {}) };
    const facultyWhere = { ...(department ? { department } : {}) };
    const [students, faculty] = await Promise.all([
      role === 'FACULTY' ? [] : prisma.student.findMany({ where: studentWhere, select: { userId: true } }),
      role === 'STUDENT' ? [] : prisma.faculty.findMany({ where: facultyWhere, select: { userId: true } }),
    ]);
    const userIds = [...students, ...faculty].map((u) => u.userId);
    if (!userIds.length) return res.status(404).json({ message: 'No recipients match the selected target' });
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, title: title.trim(), body: body.trim(), type: 'NOTICE' })),
    });
    const notice = await prisma.notice.create({ data: { title: title.trim(), body: body.trim(), authorId: req.user.id } });
    logAudit('NOTICE_BULK_TARGETED', { userId: req.user.id, entity: 'Notice', entityId: notice.id, ipAddress: req.ip, details: JSON.stringify({ recipients: userIds.length, department, batch, role }) });
    res.status(201).json({ notice, recipients: userIds.length });
  } catch (err) { next(err); }
};

exports.globalSearch = async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.status(400).json({ message: 'q must contain at least 2 characters' });
    const take = Math.min(Number(req.query.limit) || 8, 20);
    const [students, faculty, courses, notices] = await Promise.all([
      prisma.student.findMany({ where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { rollNumber: { contains: q, mode: 'insensitive' } }, { department: { contains: q, mode: 'insensitive' } }] }, take, select: { id: true, name: true, rollNumber: true, department: true } }),
      prisma.faculty.findMany({ where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { employeeId: { contains: q, mode: 'insensitive' } }, { department: { contains: q, mode: 'insensitive' } }] }, take, select: { id: true, name: true, employeeId: true, department: true } }),
      prisma.course.findMany({ where: { OR: [{ courseCode: { contains: q, mode: 'insensitive' } }, { title: { contains: q, mode: 'insensitive' } }] }, take, select: { id: true, courseCode: true, title: true, department: true } }),
      prisma.notice.findMany({ where: { OR: [{ title: { contains: q, mode: 'insensitive' } }, { body: { contains: q, mode: 'insensitive' } }] }, take, select: { id: true, title: true, createdAt: true } }),
    ]);
    res.json({ query: q, results: { students, faculty, courses, notices } });
  } catch (err) { next(err); }
};

exports.getStudentActivity = async (req, res, next) => {
  try {
    const { page, limit, skip, take } = parsePagination(req, { defaultLimit: 25, maxLimit: 100 });
    const student = await prisma.student.findFirst({ where: { OR: [{ id: req.params.id }, { rollNumber: req.params.id }] }, select: { id: true, name: true, rollNumber: true, department: true, batch: true, currentSemester: true, user: { select: { email: true, isActive: true, createdAt: true } } } });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const [enrollments, attendance, records, challans, complaints, withdrawals, rechecks, freezes, installments, refunds, auditLogs] = await Promise.all([
      prisma.enrollment.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' }, skip, take, include: { section: { include: { course: { select: { courseCode: true, title: true } } } } } }),
      prisma.attendanceRecord.findMany({ where: { enrollment: { studentId: student.id } }, orderBy: { date: 'desc' }, skip, take, select: { id: true, date: true, status: true, lectureNumber: true, enrollment: { select: { section: { select: { course: { select: { courseCode: true } } } } } } } }),
      prisma.semesterRecord.findMany({ where: { studentId: student.id }, orderBy: { semester: 'asc' } }),
      prisma.feeChallan.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' } }),
      prisma.complaint.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' } }),
      prisma.courseWithdrawal.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' } }),
      prisma.resultRecheck.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' } }),
      prisma.semesterFreeze.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' } }),
      prisma.installmentRequest.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' } }),
      prisma.feeRefundRequest.findMany({ where: { studentId: student.id }, orderBy: { createdAt: 'desc' } }),
      prisma.auditLog.findMany({ where: { entityId: student.id }, orderBy: { createdAt: 'desc' }, skip, take, select: { id: true, action: true, entity: true, details: true, createdAt: true } }),
    ]);
    const [enrollmentTotal, attendanceTotal, auditTotal] = await Promise.all([
      prisma.enrollment.count({ where: { studentId: student.id } }),
      prisma.attendanceRecord.count({ where: { enrollment: { studentId: student.id } } }),
      prisma.auditLog.count({ where: { entityId: student.id } }),
    ]);
    res.json({ student, activity: { enrollments, attendance, records, challans, complaints, withdrawals, rechecks, freezes, installments, refunds, auditLogs }, pagination: { enrollments: pageMeta({ page, limit, total: enrollmentTotal }), attendance: pageMeta({ page, limit, total: attendanceTotal }), auditLogs: pageMeta({ page, limit, total: auditTotal }) } });
  } catch (err) { next(err); }
};

exports.createStudent = async (req, res, next) => {
  try {
    const { email, password, rollNumber, name, department, batch, currentSemester, degree, cnic, guardianName, phone, address } = req.body;
    if (!email || !password || !rollNumber || !name || !department || !batch) {
      return res.status(400).json({ message: 'email, password, rollNumber, name, department, batch are required' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase().trim(), password: hashed, role: 'STUDENT' },
    });
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        rollNumber: rollNumber.trim().toUpperCase(),
        name: name.trim(),
        department,
        batch,
        degree: degree || 'BS',
        currentSemester: Number(currentSemester) || 1,
        cnic, guardianName, phone, address,
      },
    });

    logAudit('STUDENT_CREATED', { userId: req.user.id, entity: 'Student', entityId: student.id, ipAddress: req.ip, details: rollNumber });
    res.status(201).json({ student });
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk import students from CSV.
 * Columns: email,rollNumber,name,department,batch,password[,degree,currentSemester,cnic,guardianName,phone,address]
 * Returns { created, skipped: [{row, reason}], total }.
 */
exports.importStudents = async (req, res, next) => {
  const fs = require('fs');
  try {
    if (!req.file) return res.status(400).json({ message: 'CSV file is required (field: file)' });
    const raw = req.file.buffer
      ? req.file.buffer.toString('utf8')
      : fs.readFileSync(req.file.path, 'utf8');
    const text = raw.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return res.status(400).json({ message: 'CSV must contain a header row and at least one data row' });

    const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const required = ['email', 'rollnumber', 'name', 'department', 'batch'];
    const missing = required.filter((r) => !headers.includes(r) && !(r === 'rollnumber' && headers.includes('roll_number')));
    if (missing.length) {
      return res.status(400).json({ message: `CSV missing required columns: ${missing.join(', ')}` });
    }

    const created = [];
    const skipped = [];
    const seen = new Set();

    for (let i = 1; i < lines.length; i++) {
      const cells = splitCsvLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => { row[h] = (cells[idx] || '').trim(); });
      const roll = (row.rollnumber || row.roll_number || '').toUpperCase();
      const email = (row.email || '').toLowerCase();

      try {
        if (!email || !roll || !row.name) {
          skipped.push({ row: i + 1, reason: 'email, rollNumber and name are required' });
          continue;
        }
        if (seen.has(roll)) { skipped.push({ row: i + 1, reason: `duplicate rollNumber ${roll} in file` }); continue; }
        seen.add(roll);

        const password = row.password || 'Welcome123';
        const hashed = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
          data: {
            email, password: hashed, role: 'STUDENT',
            mustChangePassword: true,
          },
        });
        const student = await prisma.student.create({
          data: {
            userId: user.id,
            rollNumber: roll,
            name: row.name,
            department: row.department,
            batch: row.batch,
            degree: row.degree || 'BS',
            currentSemester: Number(row.currentsemester) || 1,
            cnic: row.cnic || null,
            guardianName: row.guardianname || null,
            phone: row.phone || null,
            address: row.address || null,
          },
        });
        created.push(student.id);
      } catch (err) {
        if (err.code === 'P2002') skipped.push({ row: i + 1, reason: 'user or rollNumber already exists' });
        else skipped.push({ row: i + 1, reason: err.message.slice(0, 120) });
      }
    }

    logAudit('STUDENTS_IMPORTED', {
      userId: req.user.id, entity: 'Student', ipAddress: req.ip,
      details: `created=${created.length} skipped=${skipped.length}`,
    });
    res.json({ created: created.length, skipped, total: lines.length - 1, defaultPasswordNote: 'Rows without a password use Welcome123 (must change on first login).' });
  } catch (err) {
    next(err);
  } finally {
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch { /* temp cleanup best-effort */ }
  }
};

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Shared runner for CSV migration imports. Accepts `?dryRun=1` for a full
 * validation/conflict report without writing anything.
 */
async function runCsvImport(req, res, next, importer, auditAction) {
  const fs = require('fs');
  try {
    if (!req.file) return res.status(400).json({ message: 'CSV file is required (field: file)' });
    const text = req.file.buffer
      ? req.file.buffer.toString('utf8')
      : fs.readFileSync(req.file.path, 'utf8');
    const dryRun = req.query.dryRun === '1' || req.query.dryRun === 'true';
    const result = await importer(text, { dryRun });

    if (!dryRun) {
      logAudit(auditAction, {
        userId: req.user.id, entity: 'Import', ipAddress: req.ip,
        details: `created=${result.created} updated=${result.updated} skipped=${result.skipped}`,
      });
    }
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    next(err);
  } finally {
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch { /* temp cleanup best-effort */ }
  }
}

exports.importFacultyCsv = (req, res, next) => runCsvImport(req, res, next, importers.importFaculty, 'FACULTY_IMPORTED');
exports.importCoursesCsv = (req, res, next) => runCsvImport(req, res, next, importers.importCourses, 'COURSES_IMPORTED');
exports.importSemesterRecordsCsv = (req, res, next) => runCsvImport(req, res, next, importers.importSemesterRecords, 'SEMESTER_RECORDS_IMPORTED');
exports.importHistoricalGradesCsv = (req, res, next) => runCsvImport(req, res, next, importers.importHistoricalGrades, 'HISTORICAL_GRADES_IMPORTED');

exports.createFaculty = async (req, res, next) => {
  try {
    const { email, password, employeeId, name, designation, department, phone } = req.body;
    if (!email || !password || !employeeId || !name || !designation || !department) {
      return res.status(400).json({ message: 'email, password, employeeId, name, designation, department are required' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase().trim(), password: hashed, role: 'FACULTY' },
    });
    const faculty = await prisma.faculty.create({
      data: { userId: user.id, employeeId: employeeId.trim().toUpperCase(), name: name.trim(), designation, department, phone },
    });

    logAudit('FACULTY_CREATED', { userId: req.user.id, entity: 'Faculty', entityId: faculty.id, ipAddress: req.ip, details: employeeId });
    res.status(201).json({ faculty });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { isActive, password } = req.body;
    const data = {};
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (password) data.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    logAudit('USER_UPDATED', { userId: req.user.id, entity: 'User', entityId: user.id, ipAddress: req.ip, details: JSON.stringify({ isActive, passwordChanged: Boolean(password) }) });
    res.json({ user: { id: user.id, email: user.email, isActive: user.isActive, role: user.role } });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { password: await bcrypt.hash(password, 12) },
    });
    logAudit('PASSWORD_RESET', { userId: req.user.id, entity: 'User', entityId: user.id, ipAddress: req.ip, details: user.email });
    res.json({ message: `Password reset for ${user.email}` });
  } catch (err) {
    next(err);
  }
};

// ---------- Courses ----------
exports.listCourses = async (req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      include: { prerequisites: { select: { courseCode: true, title: true } }, _count: { select: { sections: true } } },
      orderBy: { courseCode: 'asc' },
    });
    res.json({ courses });
  } catch (err) {
    next(err);
  }
};

exports.createCourse = async (req, res, next) => {
  try {
    const { courseCode, title, creditHours, department, description, prerequisiteIds } = req.body;
    if (!courseCode || !title || !creditHours || !department) {
      return res.status(400).json({ message: 'courseCode, title, creditHours, department are required' });
    }
    const course = await prisma.course.create({
      data: {
        courseCode: courseCode.trim().toUpperCase(),
        title,
        creditHours: Number(creditHours),
        department,
        description,
        prerequisites: prerequisiteIds?.length ? { connect: prerequisiteIds.map((id) => ({ id })) } : undefined,
      },
      include: { prerequisites: true },
    });
    logAudit('COURSE_CREATED', { userId: req.user.id, entity: 'Course', entityId: course.id, ipAddress: req.ip, details: courseCode });
    res.status(201).json({ course });
  } catch (err) {
    next(err);
  }
};

exports.updateCourse = async (req, res, next) => {
  try {
    const { title, creditHours, department, description, prerequisiteIds } = req.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (creditHours !== undefined) data.creditHours = Number(creditHours);
    if (department !== undefined) data.department = department;
    if (description !== undefined) data.description = description;
    if (prerequisiteIds !== undefined) {
      data.prerequisites = { set: prerequisiteIds.map((id) => ({ id })) };
    }
    const course = await prisma.course.update({ where: { id: req.params.id }, data, include: { prerequisites: true } });
    logAudit('COURSE_UPDATED', { userId: req.user.id, entity: 'Course', entityId: course.id, ipAddress: req.ip });
    res.json({ course });
  } catch (err) {
    next(err);
  }
};

exports.deleteCourse = async (req, res, next) => {
  try {
    await prisma.course.delete({ where: { id: req.params.id } });
    logAudit('COURSE_DELETED', { userId: req.user.id, entity: 'Course', entityId: req.params.id, ipAddress: req.ip });
    res.json({ message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
};

// ---------- Sections & Timetable ----------
exports.listSections = async (req, res, next) => {
  try {
    const sections = await prisma.section.findMany({
      include: {
        course: true,
        faculty: { select: { name: true, employeeId: true } },
        slots: true,
        _count: { select: { enrollments: { where: { status: 'REGISTERED' } } } },
      },
      orderBy: [{ year: 'desc' }, { semester: 'desc' }],
    });
    res.json({ sections });
  } catch (err) {
    next(err);
  }
};

exports.createSection = async (req, res, next) => {
  try {
    const { courseId, facultyId, name, semester, year, capacity } = req.body;
    if (!courseId || !name || !semester || !year) {
      return res.status(400).json({ message: 'courseId, name, semester, year are required' });
    }
    const section = await prisma.section.create({
      data: {
        courseId, facultyId: facultyId || null, name, semester: Number(semester), year: Number(year),
        capacity: Number(capacity) || 60,
      },
      include: { course: true, faculty: true },
    });
    logAudit('SECTION_CREATED', { userId: req.user.id, entity: 'Section', entityId: section.id, ipAddress: req.ip });
    res.status(201).json({ section });
  } catch (err) {
    next(err);
  }
};

exports.updateSection = async (req, res, next) => {
  try {
    const { facultyId, capacity, isActive } = req.body;
    const data = {};
    if (facultyId !== undefined) data.facultyId = facultyId || null;
    if (capacity !== undefined) data.capacity = Number(capacity);
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    const section = await prisma.section.update({ where: { id: req.params.id }, data, include: { course: true, faculty: true } });
    logAudit('SECTION_UPDATED', { userId: req.user.id, entity: 'Section', entityId: section.id, ipAddress: req.ip });
    res.json({ section });
  } catch (err) {
    next(err);
  }
};

exports.setTimetable = async (req, res, next) => {
  try {
    const { slots } = req.body;
    if (!Array.isArray(slots)) return res.status(400).json({ message: 'slots[] is required' });

    const sectionId = req.params.id;
    const section = await prisma.section.findUnique({ where: { id: sectionId }, include: { slots: true } });
    if (!section) return res.status(404).json({ message: 'Section not found' });

    for (const s of slots) {
      if (!s.day || !s.startTime || !s.endTime) {
        return res.status(400).json({ message: 'Each slot needs day, startTime, endTime' });
      }
      const clash = await prisma.timetableSlot.findFirst({
        where: {
          id: { notIn: section.slots.map((x) => x.id) },
          day: s.day,
          room: s.room || null,
          OR: [{ AND: [{ startTime: { lt: s.endTime } }, { endTime: { gt: s.startTime } }] }],
        },
        include: { section: { include: { course: true } } },
      });
      if (clash && s.room) {
        return res.status(409).json({
          message: `Room conflict: ${s.room} already booked on ${s.day} ${s.startTime}-${s.endTime} by ${clash.section.course.courseCode}`,
        });
      }
    }

    await prisma.$transaction([
      prisma.timetableSlot.deleteMany({ where: { sectionId } }),
      prisma.timetableSlot.createMany({
        data: slots.map((s) => ({
          sectionId,
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room || null,
        })),
      }),
    ]);

    logAudit('TIMETABLE_SET', { userId: req.user.id, entity: 'Section', entityId: sectionId, ipAddress: req.ip });
    const updated = await prisma.section.findUnique({ where: { id: sectionId }, include: { slots: true } });
    res.json({ slots: updated.slots });
  } catch (err) {
    next(err);
  }
};

exports.getTimetable = async (req, res, next) => {
  try {
    const slots = await prisma.timetableSlot.findMany({
      include: { section: { include: { course: true, faculty: { select: { name: true } } } } },
      orderBy: [{ day: 'asc' }, { startTime: 'asc' }],
    });
    res.json({
      entries: slots.map((s) => ({
        id: s.id,
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        courseCode: s.section.course.courseCode,
        title: s.section.course.title,
        section: s.section.name,
        faculty: s.section.faculty?.name || 'TBD',
        sectionId: s.sectionId,
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ---------- Fees ----------
exports.getFeeStructures = async (req, res, next) => {
  try {
    const structures = await prisma.feeStructure.findMany({ orderBy: { semester: 'asc' } });
    res.json({ structures });
  } catch (err) {
    next(err);
  }
};

exports.upsertFeeStructure = async (req, res, next) => {
  try {
    const { semester, perCreditHour, labFee, libraryFee, admissionFee, otherFee } = req.body;
    if (!semester || perCreditHour === undefined) {
      return res.status(400).json({ message: 'semester and perCreditHour are required' });
    }
    const existing = await prisma.feeStructure.findFirst({ where: { semester: Number(semester) } });
    const structure = existing
      ? await prisma.feeStructure.update({
          where: { id: existing.id },
          data: {
            perCreditHour: Number(perCreditHour),
            labFee: Number(labFee) || 0,
            libraryFee: Number(libraryFee) || 0,
            admissionFee: Number(admissionFee) || 0,
            otherFee: Number(otherFee) || 0,
          },
        })
      : await prisma.feeStructure.create({
          data: {
            semester: Number(semester),
            perCreditHour: Number(perCreditHour),
            labFee: Number(labFee) || 0,
            libraryFee: Number(libraryFee) || 0,
            admissionFee: Number(admissionFee) || 0,
            otherFee: Number(otherFee) || 0,
          },
        });
    logAudit('FEE_STRUCTURE_UPSERTED', { userId: req.user.id, entity: 'FeeStructure', entityId: structure.id, ipAddress: req.ip });
    res.json({ structure });
  } catch (err) {
    next(err);
  }
};

exports.listChallans = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.semester) where.semester = Number(req.query.semester);
    const challans = await prisma.feeChallan.findMany({
      where,
      include: { student: { select: { rollNumber: true, name: true, department: true } } },
      orderBy: [{ semester: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ challans });
  } catch (err) {
    next(err);
  }
};

exports.generateChallans = async (req, res, next) => {
  try {
    const { semester, dueDate } = req.body;
    if (!semester) return res.status(400).json({ message: 'semester is required' });

    const sem = Number(semester);
    const structure = await prisma.feeStructure.findFirst({ where: { semester: sem } });
    if (!structure) return res.status(400).json({ message: `No fee structure defined for semester ${sem}` });

    const students = await prisma.student.findMany({
      where: { currentSemester: sem },
      include: {
        user: { select: { id: true, email: true } },
        enrollments: { where: { semester: sem, status: { not: 'DROPPED' } }, include: { section: { include: { course: true } } } },
      },
    });

    const { notifyUser } = require('../services/notify');
    let created = 0;
    for (const student of students) {
      const creditHours = student.enrollments.reduce((s, e) => s + (e.section.course?.creditHours || 0), 0);
      if (creditHours === 0) continue;

      const total = creditHours * structure.perCreditHour + structure.labFee + structure.libraryFee + structure.otherFee;
      const existing = await prisma.feeChallan.findFirst({ where: { studentId: student.id, semester: sem } });
      if (existing) continue;

      const challan = await prisma.feeChallan.create({
        data: {
          studentId: student.id,
          semester: sem,
          voucherId: `VCH-${sem}-${student.rollNumber}-${Date.now().toString(36).toUpperCase()}`,
          creditHours,
          totalAmount: total,
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      created += 1;

      const dueStr = challan.dueDate.toDateString();
      await notifyUser(student.user, {
        title: 'New Fee Challan',
        body: `Challan ${challan.voucherId} of Rs. ${total.toLocaleString()} for semester ${sem} is due on ${dueStr}.`,
        type: 'INFO',
        link: '/student/challans',
        phone: student.phone,
        emailTemplate: {
          name: 'feeChallan',
          data: { name: student.name, voucher: challan.voucherId, amount: total.toLocaleString(), dueDate: dueStr },
        },
        sms: `Fee challan ${challan.voucherId} of Rs. ${total.toLocaleString()} is due on ${dueStr}.`,
      });
    }

    logAudit('CHALLANS_GENERATED', { userId: req.user.id, entity: 'FeeChallan', ipAddress: req.ip, details: `Semester ${sem}: ${created} created` });
    res.json({ message: `${created} challans generated`, created });
  } catch (err) {
    next(err);
  }
};

exports.markChallanPaid = async (req, res, next) => {
  try {
    const { paid } = req.body;
    const isPaid = paid !== false;
    const challan = await prisma.feeChallan.update({
      where: { id: req.params.id },
      data: isPaid ? { status: 'PAID', paidAt: new Date() } : { status: 'UNPAID', paidAt: null },
    });
    logAudit(isPaid ? 'CHALLAN_PAID' : 'CHALLAN_UNPAID', { userId: req.user.id, entity: 'FeeChallan', entityId: challan.id, ipAddress: req.ip, details: challan.voucherId });
    res.json({ challan });
  } catch (err) {
    next(err);
  }
};

// ---------- Notices ----------
exports.listNotices = async (req, res, next) => {
  try {
    const notices = await prisma.notice.findMany({ include: { author: { select: { email: true } } }, orderBy: { createdAt: 'desc' } });
    res.json({ notices });
  } catch (err) {
    next(err);
  }
};

exports.createNotice = async (req, res, next) => {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ message: 'title and body are required' });
    const notice = await prisma.notice.create({ data: { title, body, authorId: req.user.id } });
    logAudit('NOTICE_CREATED', { userId: req.user.id, entity: 'Notice', entityId: notice.id, ipAddress: req.ip, details: title });
    res.status(201).json({ notice });
  } catch (err) {
    next(err);
  }
};

exports.deleteNotice = async (req, res, next) => {
  try {
    await prisma.notice.delete({ where: { id: req.params.id } });
    logAudit('NOTICE_DELETED', { userId: req.user.id, entity: 'Notice', entityId: req.params.id, ipAddress: req.ip });
    res.json({ message: 'Notice deleted' });
  } catch (err) {
    next(err);
  }
};

// ---------- Audit ----------
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { skip, take, search } = parsePagination(req, { defaultLimit: 50, maxLimit: 200, sortable: ['createdAt', 'action'] });
    const where = search
      ? { OR: [{ action: { contains: search, mode: 'insensitive' } }, { entity: { contains: search, mode: 'insensitive' } }] }
      : undefined;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ logs, pagination: pageMeta({ page: skip / take + 1, limit: take, total }) });
  } catch (err) {
    next(err);
  }
};

exports.exportAuditCsv = async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
    const esc = (s) => {
      const v = s == null ? '' : String(s);
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const headers = ['createdAt', 'action', 'userEmail', 'entity', 'entityId', 'details', 'ipAddress'];
    const rows = logs.map((l) => [l.createdAt.toISOString(), l.action, l.user?.email || '', l.entity, l.entityId || '', l.details || '', l.ipAddress || '']);
    const csv = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
};

/** Granular RBAC: assign permission strings to a user. */
exports.updateUserPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return res.status(400).json({ message: 'permissions must be an array' });
    const clean = [...new Set(permissions.filter((p) => typeof p === 'string' && p.length <= 60))].slice(0, 60);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { permissions: clean },
      select: { id: true, email: true, role: true, permissions: true },
    });
    logAudit('PERMISSIONS_UPDATED', {
      userId: req.user.id, entity: 'User', entityId: user.id, ipAddress: req.ip,
      details: `${user.email}: [${clean.join(', ')}]`,
    });
    res.json({ user, message: 'Permissions updated' });
  } catch (err) {
    next(err);
  }
};

// ---------- Edit existing records ----------
exports.updateStudent = async (req, res, next) => {
  try {
    const { name, department, batch, currentSemester, degree, cnic, guardianName, phone, address, email } = req.body;
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const data = {};
    if (name !== undefined) data.name = name;
    if (department !== undefined) data.department = department;
    if (batch !== undefined) data.batch = batch;
    if (currentSemester !== undefined) data.currentSemester = Number(currentSemester);
    if (degree !== undefined) data.degree = degree;
    if (cnic !== undefined) data.cnic = cnic;
    if (guardianName !== undefined) data.guardianName = guardianName;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;

    const updated = await prisma.student.update({ where: { id: student.id }, data });

    if (email && email !== student.user?.email) {
      await prisma.user.update({ where: { id: student.userId }, data: { email: email.toLowerCase().trim() } });
    }

    logAudit('STUDENT_UPDATED', { userId: req.user.id, entity: 'Student', entityId: student.id, ipAddress: req.ip, details: student.rollNumber });
    res.json({ student: updated });
  } catch (err) {
    next(err);
  }
};

exports.updateFaculty = async (req, res, next) => {
  try {
    const { name, designation, department, phone, email } = req.body;
    const faculty = await prisma.faculty.findUnique({ where: { id: req.params.id } });
    if (!faculty) return res.status(404).json({ message: 'Faculty not found' });

    const data = {};
    if (name !== undefined) data.name = name;
    if (designation !== undefined) data.designation = designation;
    if (department !== undefined) data.department = department;
    if (phone !== undefined) data.phone = phone;

    const updated = await prisma.faculty.update({ where: { id: faculty.id }, data });

    if (email && email !== faculty.user?.email) {
      await prisma.user.update({ where: { id: faculty.userId }, data: { email: email.toLowerCase().trim() } });
    }

    logAudit('FACULTY_UPDATED', { userId: req.user.id, entity: 'Faculty', entityId: faculty.id, ipAddress: req.ip, details: faculty.employeeId });
    res.json({ faculty: updated });
  } catch (err) {
    next(err);
  }
};
