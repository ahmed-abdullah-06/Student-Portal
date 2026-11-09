const prisma = require('../config/db');
const fs = require('fs');
const path = require('path');
const { UPLOAD_DIR } = require('../middlewares/upload');
const {
  MIN_ATTENDANCE,
  attendancePercentage,
  computeCGPA,
  computeWeightedPercentage,
  round2,
} = require('../utils/gpaCalculator');
const { generateChallanPDF } = require('../utils/pdfGenerator');
const { logAudit } = require('../utils/logger');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { sanitizeStudent } = require('../utils/responseSanitizers');

async function getStudent(userId) {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    const err = new Error('Student profile not found');
    err.status = 404;
    throw err;
  }
  return student;
}

async function isEnrolledInCourse(studentId, courseId) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, status: { not: 'DROPPED' }, section: { courseId } },
    select: { id: true },
  });
  return Boolean(enrollment);
}

exports.getProfile = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    res.json({ student: sanitizeStudent(student) });
  } catch (err) {
    next(err);
  }
};

exports.getRegisteredCourses = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const semester = Number(req.query.semester) || student.currentSemester;

    const { page, limit, skip, take } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const [enrollments, total] = await Promise.all([prisma.enrollment.findMany({
      where: { studentId: student.id, semester, status: { not: 'DROPPED' } },
      include: {
        section: {
          include: { course: true, faculty: { select: { name: true, designation: true } }, slots: true },
        },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }), prisma.enrollment.count({ where: { studentId: student.id, semester, status: { not: 'DROPPED' } } })]);

    res.json({ semester, enrollments, pagination: pageMeta({ page, limit, total }) });
  } catch (err) {
    next(err);
  }
};

exports.getCourseWorkspace = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);

    const enrollment = await prisma.enrollment.findFirst({
      where: { id: req.params.id, studentId: student.id, status: { not: 'DROPPED' } },
      include: {
        section: {
          include: {
            course: true,
            faculty: { select: { name: true, designation: true, department: true } },
            slots: { orderBy: [{ day: 'asc' }, { startTime: 'asc' }] },
          },
        },
        attendance: { orderBy: [{ date: 'asc' }, { lectureNumber: 'asc' }] },
      },
    });
    if (!enrollment) return res.status(404).json({ message: 'Course not found' });

    const [materials, notices, evaluation, tasks] = await Promise.all([
      prisma.courseMaterial.findMany({
        where: { courseId: enrollment.section.courseId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notice.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { author: { select: { email: true, role: true } } },
      }),
      prisma.teacherEvaluation.findFirst({
        where: { studentId: student.id, sectionId: enrollment.sectionId },
        select: { id: true, submittedAt: true, overall: true },
      }),
      prisma.courseTask.findMany({
        where: { courseId: enrollment.section.courseId, isActive: true },
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        include: { submissions: { where: { studentId: student.id } } },
      }),
    ]);

    const total = enrollment.attendance.length;
    const attended = enrollment.attendance.filter((a) => a.status === 'PRESENT').length;
    const percentage = attendancePercentage(attended, total);

    res.json({
      enrollment: {
        id: enrollment.id,
        semester: enrollment.semester,
        year: enrollment.year,
        status: enrollment.status,
        assignments: enrollment.assignments,
        quizzes: enrollment.quizzes,
        midterms: enrollment.midterms,
        finals: enrollment.finals,
        totalMarks: enrollment.isLocked ? enrollment.totalMarks : round2(computeWeightedPercentage(enrollment)),
        gradeLetter: enrollment.isLocked ? enrollment.gradeLetter : null,
        gradePoints: enrollment.isLocked ? enrollment.gradePoints : null,
        isLocked: enrollment.isLocked,
      },
      course: {
        code: enrollment.section.course.courseCode,
        title: enrollment.section.course.title,
        creditHours: enrollment.section.course.creditHours,
        department: enrollment.section.course.department,
        description: enrollment.section.course.description,
        section: enrollment.section.name,
        faculty: enrollment.section.faculty,
        slots: enrollment.section.slots,
      },
      attendance: {
        totalLectures: total,
        attendedLectures: attended,
        absentLectures: total - attended,
        percentage,
        isDeficient: percentage < MIN_ATTENDANCE,
        records: enrollment.attendance,
      },
      materials,
      notices,
      tasks: tasks.map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        description: t.description,
        fileName: t.fileName,
        fileSize: t.fileSize,
        fileType: t.fileType,
        startDate: t.startDate,
        dueDate: t.dueDate,
        teacherComments: t.teacherComments,
        submission: t.submissions[0]
          ? {
            id: t.submissions[0].id,
            fileName: t.submissions[0].fileName,
            fileSize: t.submissions[0].fileSize,
            comment: t.submissions[0].comment,
            marks: t.submissions[0].marks,
            submittedAt: t.submissions[0].submittedAt,
          }
          : null,
      })),
      evaluation: evaluation || null,
      minAttendance: MIN_ATTENDANCE,
    });
  } catch (err) {
    next(err);
  }
};

exports.downloadTaskFile = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const task = await prisma.courseTask.findUnique({ where: { id: req.params.id } });
    if (!task || !task.filePath) return res.status(404).json({ message: 'Attachment not found' });
    if (!(await isEnrolledInCourse(student.id, task.courseId))) {
      return res.status(404).json({ message: 'Task not found' });
    }
    const filePath = path.join(UPLOAD_DIR, task.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File missing on server' });
    res.download(filePath, task.fileName || 'attachment');
  } catch (err) {
    next(err);
  }
};

exports.submitTask = async (req, res, next) => {
  const cleanup = () => {
    if (req.file) fs.rm(req.file.path, { force: true }, () => {});
  };
  try {
    const student = await getStudent(req.user.id);
    const task = await prisma.courseTask.findUnique({ where: { id: req.params.id } });
    if (!task || !task.isActive) {
      cleanup();
      return res.status(404).json({ message: 'Task not found' });
    }
    if (!(await isEnrolledInCourse(student.id, task.courseId))) {
      cleanup();
      return res.status(404).json({ message: 'Task not found' });
    }
    if (!req.file) return res.status(400).json({ message: 'A file is required' });

    const existing = await prisma.taskSubmission.findUnique({
      where: { taskId_studentId: { taskId: task.id, studentId: student.id } },
    });
    if (existing?.filePath) {
      fs.rm(path.join(UPLOAD_DIR, existing.filePath), { force: true }, () => {});
    }

    const data = {
      fileName: req.file.originalname,
      filePath: req.file.filename,
      fileSize: req.file.size,
      submittedAt: new Date(),
    };
    const submission = existing
      ? await prisma.taskSubmission.update({ where: { id: existing.id }, data })
      : await prisma.taskSubmission.create({
        data: { ...data, taskId: task.id, studentId: student.id },
      });

    res.status(existing ? 200 : 201).json({ submission });
  } catch (err) {
    cleanup();
    next(err);
  }
};

exports.getAttendance = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { page, limit, skip, take } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });

    const [enrollments, total] = await Promise.all([prisma.enrollment.findMany({
      where: { studentId: student.id, status: { not: 'DROPPED' } },
      include: {
        section: { include: { course: true, faculty: { select: { id: true, name: true, designation: true, department: true, phone: true, officeHours: true, bio: true } } } },
        attendance: { select: { status: true, date: true, lectureNumber: true } },
      },
      orderBy: { semester: 'desc' },
      skip,
      take,
    }), prisma.enrollment.count({ where: { studentId: student.id, status: { not: 'DROPPED' } } })]);

    const result = enrollments.map((e) => {
      const total = e.attendance.length;
      const attended = e.attendance.filter((a) => a.status === 'PRESENT').length;
      const percentage = attendancePercentage(attended, total);
      return {
        id: e.id,
        semester: e.semester,
        courseCode: e.section.course.courseCode,
        title: e.section.course.title,
        section: e.section.name,
        faculty: e.section.faculty,
        totalLectures: total,
        attendedLectures: attended,
        absentLectures: total - attended,
        percentage,
        isDeficient: percentage < MIN_ATTENDANCE,
        records: e.attendance.sort((a, b) => new Date(a.date) - new Date(b.date)),
      };
    });

    res.json({ courses: result, minAttendance: MIN_ATTENDANCE, pagination: pageMeta({ page, limit, total }) });
  } catch (err) {
    next(err);
  }
};

exports.getMarks = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: { not: 'DROPPED' } },
      include: {
        section: { include: { course: true, faculty: { select: { name: true } } } },
      },
      orderBy: { semester: 'desc' },
    });

    const courses = enrollments.map((e) => ({
      id: e.id,
      semester: e.semester,
      courseCode: e.section.course.courseCode,
      title: e.section.course.title,
      creditHours: e.section.course.creditHours,
      faculty: e.section.faculty?.name || 'Unassigned',
      section: e.section.name,
      assignments: e.assignments,
      quizzes: e.quizzes,
      midterms: e.midterms,
      finals: e.finals,
      totalMarks: e.isLocked ? e.totalMarks : round2(computeWeightedPercentage(e)),
      gradeLetter: e.isLocked ? e.gradeLetter : null,
      gradePoints: e.isLocked ? e.gradePoints : null,
      isLocked: e.isLocked,
    }));

    res.json({ courses });
  } catch (err) {
    next(err);
  }
};

exports.getTranscript = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);

    const records = await prisma.semesterRecord.findMany({
      where: { studentId: student.id },
      orderBy: { semester: 'asc' },
    });

    const cgpa = records.length
      ? records[records.length - 1].cgpa
      : computeCGPA(records);

    const totalCrHrs = records.reduce((s, r) => s + r.creditHours, 0);

    res.json({ records, cgpa, totalCreditHours: round2(totalCrHrs), student });
  } catch (err) {
    next(err);
  }
};

exports.getChallans = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const challans = await prisma.feeChallan.findMany({
      where: { studentId: student.id },
      orderBy: { semester: 'desc' },
    });
    res.json({ challans });
  } catch (err) {
    next(err);
  }
};

exports.downloadChallanPdf = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const challan = await prisma.feeChallan.findUnique({ where: { id: req.params.id } });
    if (!challan || challan.studentId !== student.id) {
      return res.status(404).json({ message: 'Challan not found' });
    }
    const structure = (await prisma.feeStructure.findFirst({ where: { semester: challan.semester } })) || {
      perCreditHour: 0, labFee: 0, libraryFee: 0, otherFee: 0,
    };
    generateChallanPDF(res, { challan, student, structure, semester: challan.semester });
  } catch (err) {
    next(err);
  }
};

exports.getTimetable = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, semester: student.currentSemester, status: 'REGISTERED' },
      include: { section: { include: { course: true, faculty: { select: { name: true } }, slots: true } } },
    });

    const entries = enrollments.flatMap((e) =>
      e.section.slots.map((s) => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        courseCode: e.section.course.courseCode,
        title: e.section.course.title,
        faculty: e.section.faculty?.name || 'TBD',
        section: e.section.name,
      }))
    );

    res.json({ entries });
  } catch (err) {
    next(err);
  }
};

exports.getNotices = async (req, res, next) => {
  try {
    const notices = await prisma.notice.findMany({
      include: { author: { select: { email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ notices });
  } catch (err) {
    next(err);
  }
};

exports.getAvailableCourses = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);

    const [sections, myEnrollments, passedCourses] = await Promise.all([
      prisma.section.findMany({
        where: {
          isActive: true,
          semester: student.currentSemester,
          course: { OR: [{ department: student.department }, { department: 'COMMON' }] },
        },
        include: { course: { include: { prerequisites: true } }, faculty: { select: { name: true } }, _count: { select: { enrollments: true } } },
      }),
      prisma.enrollment.findMany({
        where: { studentId: student.id, status: { not: 'DROPPED' } },
        include: { section: { include: { course: true } } },
      }),
      prisma.enrollment.findMany({
        where: { studentId: student.id, status: 'COMPLETED', gradePoints: { gte: 2.0 } },
        include: { section: { include: { course: true } } },
      }),
    ]);

    const registeredCourseIds = myEnrollments.map((e) => e.section.courseId);
    const passedCourseCodes = new Set(passedCourses.map((e) => e.section.course.courseCode));
    const registeredCodes = new Set(myEnrollments.map((e) => e.section.course.courseCode));
    const registeredCrHrs = myEnrollments
      .filter((e) => e.semester === student.currentSemester)
      .reduce((s, e) => s + (e.section.course?.creditHours || 0), 0);

    const courses = sections.map((s) => {
      const missing = s.course.prerequisites.filter((p) => !passedCourseCodes.has(p.courseCode));
      return {
        sectionId: s.id,
        courseCode: s.course.courseCode,
        title: s.course.title,
        creditHours: s.course.creditHours,
        section: s.name,
        faculty: s.faculty?.name || 'TBD',
        enrolled: s._count.enrollments,
        capacity: s.capacity,
        full: s._count.enrollments >= s.capacity,
        alreadyRegistered: registeredCourseIds.includes(s.id),
        hasCode: registeredCodes.has(s.course.courseCode),
        prerequisites: s.course.prerequisites.map((p) => ({ courseCode: p.courseCode, title: p.title, met: passedCourseCodes.has(p.courseCode) })),
        prerequisitesMet: missing.length === 0,
      };
    });

    res.json({ courses, registeredCreditHours: registeredCrHrs, semester: student.currentSemester });
  } catch (err) {
    next(err);
  }
};

exports.registerCourse = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { sectionId } = req.body;
    if (!sectionId) return res.status(400).json({ message: 'sectionId is required' });

    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: { course: { include: { prerequisites: true } } },
    });
    if (!section || !section.isActive || section.semester !== student.currentSemester) {
      return res.status(400).json({ message: 'Course section is not available for registration' });
    }

    const existing = await prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: student.id, sectionId } },
      include: { section: { include: { course: true } } },
    });
    if (existing && existing.status !== 'DROPPED') {
      return res.status(409).json({ message: 'Already registered in this course' });
    }
    if (existing && existing.status === 'DROPPED') {
      await prisma.enrollment.update({ where: { id: existing.id }, data: { status: 'REGISTERED' } });
      logAudit('COURSE_RE_REGISTER', { userId: req.user.id, entity: 'Enrollment', entityId: existing.id, ipAddress: req.ip });
      return res.json({ message: `${section.course.courseCode} re-registered` });
    }

    const sameCode = await prisma.enrollment.findFirst({
      where: { studentId: student.id, status: { not: 'DROPPED' }, section: { courseId: section.courseId } },
    });
    if (sameCode) {
      return res.status(409).json({ message: `Already registered in ${section.course.courseCode}` });
    }

    const passedCourses = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'COMPLETED', gradePoints: { gte: 2.0 } },
      include: { section: { include: { course: true } } },
    });
    const passedCodes = new Set(passedCourses.map((e) => e.section.course.courseCode));
    const missing = section.course.prerequisites.filter((p) => !passedCodes.has(p.courseCode));
    if (missing.length > 0) {
      return res.status(400).json({
        message: `Prerequisite not met: ${missing.map((m) => m.courseCode).join(', ')}`,
      });
    }

    const current = await prisma.enrollment.findMany({
      where: { studentId: student.id, semester: student.currentSemester, status: 'REGISTERED' },
      include: { section: { include: { course: true } } },
    });
    const crHrs = current.reduce((s, e) => s + (e.section.course?.creditHours || 0), 0);
    let maxCredits = 21;
    try {
      const { getSection } = require('../services/settings');
      const acad = await getSection('academics');
      if (acad.maxCreditHours) maxCredits = Number(acad.maxCreditHours);
    } catch { /* defaults */ }
    if (crHrs + section.course.creditHours > maxCredits) {
      return res.status(400).json({ message: `Maximum ${maxCredits} credit hours per semester` });
    }

    const count = await prisma.enrollment.count({ where: { sectionId, status: 'REGISTERED' } });
    if (count >= section.capacity) {
      return res.status(400).json({ message: 'Section is full' });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        sectionId,
        semester: section.semester,
        year: section.year,
        status: 'REGISTERED',
      },
    });

    logAudit('COURSE_REGISTER', {
      userId: req.user.id, entity: 'Enrollment', entityId: enrollment.id, ipAddress: req.ip,
      details: `${student.rollNumber} registered ${section.course.courseCode}`,
    });

    res.status(201).json({ message: `${section.course.courseCode} registered`, enrollment });
  } catch (err) {
    next(err);
  }
};

exports.dropCourse = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: req.params.id },
      include: { section: { include: { course: true } } },
    });
    if (!enrollment || enrollment.studentId !== student.id) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }
    if (enrollment.isLocked) {
      return res.status(400).json({ message: 'Result is frozen — cannot drop' });
    }
    if (enrollment.status !== 'REGISTERED') {
      return res.status(400).json({ message: 'Enrollment is not active' });
    }

    await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: 'DROPPED' } });

    logAudit('COURSE_DROP', {
      userId: req.user.id, entity: 'Enrollment', entityId: enrollment.id, ipAddress: req.ip,
      details: `${student.rollNumber} dropped ${enrollment.section.course.courseCode}`,
    });

    res.json({ message: `${enrollment.section.course.courseCode} dropped` });
  } catch (err) {
    next(err);
  }
};

exports.getEvaluations = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id, status: 'REGISTERED' },
      include: { section: { include: { course: true, faculty: { select: { name: true } } } } },
    });

    const existing = await prisma.teacherEvaluation.findMany({
      where: { studentId: student.id },
      select: { sectionId: true },
    });
    const done = new Set(existing.map((e) => e.sectionId));

    let evalWindow = null;
    try {
      evalWindow = await prisma.evaluationWindow.findFirst({
        where: { semester: student.currentSemester, year: 2026 },
      });
    } catch { evalWindow = null; }
    const windowOpen = evalWindow ? evalWindow.isOpen : true;

    const items = enrollments.map((e) => ({
      sectionId: e.sectionId,
      courseCode: e.section.course.courseCode,
      title: e.section.course.title,
      faculty: e.section.faculty?.name || 'TBD',
      section: e.section.name,
      submitted: done.has(e.sectionId),
    }));

    res.json({ items, allSubmitted: items.every((i) => i.submitted), windowOpen });
  } catch (err) {
    next(err);
  }
};

exports.submitEvaluation = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { sectionId, punctuality, knowledge, communication, helpfulness, overall, feedback } = req.body;

    try {
      const win = await prisma.evaluationWindow.findFirst({
        where: { semester: student.currentSemester, year: 2026 },
      });
      if (win && !win.isOpen) {
        return res.status(403).json({ message: 'Evaluation window is currently closed. Please try again later.' });
      }
    } catch { /* if no window record, allow */ }

    if (!sectionId) return res.status(400).json({ message: 'sectionId is required' });
    for (const [k, v] of Object.entries({ punctuality, knowledge, communication, helpfulness, overall })) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return res.status(400).json({ message: `${k} must be an integer between 1 and 5` });
      }
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_sectionId: { studentId: student.id, sectionId } },
    });
    if (!enrollment || enrollment.status !== 'REGISTERED') {
      return res.status(404).json({ message: 'You are not registered in this section' });
    }

    const already = await prisma.teacherEvaluation.findUnique({
      where: { studentId_sectionId: { studentId: student.id, sectionId } },
    });
    if (already) return res.status(409).json({ message: 'Evaluation already submitted' });

    await prisma.teacherEvaluation.create({
      data: {
        studentId: student.id,
        sectionId,
        punctuality: Number(punctuality),
        knowledge: Number(knowledge),
        communication: Number(communication),
        helpfulness: Number(helpfulness),
        overall: Number(overall),
        feedback: feedback || null,
      },
    });

    logAudit('TEACHER_EVALUATION', {
      userId: req.user.id, entity: 'TeacherEvaluation', entityId: sectionId, ipAddress: req.ip,
    });

    res.status(201).json({ message: 'Evaluation submitted. Your final result is now unlocked.' });
  } catch (err) {
    next(err);
  }
};

exports.downloadCertificate = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    const { type } = req.params;

    if (type === 'transcript') {
      const records = await prisma.semesterRecord.findMany({
        where: { studentId: student.id },
        orderBy: { semester: 'asc' },
      });
      const cgpa = records.length ? records[records.length - 1].cgpa : 0;
      const totalCreditHours = records.reduce((s, r) => s + r.creditHours, 0);
      const { generateTranscriptPDF } = require('../utils/certificateGenerator');
      generateTranscriptPDF(res, { student, records, cgpa, totalCreditHours });
      return;
    }

    if (type === 'domicile') {
      const { generateDomicilePDF } = require('../utils/certificateGenerator');
      generateDomicilePDF(res, { student });
      return;
    }

    res.status(400).json({ message: 'type must be transcript or domicile' });
  } catch (err) {
    next(err);
  }
};
