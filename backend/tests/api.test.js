const request = require('supertest');
const bcrypt = require('bcryptjs');
const { prisma, cleanDatabase } = require('./helpers/setup');
const { generateTOTP } = require('../src/utils/totp');
const app = require('../server');

let adminToken;
let studentToken;

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body.token;
}

beforeAll(async () => {
  await cleanDatabase();

  const adminHash = await bcrypt.hash('Admin123', 10);
  const studentHash = await bcrypt.hash('Student123', 10);

  const admin = await prisma.user.create({
    data: { email: 'admin@test.edu.pk', password: adminHash, role: 'ADMIN' },
  });
  const studentUser = await prisma.user.create({
    data: { email: 'student@test.edu.pk', password: studentHash, role: 'STUDENT' },
  });
  await prisma.student.create({
    data: {
      userId: studentUser.id, rollNumber: 'TS-001', name: 'Test Student',
      department: 'BSCS', batch: 'TS26', degree: 'BS CS', currentSemester: 1,
    },
  });

  adminToken = await login('admin@test.edu.pk', 'Admin123');
  studentToken = await login('student@test.edu.pk', 'Student123');
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('Health & status', () => {
  test('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/status reports database ok', async () => {
    const res = await request(app).get('/api/status');
    expect([200, 503]).toContain(res.status);
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks.database).toBe('ok');
  });
});

describe('Auth', () => {
  test('GET /api/auth/captcha issues a code + token', async () => {
    const res = await request(app).get('/api/auth/captcha');
    expect(res.status).toBe(200);
    expect(res.body.code).toHaveLength(5);
    expect(res.body.token).toBeTruthy();
  });

  test('login with wrong password fails', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@test.edu.pk', password: 'nope' });
    expect(res.status).toBe(401);
  });

  test('login with roll number works', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'TS-001', password: 'Student123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('STUDENT');
    expect(res.body.token).toBeTruthy();
  });

  test('role-restricted login rejects other roles', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.edu.pk', password: 'Admin123', role: 'STUDENT' });
    expect(res.status).toBe(403);
    expect(res.body.token).toBeUndefined();
    expect(res.body.message).toMatch(/student portal/i);
  });

  test('role-restricted login accepts matching role', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'TS-001', password: 'Student123', role: 'STUDENT' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('STUDENT');
    expect(res.body.token).toBeTruthy();
  });

  test('GET /api/auth/me returns profile', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('student@test.edu.pk');
    expect(res.body.user.student.rollNumber).toBe('TS-001');
  });

  test('requests without token are 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('change password enforces policy and revokes sessions', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ oldPassword: 'Student123', newPassword: 'NewPass123', confirmPassword: 'NewPass123' });
    expect(res.status).toBe(200);

    // old token now invalid (tokenVersion bumped)
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${studentToken}`);
    expect(me.status).toBe(401);

    // login with the new password works
    const re = await login('student@test.edu.pk', 'NewPass123');
    expect(re).toBeTruthy();
    studentToken = re;
  });

  test('password policy rejects weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ oldPassword: 'NewPass123', newPassword: 'weak', confirmPassword: 'weak' });
    expect(res.status).toBe(400);
  });

  test('forgot-password returns reset flow', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'student@test.edu.pk' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeTruthy();
    if (res.body.devToken) {
      const reset = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: res.body.devToken, newPassword: 'Reset1234', confirmPassword: 'Reset1234' });
      expect(reset.status).toBe(200);
      const re = await login('student@test.edu.pk', 'Reset1234');
      expect(re).toBeTruthy();
      studentToken = re;
    }
  });

  test('sessions can be listed and revoked', async () => {
    const list = await request(app).get('/api/auth/sessions').set('Authorization', `Bearer ${studentToken}`);
    expect(list.status).toBe(200);
    expect(list.body.sessions.length).toBeGreaterThan(0);

    const revokeAll = await request(app)
      .post('/api/auth/sessions/revoke-all')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(revokeAll.status).toBe(200);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${studentToken}`);
    expect(me.status).toBe(401);

    studentToken = await login('student@test.edu.pk', 'Reset1234');
    expect(studentToken).toBeTruthy();
  });
});

describe('Two-factor authentication login', () => {
  const email = 'twofa@test.edu.pk';
  const password = 'Tfa12345';
  let token;
  let secret;
  let pendingToken;

  beforeAll(async () => {
    await prisma.user.create({
      data: { email, password: await bcrypt.hash(password, 10), role: 'STUDENT' },
    });
    token = await login(email, password);
    expect(token).toBeTruthy();

    const enable = await request(app).post('/api/auth/2fa/enable').set('Authorization', `Bearer ${token}`);
    expect(enable.status).toBe(200);
    secret = enable.body.secret;
    expect(secret).toBeTruthy();

    const confirm = await request(app)
      .post('/api/auth/2fa/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: generateTOTP(secret) });
    expect(confirm.status).toBe(200);
  });

  test('password step returns requires2FA instead of a token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.requires2FA).toBe(true);
    expect(res.body.pendingToken).toBeTruthy();
    expect(res.body.token).toBeUndefined();
    pendingToken = res.body.pendingToken;
  });

  test('code without a pending token is rejected', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password, totp: generateTOTP(secret) });
    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  test('wrong code with valid pending token is rejected', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password, totp: '000000', pendingToken });
    expect(res.status).toBe(401);
  });

  test('valid pending token + correct code returns a session', async () => {
    const step1 = await request(app).post('/api/auth/login').send({ email, password });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password, totp: generateTOTP(secret), pendingToken: step1.body.pendingToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('STUDENT');
  });

  test('2FA can be disabled with the password', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ password });
    expect(res.status).toBe(200);

    const after = await request(app).post('/api/auth/login').send({ email, password });
    expect(after.status).toBe(200);
    expect(after.body.token).toBeTruthy();
    expect(after.body.requires2FA).toBeUndefined();
  });
});

describe('RBAC & permissions', () => {
  test('student cannot access admin routes', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  test('admin can access admin routes', async () => {
    const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.stats).toHaveProperty('students');
  });

  test('permission catalog is exposed', async () => {
    const res = await request(app).get('/api/admin/permission-catalog').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.permissions).toContain('students:write');
  });

  test('settings endpoint requires admin', async () => {
    const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Settings & branding', () => {
  test('public branding returns defaults', async () => {
    const res = await request(app).get('/api/public/branding');
    expect(res.status).toBe(200);
    expect(res.body.branding).toHaveProperty('universityName');
    expect(res.body.branding).toHaveProperty('primaryColor');
  });

  test('admin can update branding', async () => {
    const res = await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ universityName: 'Test University', primaryColor: '#123456' });
    expect(res.status).toBe(200);
    expect(res.body.settings.universityName).toBe('Test University');

    const pub = await request(app).get('/api/public/branding');
    expect(pub.body.branding.universityName).toBe('Test University');
  });

  test('rejects unknown settings section', async () => {
    const res = await request(app)
      .put('/api/settings/bogus')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ x: 1 });
    expect(res.status).toBe(404);
  });
});

describe('Student academics', () => {
  test('student profile has completion percent', async () => {
    const res = await request(app).get('/api/student/profile').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.completion).toBe('number');
    expect(res.body.student.rollNumber).toBe('TS-001');
  });

  test('degree audit returns credits and standing', async () => {
    const res = await request(app).get('/api/student/degree-audit').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalCredits');
    expect(res.body).toHaveProperty('standing');
    expect(res.body.cgpa).toBeDefined();
  });

  test('date sheet returns exams array', async () => {
    const res = await request(app).get('/api/student/date-sheet').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.exams)).toBe(true);
  });

  test('evaluations respect evaluation window', async () => {
    const res = await request(app).get('/api/student/evaluations').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('windowOpen');
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});

describe('Request workflows', () => {
  test('student can list own requests (empty by default)', async () => {
    const res = await request(app).get('/api/student/rechecks').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rechecks)).toBe(true);
  });

  test('scholarships are listed', async () => {
    const res = await request(app).get('/api/student/scholarships').set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.scholarships)).toBe(true);
  });

  test('certificate request creates a pending record', async () => {
    const res = await request(app)
      .post('/api/student/cert-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ type: 'NOC' });
    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe('PENDING');

    // admin approves it
    const list = await request(app).get('/api/admin/cert-requests').set('Authorization', `Bearer ${adminToken}`);
    const target = list.body.requests.find((r) => r.id === res.body.request.id);
    expect(target).toBeTruthy();

    const resolve = await request(app)
      .put(`/api/admin/cert-requests/${res.body.request.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED', adminNote: 'ok' });
    expect(resolve.status).toBe(200);
    expect(resolve.body.request.status).toBe('APPROVED');
  });
});

describe('Admin master data & reports', () => {
  test('campus creation + listing', async () => {
    const create = await request(app)
      .post('/api/admin/campuses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Test Campus', city: 'Islamabad' });
    expect(create.status).toBe(201);

    const list = await request(app).get('/api/admin/campuses').set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.campuses.some((c) => c.name === 'Test Campus')).toBe(true);
  });

  test('attendance report returns CSV', async () => {
    const res = await request(app).get('/api/admin/reports/attendance').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('rollNumber');
  });

  test('enrollment report returns CSV with header', async () => {
    const res = await request(app).get('/api/admin/reports/enrollment').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.text.split('\n')[0]).toContain('courseCode');
  });
});

describe('Pagination', () => {
  test('students list includes pagination envelope', async () => {
    const res = await request(app)
      .get('/api/admin/students?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({ page: 1, limit: 5 });
    expect(typeof res.body.pagination.total).toBe('number');
  });

  test('audit logs paginate', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toBeDefined();
  });
});

describe('Docs & security headers', () => {
  test('OpenAPI spec is served', async () => {
    const res = await request(app).get('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3/);
    expect(res.body.paths).toHaveProperty('/auth/login');
  });

  test('404 returns JSON', async () => {
    const res = await request(app).get('/api/nope/nothing');
    expect(res.status).toBe(404);
    expect(res.body.message).toContain('Route not found');
  });

  test('request id header is present', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });
});


describe('Student course workspace', () => {
  let enrollmentId;
  let otherStudentToken;
  let taskId;

  beforeAll(async () => {
    const admin = await prisma.user.findFirst({ where: { email: 'admin@test.edu.pk' } });
    const student = await prisma.student.findFirst({ where: { rollNumber: 'TS-001' } });
    const course = await prisma.course.create({
      data: { courseCode: 'TS-300', title: 'Workspace Course', creditHours: 3, department: 'CS' },
    });
    const section = await prisma.section.create({
      data: { name: 'A', courseId: course.id, semester: 1, year: 2026 },
    });
    const enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, sectionId: section.id, semester: 1, year: 2026, assignments: 80, quizzes: 70, midterms: 60, finals: 50 },
    });
    enrollmentId = enrollment.id;

    await prisma.attendanceRecord.createMany({
      data: [
        { enrollmentId, date: new Date('2026-10-01'), lectureNumber: 1, status: 'PRESENT' },
        { enrollmentId, date: new Date('2026-10-02'), lectureNumber: 1, status: 'ABSENT' },
      ],
    });
    await prisma.courseMaterial.create({
      data: { courseId: course.id, title: 'Lecture 1', type: 'LECTURE', content: 'Intro' },
    });
    const task = await prisma.courseTask.create({
      data: {
        courseId: course.id,
        type: 'ASSIGNMENT',
        title: 'Workspace assignment',
        startDate: new Date('2026-10-01'),
        dueDate: new Date('2026-10-20'),
      },
    });
    taskId = task.id;
    await prisma.notice.create({
      data: { title: 'Workspace notice', body: 'Body', authorId: admin.id },
    });

    const otherUser = await prisma.user.create({
      data: { email: 'other@test.edu.pk', password: await bcrypt.hash('Other123', 10), role: 'STUDENT' },
    });
    const otherStudent = await prisma.student.create({
      data: { userId: otherUser.id, rollNumber: 'TS-002', name: 'Other Student', department: 'BSCS', batch: 'TS26', degree: 'BS CS', currentSemester: 1 },
    });
    const otherEnrollment = await prisma.enrollment.create({
      data: { studentId: otherStudent.id, sectionId: section.id, semester: 1, year: 2026 },
    });
    otherStudentToken = await login('other@test.edu.pk', 'Other123');

    expect(enrollment).toBeDefined();
    expect(otherEnrollment).toBeDefined();
  });

  test('returns workspace data for own enrollment', async () => {
    const res = await request(app)
      .get(`/api/student/courses/${enrollmentId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.course.code).toBe('TS-300');
    expect(res.body.course.faculty).toBeNull();
    expect(res.body.attendance).toMatchObject({ totalLectures: 2, attendedLectures: 1, percentage: 50 });
    expect(res.body.materials).toHaveLength(1);
    expect(res.body.notices.length).toBeGreaterThan(0);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0]).toMatchObject({ type: 'ASSIGNMENT', title: 'Workspace assignment', submission: null });
    expect(res.body.enrollment.totalMarks).toBe(57);
  });

  test('student can upload a task submission and replace it', async () => {
    const first = await request(app)
      .post(`/api/student/tasks/${taskId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('file', Buffer.from('answer,42\n', 'utf8'), 'answer.csv');
    expect(first.status).toBe(201);
    expect(first.body.submission.fileName).toBe('answer.csv');

    const second = await request(app)
      .post(`/api/student/tasks/${taskId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .attach('file', Buffer.from('answer,43\n', 'utf8'), 'answer-v2.csv');
    expect(second.status).toBe(200);
    expect(second.body.submission.fileName).toBe('answer-v2.csv');

    const workspace = await request(app)
      .get(`/api/student/courses/${enrollmentId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(workspace.body.tasks[0].submission.fileName).toBe('answer-v2.csv');
  });

  test('other students cannot submit to the task', async () => {
    const outsiderUser = await prisma.user.create({
      data: { email: 'outsider@test.edu.pk', password: await bcrypt.hash('Outsider123', 10), role: 'STUDENT' },
    });
    await prisma.student.create({
      data: { userId: outsiderUser.id, rollNumber: 'TS-003', name: 'Outsider', department: 'BSCS', batch: 'TS26', degree: 'BS CS', currentSemester: 1 },
    });
    const outsiderToken = await login('outsider@test.edu.pk', 'Outsider123');

    const res = await request(app)
      .post(`/api/student/tasks/${taskId}/submit`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .attach('file', Buffer.from('x\n', 'utf8'), 'answer.csv');
    expect(res.status).toBe(404);
  });

  test('does not expose another students enrollment', async () => {
    const res = await request(app)
      .get(`/api/student/courses/${enrollmentId}`)
      .set('Authorization', `Bearer ${otherStudentToken}`);
    expect(res.status).toBe(404);
  });

  test('404 for unknown enrollment id', async () => {
    const res = await request(app)
      .get('/api/student/courses/does-not-exist')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(404);
  });
});