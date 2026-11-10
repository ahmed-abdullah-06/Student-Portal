const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { GRADE_SCALE, round2 } = require('../utils/gpaCalculator');

/**
 * CSV data-migration importers (faculty, courses, historical records).
 *
 * Every importer:
 *  - parses CSV with the same RFC-4180-lite rules as the student importer
 *  - validates rows and reports per-row results: create | update | skip
 *  - supports `dryRun` — full validation and conflict detection against the
 *    database, without writing anything
 *  - is idempotent: re-running a file updates existing rows instead of
 *    duplicating them (faculty by employeeId/email are skipped, courses by
 *    courseCode are updated, records/grades upsert on their natural keys)
 *
 * All reads/writes go through the tenant-scoped Prisma client, so imports
 * always land in the caller's tenant.
 */

const DEFAULT_PASSWORD = 'Welcome123';
const MAX_RESULTS = 500;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

function normHeader(h) {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function parseCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw httpError(400, 'CSV must contain a header row and at least one data row');
  const headers = splitCsvLine(lines[0]).map(normHeader);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = (cells[idx] || '').trim(); });
    rows.push({ line: i + 1, row });
  }
  return { headers, rows };
}

function requireColumns(headers, required) {
  const missing = required.filter((r) => !headers.includes(r));
  if (missing.length) throw httpError(400, `CSV missing required columns: ${missing.join(', ')}`);
}

function amountOrNull(v) {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function summarize(rows, { dryRun }) {
  const counts = { created: 0, updated: 0, skipped: 0 };
  const results = [];
  for (const r of rows) {
    if (r.action === 'create') counts.created += 1;
    else if (r.action === 'update') counts.updated += 1;
    else counts.skipped += 1;
    if (results.length < MAX_RESULTS) results.push(r);
  }
  return {
    total: rows.length, ...counts, dryRun: Boolean(dryRun),
    results, resultsTruncated: rows.length > MAX_RESULTS,
  };
}

// ---------- Faculty ----------

async function importFaculty(text, { dryRun = false } = {}) {
  const { headers, rows } = parseCsv(text);
  requireColumns(headers, ['email', 'employeeid', 'name', 'designation', 'department']);

  const emails = rows.map(({ row }) => (row.email || '').toLowerCase()).filter(Boolean);
  const employeeIds = rows.map(({ row }) => (row.employeeid || '').toUpperCase()).filter(Boolean);
  const existingUsers = await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } });
  const existingFaculty = await prisma.faculty.findMany({ where: { employeeId: { in: employeeIds } }, select: { employeeId: true } });
  const takenEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
  const takenIds = new Set(existingFaculty.map((f) => f.employeeId.toUpperCase()));

  const results = [];
  const seenEmails = new Set();
  const seenIds = new Set();

  for (const { line, row } of rows) {
    const email = (row.email || '').toLowerCase();
    const employeeId = (row.employeeid || '').toUpperCase();
    const key = employeeId || email || `line ${line}`;

    if (!email || !employeeId || !row.name || !row.designation || !row.department) {
      results.push({ line, key, action: 'skip', reason: 'email, employeeId, name, designation, department are required' });
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ line, key, action: 'skip', reason: 'invalid email address' });
      continue;
    }
    if (seenEmails.has(email) || seenIds.has(employeeId)) {
      results.push({ line, key, action: 'skip', reason: 'duplicate row within this file' });
      continue;
    }
    seenEmails.add(email);
    seenIds.add(employeeId);
    if (takenIds.has(employeeId)) {
      results.push({ line, key, action: 'skip', reason: 'employeeId already exists' });
      continue;
    }
    if (takenEmails.has(email)) {
      results.push({ line, key, action: 'skip', reason: 'email already in use' });
      continue;
    }

    if (!dryRun) {
      const hashed = await bcrypt.hash(row.password || DEFAULT_PASSWORD, 12);
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { email, password: hashed, role: 'FACULTY', mustChangePassword: true },
          });
          await tx.faculty.create({
            data: {
              userId: user.id,
              employeeId,
              name: row.name,
              designation: row.designation,
              department: row.department,
              phone: row.phone || null,
            },
          });
        });
      } catch (err) {
        results.push({ line, key, action: 'skip', reason: err.code === 'P2002' ? 'already exists' : err.message.slice(0, 120) });
        continue;
      }
    }
    results.push({ line, key, action: 'create' });
  }

  return summarize(results, { dryRun });
}

// ---------- Courses ----------

async function importCourses(text, { dryRun = false } = {}) {
  const { headers, rows } = parseCsv(text);
  requireColumns(headers, ['coursecode', 'title', 'credithours', 'department']);

  const codes = rows.map(({ row }) => (row.coursecode || '').toUpperCase()).filter(Boolean);
  const existing = await prisma.course.findMany({ where: { courseCode: { in: codes } }, select: { courseCode: true } });
  const taken = new Set(existing.map((c) => c.courseCode.toUpperCase()));

  const results = [];
  const seen = new Set();

  for (const { line, row } of rows) {
    const courseCode = (row.coursecode || '').toUpperCase();
    const creditHours = Number(row.credithours);
    const key = courseCode || `line ${line}`;

    if (!courseCode || !row.title || !row.department) {
      results.push({ line, key, action: 'skip', reason: 'courseCode, title and department are required' });
      continue;
    }
    if (!Number.isInteger(creditHours) || creditHours < 1 || creditHours > 8) {
      results.push({ line, key, action: 'skip', reason: 'creditHours must be an integer between 1 and 8' });
      continue;
    }
    if (seen.has(courseCode)) {
      results.push({ line, key, action: 'skip', reason: 'duplicate row within this file' });
      continue;
    }
    seen.add(courseCode);

    if (!dryRun) {
      try {
        await prisma.course.upsert({
          where: { tenantId_courseCode: { tenantId: currentTenantIdForCompound(), courseCode } },
          create: {
            courseCode,
            title: row.title,
            creditHours,
            department: row.department,
            description: row.description || null,
          },
          update: {
            title: row.title,
            creditHours,
            department: row.department,
            description: row.description || null,
          },
        });
      } catch (err) {
        results.push({ line, key, action: 'skip', reason: err.message.slice(0, 120) });
        continue;
      }
    }
    results.push({ line, key, action: taken.has(courseCode) ? 'update' : 'create' });
  }

  return summarize(results, { dryRun });
}

function currentTenantIdForCompound() {
  // The scoping extension injects tenantId into where clauses for normal
  // queries, but compound-unique keys must carry it explicitly.
  const { getTenantId, DEFAULT_TENANT_ID } = require('../tenancy/context');
  return getTenantId() || DEFAULT_TENANT_ID;
}

// ---------- Historical semester records (transcript summaries) ----------

async function importSemesterRecords(text, { dryRun = false } = {}) {
  const { headers, rows } = parseCsv(text);
  requireColumns(headers, ['rollnumber', 'semester', 'sgpa', 'cgpa', 'credithours']);

  const rolls = [...new Set(rows.map(({ row }) => (row.rollnumber || '').toUpperCase()).filter(Boolean))];
  const students = await prisma.student.findMany({ where: { rollNumber: { in: rolls } }, select: { id: true, rollNumber: true } });
  const byRoll = new Map(students.map((s) => [s.rollNumber.toUpperCase(), s]));

  const studentIds = students.map((s) => s.id);
  const existing = await prisma.semesterRecord.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true, semester: true },
  });
  const taken = new Set(existing.map((r) => `${r.studentId}|${r.semester}`));

  const results = [];
  const seen = new Set();

  for (const { line, row } of rows) {
    const roll = (row.rollnumber || '').toUpperCase();
    const semester = Number(row.semester);
    const sgpa = Number(row.sgpa);
    const cgpa = Number(row.cgpa);
    const creditHours = Number(row.credithours);
    const key = roll && Number.isFinite(semester) ? `${roll} S${semester}` : `line ${line}`;

    const student = byRoll.get(roll);
    if (!student) {
      results.push({ line, key, action: 'skip', reason: `no student with rollNumber ${roll || '(blank)'}` });
      continue;
    }
    if (!Number.isInteger(semester) || semester < 1 || semester > 16) {
      results.push({ line, key, action: 'skip', reason: 'semester must be an integer between 1 and 16' });
      continue;
    }
    if (!(sgpa >= 0 && sgpa <= 4.5) || !(cgpa >= 0 && cgpa <= 4.5)) {
      results.push({ line, key, action: 'skip', reason: 'sgpa and cgpa must be between 0 and 4.5' });
      continue;
    }
    if (!(creditHours > 0 && creditHours <= 40)) {
      results.push({ line, key, action: 'skip', reason: 'creditHours must be between 0 and 40' });
      continue;
    }
    const dedupeKey = `${student.id}|${semester}`;
    if (seen.has(dedupeKey)) {
      results.push({ line, key, action: 'skip', reason: 'duplicate row within this file' });
      continue;
    }
    seen.add(dedupeKey);

    const providedPoints = amountOrNull(row.totalpoints);
    const totalPoints = Number.isFinite(providedPoints) && providedPoints !== null
      ? round2(providedPoints)
      : round2(sgpa * creditHours);

    const isUpdate = taken.has(dedupeKey);
    if (!dryRun) {
      try {
        await prisma.semesterRecord.upsert({
          where: { studentId_semester: { studentId: student.id, semester } },
          create: { studentId: student.id, semester, sgpa, cgpa, creditHours, totalPoints },
          update: { sgpa, cgpa, creditHours, totalPoints },
        });
      } catch (err) {
        results.push({ line, key, action: 'skip', reason: err.message.slice(0, 120) });
        continue;
      }
    }
    results.push({ line, key, action: isUpdate ? 'update' : 'create' });
  }

  return summarize(results, { dryRun });
}

// ---------- Historical course grades ----------

const GRADE_LETTERS = new Set(GRADE_SCALE.map((g) => g.letter.toUpperCase()));

async function importHistoricalGrades(text, { dryRun = false } = {}) {
  const { headers, rows } = parseCsv(text);
  requireColumns(headers, ['rollnumber', 'coursecode', 'semester', 'year', 'gradeletter']);

  const rolls = [...new Set(rows.map(({ row }) => (row.rollnumber || '').toUpperCase()).filter(Boolean))];
  const codes = [...new Set(rows.map(({ row }) => (row.coursecode || '').toUpperCase()).filter(Boolean))];

  const students = await prisma.student.findMany({ where: { rollNumber: { in: rolls } }, select: { id: true, rollNumber: true } });
  const byRoll = new Map(students.map((s) => [s.rollNumber.toUpperCase(), s]));
  const courses = await prisma.course.findMany({ where: { courseCode: { in: codes } }, select: { id: true, courseCode: true } });
  const byCode = new Map(courses.map((c) => [c.courseCode.toUpperCase(), c]));

  // Preload existing migration sections for the courses involved
  const courseIds = courses.map((c) => c.id);
  const sections = await prisma.section.findMany({
    where: { courseId: { in: courseIds }, isActive: false },
    select: { id: true, courseId: true, semester: true, year: true, name: true },
  });
  const sectionKey = (courseId, semester, year, name) => `${courseId}|${semester}|${year}|${name.toLowerCase()}`;
  const sectionMap = new Map(sections.map((s) => [sectionKey(s.courseId, s.semester, s.year, s.name), s]));
  const existingEnrollments = await prisma.enrollment.findMany({
    where: { sectionId: { in: sections.map((s) => s.id) } },
    select: { studentId: true, sectionId: true },
  });
  const takenEnrollments = new Set(existingEnrollments.map((e) => `${e.studentId}|${e.sectionId}`));
  let sectionsCreated = 0;

  const results = [];
  const seen = new Set();

  for (const { line, row } of rows) {
    const roll = (row.rollnumber || '').toUpperCase();
    const courseCode = (row.coursecode || '').toUpperCase();
    const semester = Number(row.semester);
    const year = Number(row.year);
    const gradeLetter = (row.gradeletter || '').toUpperCase();
    const sectionName = row.sectionname || 'MIGRATED';
    const key = roll && courseCode ? `${roll} ${courseCode}` : `line ${line}`;

    const student = byRoll.get(roll);
    const course = byCode.get(courseCode);
    if (!student) {
      results.push({ line, key, action: 'skip', reason: `no student with rollNumber ${roll || '(blank)'}` });
      continue;
    }
    if (!course) {
      results.push({ line, key, action: 'skip', reason: `no course with code ${courseCode || '(blank)'} (import courses first)` });
      continue;
    }
    if (!Number.isInteger(semester) || semester < 1 || semester > 16) {
      results.push({ line, key, action: 'skip', reason: 'semester must be an integer between 1 and 16' });
      continue;
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      results.push({ line, key, action: 'skip', reason: 'year must be a 4-digit year' });
      continue;
    }
    if (!GRADE_LETTERS.has(gradeLetter)) {
      results.push({ line, key, action: 'skip', reason: `gradeLetter must be one of: ${[...GRADE_LETTERS].join(', ')}` });
      continue;
    }
    const dedupeKey = `${student.id}|${course.id}|${year}|${semester}`;
    if (seen.has(dedupeKey)) {
      results.push({ line, key, action: 'skip', reason: 'duplicate row within this file' });
      continue;
    }
    seen.add(dedupeKey);

    const marks = amountOrNull(row.totalmarks);
    if (marks !== null && (Number.isNaN(marks) || marks < 0 || marks > 100)) {
      results.push({ line, key, action: 'skip', reason: 'totalMarks must be between 0 and 100' });
      continue;
    }
    const gradePoints = GRADE_SCALE.find((g) => g.letter.toUpperCase() === gradeLetter).points;

    const plannedSection = sectionMap.get(sectionKey(course.id, semester, year, sectionName));
    const enrollmentKey = plannedSection ? `${student.id}|${plannedSection.id}` : null;
    const isUpdate = enrollmentKey ? takenEnrollments.has(enrollmentKey) : false;

    if (!dryRun) {
      try {
        let section = plannedSection;
        if (!section) {
          section = await prisma.section.create({
            data: { name: sectionName, courseId: course.id, semester, year, isActive: false },
          });
          sectionMap.set(sectionKey(course.id, semester, year, sectionName), section);
          sectionsCreated += 1;
        }
        await prisma.enrollment.upsert({
          where: { studentId_sectionId: { studentId: student.id, sectionId: section.id } },
          create: {
            studentId: student.id,
            sectionId: section.id,
            semester,
            year,
            status: 'COMPLETED',
            totalMarks: marks ?? 0,
            gradeLetter,
            gradePoints,
            isLocked: true,
          },
          update: { status: 'COMPLETED', totalMarks: marks ?? 0, gradeLetter, gradePoints, isLocked: true },
        });
        takenEnrollments.add(`${student.id}|${section.id}`);
      } catch (err) {
        results.push({ line, key, action: 'skip', reason: err.message.slice(0, 120) });
        continue;
      }
    }
    results.push({ line, key, action: isUpdate ? 'update' : 'create' });
  }

  const summary = summarize(results, { dryRun });
  return { ...summary, sectionsCreated: dryRun ? 0 : sectionsCreated };
}

module.exports = {
  parseCsv,
  importFaculty,
  importCourses,
  importSemesterRecords,
  importHistoricalGrades,
  DEFAULT_PASSWORD,
};
