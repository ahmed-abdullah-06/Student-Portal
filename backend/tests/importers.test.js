require('dotenv').config({ path: __dirname + '/../.env' });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-0123456789abcdef';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../server');
const { prisma, cleanDatabase } = require('./helpers/setup');

const PASSWORD = 'Passw0rd123';
const TENANT_B = { id: 'tenB', slug: 'tenant-b', name: 'Tenant B University' };

let adminToken;

function csv(lines) {
  return Buffer.from(lines.join('\n'));
}

function upload(path, csvBuffer, filename, token = adminToken, query = '', tenant = null) {
  const req = request(app)
    .post(`/api/admin/import/${path}${query}`)
    .set('Authorization', `Bearer ${token}`);
  if (tenant) req.set('X-Tenant', tenant);
  return req.attach('file', csvBuffer, filename);
}

async function login(email, tenant) {
  const req = request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (tenant) req.set('X-Tenant', tenant);
  const res = await req;
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return res.body.token;
}

const COURSES_CSV = csv([
  'courseCode,title,creditHours,department,description',
  'CS-101,Intro to Programming,3,CS,',
  'CS-102,Data Structures,4,CS,Core',
]);

const FACULTY_CSV = csv([
  'email,employeeId,name,designation,department,phone',
  'fac1@uni.edu,F-001,Dr. One,Professor,CS,+920000000001',
  'fac2@uni.edu,F-002,Dr. Two,Lecturer,EE,',
  'bad-email,F-003,Dr. Three,Lecturer,CS,',
]);

beforeAll(async () => {
  await cleanDatabase();
  await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', slug: 'default', name: 'Default University' },
  });
  await prisma.tenant.upsert({ where: { id: TENANT_B.id }, update: {}, create: TENANT_B });

  await prisma.user.create({
    data: { email: 'import-admin@uni.edu', password: await bcrypt.hash(PASSWORD, 10), role: 'ADMIN' },
  });
  await prisma.user.create({
    data: { email: 'import-admin-b@uni.edu', tenantId: TENANT_B.id, password: await bcrypt.hash(PASSWORD, 10), role: 'ADMIN' },
  });

  const studentUser = await prisma.user.create({
    data: { email: 'imp-student@uni.edu', password: await bcrypt.hash(PASSWORD, 10), role: 'STUDENT' },
  });
  await prisma.student.create({
    data: { userId: studentUser.id, rollNumber: 'IMP-001', name: 'Import Student', department: 'CS', batch: 'SP23' },
  });

  const studentUserB = await prisma.user.create({
    data: { email: 'imp-student-b@uni.edu', tenantId: TENANT_B.id, password: await bcrypt.hash(PASSWORD, 10), role: 'STUDENT' },
  });
  await prisma.student.create({
    data: { userId: studentUserB.id, tenantId: TENANT_B.id, rollNumber: 'IMP-001', name: 'Import Student B', department: 'CS', batch: 'SP23' },
  });

  adminToken = await login('import-admin@uni.edu');
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { not: 'default' } } });
  await prisma.$disconnect();
});

describe('Data migration: courses', () => {
  test('dry-run reports creates without writing', async () => {
    const res = await upload('courses', COURSES_CSV, 'courses.csv', adminToken, '?dryRun=1');
    expect(res.status).toBe(200);
    expect(res.body.dryRun).toBe(true);
    expect(res.body.created).toBe(2);
    expect(await prisma.course.count()).toBe(0);
  });

  test('import creates courses and reruns update them', async () => {
    const first = await upload('courses', COURSES_CSV, 'courses.csv');
    expect(first.status).toBe(200);
    expect(first.body.created).toBe(2);
    expect(await prisma.course.count()).toBe(2);

    const changed = csv(['courseCode,title,creditHours,department', 'CS-101,Programming I,3,CS']);
    const second = await upload('courses', changed, 'courses.csv');
    expect(second.body.updated).toBe(1);

    const course = await prisma.course.findFirst({ where: { courseCode: 'CS-101' } });
    expect(course.title).toBe('Programming I');
    expect(await prisma.course.count()).toBe(2);
  });

  test('invalid rows are skipped with reasons', async () => {
    const bad = csv(['courseCode,title,creditHours,department', 'CS-999,Broken,99,CS', 'CS-998,,3,CS']);
    const res = await upload('courses', bad, 'courses.csv');
    expect(res.body.created).toBe(0);
    expect(res.body.skipped).toBe(2);
    expect(res.body.results.every((r) => r.action === 'skip' && r.reason)).toBe(true);
  });
});

describe('Data migration: faculty', () => {
  test('dry-run does not create users', async () => {
    const before = await prisma.user.count();
    const res = await upload('faculty', FACULTY_CSV, 'faculty.csv', adminToken, '?dryRun=1');
    expect(res.body.created).toBe(2);
    expect(res.body.skipped).toBe(1);
    expect(await prisma.user.count()).toBe(before);
  });

  test('import creates users + profiles, rerun skips existing', async () => {
    const first = await upload('faculty', FACULTY_CSV, 'faculty.csv');
    expect(first.body.created).toBe(2);
    expect(first.body.skipped).toBe(1);
    expect(first.body.results.find((r) => r.action === 'skip').reason).toMatch(/invalid email/i);

    const fac = await prisma.faculty.findFirst({ where: { employeeId: 'F-001' }, include: { user: true } });
    expect(fac.user.role).toBe('FACULTY');
    expect(fac.user.mustChangePassword).toBe(true);

    const second = await upload('faculty', FACULTY_CSV, 'faculty.csv');
    expect(second.body.created).toBe(0);
    expect(second.body.skipped).toBe(3);
  });
});

describe('Data migration: historical semester records', () => {
  const records = csv([
    'rollNumber,semester,sgpa,cgpa,creditHours,totalPoints',
    'IMP-001,1,3.50,3.50,15,52.5',
    'IMP-001,2,3.20,3.35,16,',
    'MISSING-9,1,3.00,3.00,15,',
  ]);

  test('imports summaries, computes points and skips unknown students', async () => {
    const res = await upload('semester-records', records, 'records.csv');
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(2);
    expect(res.body.skipped).toBe(1);

    const student = await prisma.student.findFirst({ where: { rollNumber: 'IMP-001' } });
    const recs = await prisma.semesterRecord.findMany({ where: { studentId: student.id }, orderBy: { semester: 'asc' } });
    expect(recs).toHaveLength(2);
    expect(recs[1].totalPoints).toBe(51.2);
  });

  test('rerun updates instead of duplicating', async () => {
    const changed = csv(['rollNumber,semester,sgpa,cgpa,creditHours', 'IMP-001,2,3.60,3.45,16']);
    const res = await upload('semester-records', changed, 'records.csv');
    expect(res.body.updated).toBe(1);

    const student = await prisma.student.findFirst({ where: { rollNumber: 'IMP-001' } });
    const recs = await prisma.semesterRecord.findMany({ where: { studentId: student.id } });
    expect(recs).toHaveLength(2);
    const s2 = recs.find((r) => r.semester === 2);
    expect(s2.sgpa).toBe(3.6);
  });

  test('imports are tenant-scoped (same roll number in two universities)', async () => {
    const tenantBToken = await login('import-admin-b@uni.edu', TENANT_B.slug);
    const bRecords = csv(['rollNumber,semester,sgpa,cgpa,creditHours', 'IMP-001,1,2.90,2.90,12']);
    const res = await upload('semester-records', bRecords, 'records.csv', tenantBToken, '', TENANT_B.slug);
    expect(res.body.created).toBe(1);

    const studentB = await prisma.student.findFirst({ where: { rollNumber: 'IMP-001', tenantId: TENANT_B.id } });
    const recsB = await prisma.semesterRecord.findMany({ where: { studentId: studentB.id } });
    expect(recsB).toHaveLength(1);
    expect(recsB[0].sgpa).toBe(2.9);

    const studentA = await prisma.student.findFirst({ where: { rollNumber: 'IMP-001', tenantId: 'default' } });
    const recsA = await prisma.semesterRecord.findMany({ where: { studentId: studentA.id } });
    expect(recsA.find((r) => r.semester === 1).sgpa).toBe(3.5);
  });
});

describe('Data migration: historical course grades', () => {
  const grades = csv([
    'rollNumber,courseCode,semester,year,gradeLetter,totalMarks',
    'IMP-001,CS-101,1,2023,A,88',
    'IMP-001,CS-102,1,2023,B+,79',
  ]);

  test('dry-run creates nothing', async () => {
    const res = await upload('historical-grades', grades, 'grades.csv', adminToken, '?dryRun=1');
    expect(res.body.created).toBe(2);
    expect(res.body.sectionsCreated).toBe(0);
    expect(await prisma.enrollment.count()).toBe(0);
  });

  test('import creates inactive migration sections and completed enrollments', async () => {
    const res = await upload('historical-grades', grades, 'grades.csv');
    expect(res.body.created).toBe(2);
    expect(res.body.sectionsCreated).toBe(2);

    const student = await prisma.student.findFirst({ where: { rollNumber: 'IMP-001' } });
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id },
      include: { section: { include: { course: true } } },
    });
    expect(enrollments).toHaveLength(2);
    const a = enrollments.find((e) => e.section.course.courseCode === 'CS-101');
    expect(a.status).toBe('COMPLETED');
    expect(a.gradeLetter).toBe('A');
    expect(a.gradePoints).toBe(4);
    expect(a.isLocked).toBe(true);
    expect(a.section.isActive).toBe(false);
  });

  test('rerun updates grades without duplicating sections', async () => {
    const updated = csv([
      'rollNumber,courseCode,semester,year,gradeLetter,totalMarks',
      'IMP-001,CS-101,1,2023,A-,85',
    ]);
    const res = await upload('historical-grades', updated, 'grades.csv');
    expect(res.body.updated).toBe(1);
    expect(res.body.created).toBe(0);
    expect(await prisma.section.count({ where: { name: 'MIGRATED' } })).toBe(2);

    const student = await prisma.student.findFirst({ where: { rollNumber: 'IMP-001' } });
    expect(await prisma.enrollment.count({ where: { studentId: student.id } })).toBe(2);
  });

  test('unknown course codes are skipped with a helpful reason', async () => {
    const bad = csv(['rollNumber,courseCode,semester,year,gradeLetter', 'IMP-001,NOPE-1,1,2023,A']);
    const res = await upload('historical-grades', bad, 'grades.csv');
    expect(res.body.skipped).toBe(1);
    expect(res.body.results[0].reason).toMatch(/import courses first/i);
  });
});

describe('Data migration: access control', () => {
  test('import endpoints require authentication', async () => {
    const res = await request(app)
      .post('/api/admin/import/courses')
      .attach('file', COURSES_CSV, 'courses.csv');
    expect(res.status).toBe(401);
  });

  test('CSV without required columns is rejected', async () => {
    const res = await upload('courses', csv(['foo,bar', '1,2']), 'bad.csv');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/missing required columns/i);
  });
});
