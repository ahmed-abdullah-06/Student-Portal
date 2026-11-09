const prisma = require('../config/db');
const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../middlewares/upload');
const {
  MIN_ATTENDANCE,
  attendancePercentage,
  computeWeightedPercentage,
  gradeFromPercentage,
  round2,
} = require('../utils/gpaCalculator');
const { logAudit } = require('../utils/logger');

async function getFaculty(userId) {
  const faculty = await prisma.faculty.findUnique({ where: { userId } });
  if (!faculty) {
    const err = new Error('Faculty profile not found');
    err.status = 404;
    throw err;
  }
  return faculty;
}

exports.getSections = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const sections = await prisma.section.findMany({
      where: { facultyId: faculty.id, isActive: true },
      include: {
        course: true,
        _count: { select: { enrollments: { where: { status: 'REGISTERED' } } } },
      },
      orderBy: [{ year: 'desc' }, { semester: 'desc' }],
    });
    res.json({ sections });
  } catch (err) {
    next(err);
  }
};

exports.getRoster = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const section = await prisma.section.findUnique({ where: { id: req.params.id }, include: { course: true } });
    if (!section || section.facultyId !== faculty.id) {
      return res.status(404).json({ message: 'Section not found or not assigned to you' });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId: section.id, status: { not: 'DROPPED' } },
      include: { student: { select: { id: true, rollNumber: true, name: true, department: true } }, attendance: { select: { date: true, lectureNumber: true, status: true } } },
      orderBy: { student: { rollNumber: 'asc' } },
    });

    const students = enrollments.map((e) => {
      const total = e.attendance.length;
      const attended = e.attendance.filter((a) => a.status === 'PRESENT').length;
      return {
        enrollmentId: e.id,
        ...e.student,
        assignments: e.assignments,
        quizzes: e.quizzes,
        midterms: e.midterms,
        finals: e.finals,
        totalMarks: e.totalMarks,
        gradeLetter: e.gradeLetter,
        isLocked: e.isLocked,
        totalLectures: total,
        attendedLectures: attended,
        percentage: attendancePercentage(attended, total),
      };
    });

    const lectures = await prisma.attendanceRecord.findMany({
      where: { enrollment: { sectionId: section.id } },
      distinct: ['date', 'lectureNumber'],
      orderBy: [{ date: 'asc' }, { lectureNumber: 'asc' }],
    });

    res.json({ section: { ...section }, students, lectures: lectures.length });
  } catch (err) {
    next(err);
  }
};

exports.markAttendance = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const section = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!section || section.facultyId !== faculty.id) {
      return res.status(404).json({ message: 'Section not found or not assigned to you' });
    }

    const { date, lectureNumber, records } = req.body;
    if (!date || !lectureNumber || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'date, lectureNumber and records[] are required' });
    }

    const lecture = Number(lectureNumber);
    if (!Number.isInteger(lecture) || lecture < 1) {
      return res.status(400).json({ message: 'lectureNumber must be a positive integer' });
    }

    const enrolledIds = new Set(
      (await prisma.enrollment.findMany({ where: { sectionId: section.id, status: 'REGISTERED' }, select: { id: true } })).map((e) => e.id)
    );

    const lectureDate = new Date(date);
    if (Number.isNaN(lectureDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }

    const ops = records
      .filter((r) => enrolledIds.has(r.enrollmentId))
      .map((r) => {
        const status = r.status === 'ABSENT' ? 'ABSENT' : 'PRESENT';
        return prisma.attendanceRecord.upsert({
          where: { enrollmentId_date_lectureNumber: { enrollmentId: r.enrollmentId, date: lectureDate, lectureNumber: lecture } },
          create: { enrollmentId: r.enrollmentId, date: lectureDate, lectureNumber: lecture, status },
          update: { status },
        });
      });

    await prisma.$transaction(ops);

    logAudit('ATTENDANCE_MARKED', {
      userId: req.user.id, entity: 'Section', entityId: section.id, ipAddress: req.ip,
      details: `Lecture #${lecture} on ${date} — ${ops.length} students`,
    });

    res.json({ message: `Attendance saved for lecture #${lecture}`, marked: ops.length });
  } catch (err) {
    next(err);
  }
};

exports.getAttendanceReport = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const section = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!section || section.facultyId !== faculty.id) {
      return res.status(404).json({ message: 'Section not found or not assigned to you' });
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { sectionId: section.id, status: { not: 'DROPPED' } },
      include: { student: { select: { rollNumber: true, name: true } }, attendance: { select: { status: true } } },
      orderBy: { student: { rollNumber: 'asc' } },
    });

    const rows = enrollments.map((e) => {
      const total = e.attendance.length;
      const attended = e.attendance.filter((a) => a.status === 'PRESENT').length;
      const percentage = attendancePercentage(attended, total);
      return {
        enrollmentId: e.id,
        rollNumber: e.student.rollNumber,
        name: e.student.name,
        total,
        attended,
        percentage,
        isDeficient: percentage < MIN_ATTENDANCE,
      };
    });

    res.json({ rows, minAttendance: MIN_ATTENDANCE });
  } catch (err) {
    next(err);
  }
};

exports.enterMarks = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const section = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!section || section.facultyId !== faculty.id) {
      return res.status(404).json({ message: 'Section not found or not assigned to you' });
    }

    const { component, marks } = req.body;
    const allowed = ['assignments', 'quizzes', 'midterms', 'finals'];
    if (!allowed.includes(component)) {
      return res.status(400).json({ message: `component must be one of: ${allowed.join(', ')}` });
    }
    if (!Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ message: 'marks[] is required' });
    }

    const enrolled = await prisma.enrollment.findMany({
      where: { sectionId: section.id, status: { not: 'DROPPED' } },
    });
    const byId = new Map(enrolled.map((e) => [e.id, e]));

    const ops = [];
    for (const m of marks) {
      const enrollment = byId.get(m.enrollmentId);
      if (!enrollment) continue;
      if (enrollment.isLocked) {
        const err = new Error('Result is frozen — unlock before editing marks');
        err.status = 400;
        throw err;
      }
      const value = Number(m.value);
      if (Number.isNaN(value) || value < 0 || value > 100) {
        return res.status(400).json({ message: 'Marks must be between 0 and 100' });
      }
      ops.push(prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { [component]: value },
      }));
    }

    await prisma.$transaction(ops);

    // Recompute weighted totals + grades after update
    const updated = await prisma.enrollment.findMany({ where: { sectionId: section.id, status: { not: 'DROPPED' } } });
    await prisma.$transaction(
      updated.map((e) => {
        const total = round2(computeWeightedPercentage(e));
        const { letter, points } = gradeFromPercentage(total);
        return prisma.enrollment.update({
          where: { id: e.id },
          data: { totalMarks: total, gradeLetter: letter, gradePoints: points },
        });
      })
    );

    logAudit('MARKS_ENTERED', {
      userId: req.user.id, entity: 'Section', entityId: section.id, ipAddress: req.ip,
      details: `${component} marks for ${marks.length} students`,
    });

    res.json({ message: `${component} marks saved`, updated: marks.length });
  } catch (err) {
    next(err);
  }
};

exports.freezeResult = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const section = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!section || section.facultyId !== faculty.id) {
      return res.status(404).json({ message: 'Section not found or not assigned to you' });
    }
    const { freeze } = req.body;
    const isLocked = freeze !== false;

    await prisma.enrollment.updateMany({
      where: { sectionId: section.id, status: { not: 'DROPPED' } },
      data: { isLocked },
    });

    logAudit(isLocked ? 'RESULT_FROZEN' : 'RESULT_UNLOCKED', {
      userId: req.user.id, entity: 'Section', entityId: section.id, ipAddress: req.ip,
    });

    res.json({ message: isLocked ? 'Result frozen' : 'Result unlocked' });
  } catch (err) {
    next(err);
  }
};

exports.getEvaluations = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const section = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!section || section.facultyId !== faculty.id) {
      return res.status(404).json({ message: 'Section not found or not assigned to you' });
    }

    const evaluations = await prisma.teacherEvaluation.findMany({
      where: { sectionId: section.id },
      select: { punctuality: true, knowledge: true, communication: true, helpfulness: true, overall: true, feedback: true, submittedAt: true },
    });

    const avg = (key) =>
      evaluations.length
        ? round2(evaluations.reduce((s, e) => s + e[key], 0) / evaluations.length)
        : 0;

    res.json({
      count: evaluations.length,
      averages: {
        punctuality: avg('punctuality'),
        knowledge: avg('knowledge'),
        communication: avg('communication'),
        helpfulness: avg('helpfulness'),
        overall: avg('overall'),
      },
      feedback: evaluations.filter((e) => e.feedback).map((e) => e.feedback),
    });
  } catch (err) {
    next(err);
  }
};

exports.getTasks = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const section = await prisma.section.findUnique({ where: { id: req.params.id }, include: { course: true } });
    if (!section || section.facultyId !== faculty.id) {
      return res.status(404).json({ message: 'Section not found or not assigned to you' });
    }

    const [tasks, rosterCount] = await Promise.all([
      prisma.courseTask.findMany({
        where: { courseId: section.courseId, isActive: true },
        orderBy: { createdAt: 'desc' },
        include: {
          submissions: {
            include: { student: { select: { id: true, rollNumber: true, name: true } } },
            orderBy: { submittedAt: 'asc' },
          },
        },
      }),
      prisma.enrollment.count({ where: { sectionId: section.id, status: { not: 'DROPPED' } } }),
    ]);

    res.json({ section, tasks, rosterCount });
  } catch (err) {
    next(err);
  }
};

exports.createTask = async (req, res, next) => {
  const cleanup = () => {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  };
  try {
    const faculty = await getFaculty(req.user.id);
    const section = await prisma.section.findUnique({ where: { id: req.params.id } });
    if (!section || section.facultyId !== faculty.id) {
      cleanup();
      return res.status(404).json({ message: 'Section not found or not assigned to you' });
    }

    const { title, type = 'ASSIGNMENT', description, startDate, dueDate, teacherComments } = req.body;
    if (!title || !title.trim()) {
      cleanup();
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!['ASSIGNMENT', 'QUIZ'].includes(type)) {
      cleanup();
      return res.status(400).json({ message: 'Type must be ASSIGNMENT or QUIZ' });
    }

    const task = await prisma.courseTask.create({
      data: {
        courseId: section.courseId,
        facultyId: faculty.id,
        type,
        title: title.trim(),
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        teacherComments: teacherComments || null,
        ...(req.file ? {
          fileName: req.file.originalname,
          filePath: req.file.filename,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
        } : {}),
      },
    });

    logAudit('TASK_CREATED', {
      userId: req.user.id,
      entity: 'CourseTask',
      entityId: task.id,
      details: { type, title: task.title, sectionId: section.id },
      ipAddress: req.ip,
    });
    res.status(201).json({ task });
  } catch (err) {
    cleanup();
    next(err);
  }
};

exports.updateSubmission = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const submission = await prisma.taskSubmission.findUnique({
      where: { id: req.params.id },
      include: { task: { select: { facultyId: true } } },
    });
    if (!submission || submission.task.facultyId !== faculty.id) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const data = {};
    if (req.body.comment !== undefined) data.comment = req.body.comment || null;
    if (req.body.marks !== undefined) {
      data.marks = req.body.marks === null || req.body.marks === '' ? null : Number(req.body.marks);
      if (data.marks !== null && Number.isNaN(data.marks)) {
        return res.status(400).json({ message: 'Marks must be a number' });
      }
    }

    const updated = await prisma.taskSubmission.update({ where: { id: submission.id }, data });
    res.json({ submission: updated });
  } catch (err) {
    next(err);
  }
};

exports.downloadSubmission = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const submission = await prisma.taskSubmission.findUnique({
      where: { id: req.params.id },
      include: { task: { select: { facultyId: true } } },
    });
    if (!submission || submission.task.facultyId !== faculty.id) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    const filePath = path.join(UPLOAD_DIR, submission.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File missing on server' });
    res.download(filePath, submission.fileName);
  } catch (err) {
    next(err);
  }
};
exports.downloadTask = async (req, res, next) => {
  try {
    const faculty = await getFaculty(req.user.id);
    const task = await prisma.courseTask.findUnique({ where: { id: req.params.id } });
    if (!task || task.facultyId !== faculty.id || !task.filePath) {
      return res.status(404).json({ message: 'Attachment not found' });
    }
    const filePath = path.join(UPLOAD_DIR, task.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File missing on server' });
    res.download(filePath, task.fileName || 'attachment');
  } catch (err) {
    next(err);
  }
};