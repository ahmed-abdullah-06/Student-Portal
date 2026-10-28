require('dotenv').config({ path: __dirname + '/../.env' });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-0123456789abcdef';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../generated/prisma');
const app = require('../server');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const PLATFORM = { email: 'platform@test.local', password: 'Platform123!' };

async function platformLogin() {
  const res = await request(app).post('/api/platform/login').send(PLATFORM);
  return res;
}

function platformReq(method, url, token) {
  return request(app)[method](url).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  await prisma.platformAdmin.deleteMany();
  await prisma.tenant.deleteMany({ where: { id: { not: 'default' } } });
  await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', slug: 'default', name: 'Default University' },
  });
  await prisma.platformAdmin.create({
    data: { email: PLATFORM.email, password: await bcrypt.hash(PLATFORM.password, 10), name: 'Test Operator' },
  });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { not: 'default' } } });
  await prisma.platformAdmin.deleteMany();
  await prisma.$disconnect();
});

describe('Platform: authentication boundaries', () => {
  test('platform login works and rejects wrong password', async () => {
    const ok = await platformLogin();
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();
    expect(ok.body.admin.email).toBe(PLATFORM.email);

    const bad = await request(app).post('/api/platform/login').send({ ...PLATFORM, password: 'wrong-pass-1' });
    expect(bad.status).toBe(401);
  });

  test('platform token is rejected on tenant endpoints', async () => {
    const { body } = await platformLogin();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(401);
  });

  test('tenant token is rejected on platform endpoints', async () => {
    const tenant = await prisma.tenant.findFirst({ where: { id: 'default' } });
    const pw = await bcrypt.hash('Passw0rd123', 10);
    await prisma.user.deleteMany({ where: { email: 'boundary@uni.edu' } });
    await prisma.user.create({ data: { tenantId: tenant.id, email: 'boundary@uni.edu', password: pw, role: 'ADMIN' } });
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'boundary@uni.edu', password: 'Passw0rd123' });
    expect(loginRes.status).toBe(200);

    const res = await platformReq('get', '/api/platform/stats', loginRes.body.token);
    expect(res.status).toBe(401);
  });
});

describe('Platform: tenant management', () => {
  let token;

  beforeAll(async () => {
    const res = await platformLogin();
    token = res.body.token;
  });

  test('stats summarises the platform', async () => {
    const res = await platformReq('get', '/api/platform/stats', token);
    expect(res.status).toBe(200);
    expect(res.body.stats.tenants).toBeGreaterThanOrEqual(1);
    expect(res.body.stats.activeTenants).toBeGreaterThanOrEqual(1);
    expect(res.body.plans.standard).toBeTruthy();
  });

  test('lists tenants with usage and limits', async () => {
    const res = await platformReq('get', '/api/platform/tenants', token);
    expect(res.status).toBe(200);
    const def = res.body.tenants.find((t) => t.slug === 'default');
    expect(def).toBeTruthy();
    expect(def.usage.limits.plan).toBe('standard');
    expect(def.usage.limits.maxStudents).toBe(5000);
  });

  test('creates a tenant, whose admin can log in and sees isolated data', async () => {
    const res = await platformReq('post', '/api/platform/tenants', token).send({
      slug: 'plat-tenant',
      name: 'Platform Test University',
      adminEmail: 'admin@plat-tenant.edu.pk',
      adminPassword: 'PlatTenant123',
      plan: 'starter',
    });
    expect(res.status).toBe(201);
    expect(res.body.tenant.slug).toBe('plat-tenant');
    expect(res.body.tenant.plan).toBe('starter');

    const login = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant', 'plat-tenant')
      .send({ email: 'admin@plat-tenant.edu.pk', password: 'PlatTenant123' });
    expect(login.status).toBe(200);

    const students = await request(app)
      .get('/api/admin/students')
      .set('Authorization', `Bearer ${login.body.token}`)
      .set('X-Tenant', 'plat-tenant');
    expect(students.status).toBe(200);
    expect(students.body.pagination.total).toBe(0);
  });

  test('validates plan/status input on create and update', async () => {
    const badPlan = await platformReq('post', '/api/platform/tenants', token).send({
      slug: 'bad-plan-t', name: 'Bad', adminEmail: 'a@b.co', adminPassword: 'Password123', plan: 'platinum',
    });
    expect(badPlan.status).toBe(400);

    const badStatus = await platformReq('patch', '/api/platform/tenants/plat-tenant', token).send({ status: 'DELETED' });
    expect(badStatus.status).toBe(400);
  });

  test('suspending blocks tenant logins; reactivating restores them', async () => {
    const suspend = await platformReq('patch', '/api/platform/tenants/plat-tenant', token).send({ status: 'SUSPENDED' });
    expect(suspend.status).toBe(200);

    const blocked = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant', 'plat-tenant')
      .send({ email: 'admin@plat-tenant.edu.pk', password: 'PlatTenant123' });
    expect(blocked.status).toBe(403);

    await platformReq('patch', '/api/platform/tenants/plat-tenant', token).send({ status: 'ACTIVE' });
    const ok = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant', 'plat-tenant')
      .send({ email: 'admin@plat-tenant.edu.pk', password: 'PlatTenant123' });
    expect(ok.status).toBe(200);
  });

  test('quota overrides are enforced on student creation', async () => {
    const patch = await platformReq('patch', '/api/platform/tenants/plat-tenant', token).send({ maxStudents: 1 });
    expect(patch.status).toBe(200);
    expect(patch.body.tenant.usage.limits.maxStudents).toBe(1);

    const login = await request(app)
      .post('/api/auth/login')
      .set('X-Tenant', 'plat-tenant')
      .send({ email: 'admin@plat-tenant.edu.pk', password: 'PlatTenant123' });
    const adminToken = login.body.token;

    const first = await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant', 'plat-tenant')
      .send({ email: 'q1@plat-tenant.edu.pk', password: 'Student123', rollNumber: 'QT-001', name: 'Quota One', department: 'BSCS', batch: 'QT26' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant', 'plat-tenant')
      .send({ email: 'q2@plat-tenant.edu.pk', password: 'Student123', rollNumber: 'QT-002', name: 'Quota Two', department: 'BSCS', batch: 'QT26' });
    expect(second.status).toBe(403);
    expect(second.body.code).toBe('PLAN_LIMIT_REACHED');

    await platformReq('patch', '/api/platform/tenants/plat-tenant', token).send({ maxStudents: 10 });
    const third = await request(app)
      .post('/api/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant', 'plat-tenant')
      .send({ email: 'q3@plat-tenant.edu.pk', password: 'Student123', rollNumber: 'QT-003', name: 'Quota Three', department: 'BSCS', batch: 'QT26' });
    expect(third.status).toBe(201);
  });
});
