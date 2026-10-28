require('dotenv').config({ path: __dirname + '/../.env' });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-0123456789abcdef';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../generated/prisma');
const app = require('../server');
const settings = require('../src/services/settings');
const { createTenant, listTenants, setTenantStatus } = require('../src/tenancy/provision');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const TENANT_B = { id: 'tenB', slug: 'tenant-b', name: 'Tenant B University' };

function login(email, password, tenant) {
  const req = request(app).post('/api/auth/login').send({ email, password });
  if (tenant) req.set('X-Tenant', tenant);
  return req;
}

beforeAll(async () => {
  // Reset tenant-scoped identity data, keep the default tenant.
  await prisma.user.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.tenant.deleteMany({ where: { id: { not: 'default' } } });
  await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', slug: 'default', name: 'Default University' },
  });
  await prisma.tenant.create({ data: TENANT_B });

  const pw = await bcrypt.hash('Passw0rd123', 10);
  await prisma.user.create({ data: { tenantId: 'default', email: 'shared@uni.edu', password: pw, role: 'ADMIN' } });
  await prisma.user.create({ data: { tenantId: TENANT_B.id, email: 'shared@uni.edu', password: pw, role: 'ADMIN' } });

  settings.invalidate();
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { not: 'default' } } });
  await prisma.$disconnect();
});

describe('Multi-tenancy: identity isolation', () => {
  test('the same email can exist in two tenants and log in independently', async () => {
    const a = await login('shared@uni.edu', 'Passw0rd123');
    const b = await login('shared@uni.edu', 'Passw0rd123', TENANT_B.slug);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.token).toBeTruthy();
    expect(b.body.token).toBeTruthy();
    expect(a.body.token).not.toBe(b.body.token);
  });

  test('unknown tenant header is rejected', async () => {
    const res = await login('shared@uni.edu', 'Passw0rd123', 'does-not-exist');
    expect(res.status).toBe(404);
  });

  test('a token minted for one tenant is rejected on another', async () => {
    const a = await login('shared@uni.edu', 'Passw0rd123');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${a.body.token}`)
      .set('X-Tenant', TENANT_B.slug);
    expect(res.status).toBe(401);
  });

  test('the same token works on its own tenant', async () => {
    const a = await login('shared@uni.edu', 'Passw0rd123');
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${a.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('shared@uni.edu');
  });
});

describe('Multi-tenancy: settings isolation', () => {
  test('branding is scoped per tenant', async () => {
    await settings.setSettings(
      'branding',
      { portalName: 'Tenant B Portal', universityName: 'Tenant B University' },
      null,
      TENANT_B.id,
    );
    settings.invalidate();

    const def = await request(app).get('/api/public/branding');
    const b = await request(app).get('/api/public/branding').set('X-Tenant', TENANT_B.slug);

    expect(def.status).toBe(200);
    expect(b.status).toBe(200);
    expect(def.body.branding.portalName).toBe('Novastra');
    expect(b.body.branding.portalName).toBe('Tenant B Portal');
  });
});

describe('Multi-tenancy: provisioning', () => {
  const PROV = {
    slug: 'prov-test',
    name: 'Provision Test University',
    domain: 'prov.uni.edu',
    adminEmail: 'prov-admin@uni.edu',
    adminPassword: 'ProvPass123',
  };

  test('provisions a tenant with its first admin and derived branding', async () => {
    const result = await createTenant(PROV);
    expect(result.tenant.slug).toBe(PROV.slug);
    expect(result.admin.email).toBe(PROV.adminEmail);

    const loginRes = await login(PROV.adminEmail, PROV.adminPassword, PROV.slug);
    expect(loginRes.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .set('X-Tenant', PROV.slug);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('ADMIN');

    const branding = await request(app).get('/api/public/branding').set('X-Tenant', PROV.slug);
    expect(branding.status).toBe(200);
    expect(branding.body.branding.universityName).toBe(PROV.name);
    expect(branding.body.branding.supportEmail).toBe(`support@${PROV.domain}`);
  });

  test('rejects duplicate slug and bad input', async () => {
    await expect(createTenant(PROV)).rejects.toThrow(/already exists/);
    await expect(createTenant({ ...PROV, slug: 'Bad Slug!' })).rejects.toThrow(/Invalid slug/);
    await expect(createTenant({ ...PROV, slug: 'other-tenant', adminPassword: 'short' })).rejects.toThrow(/at least 8/);
  });

  test('suspended tenants are rejected at resolution and can be reactivated', async () => {
    await setTenantStatus(PROV.slug, 'SUSPENDED');
    const blocked = await login(PROV.adminEmail, PROV.adminPassword, PROV.slug);
    expect(blocked.status).toBe(403);

    await setTenantStatus(PROV.slug, 'ACTIVE');
    const again = await login(PROV.adminEmail, PROV.adminPassword, PROV.slug);
    expect(again.status).toBe(200);
  });

  test('listTenants reports the new tenant with its user count', async () => {
    const tenants = await listTenants();
    const found = tenants.find((t) => t.slug === PROV.slug);
    expect(found).toBeTruthy();
    expect(found._count.users).toBe(1);
    expect(found._count.students).toBe(0);
  });
});

describe('Multi-tenancy: domain data isolation', () => {
  let studentA;
  let studentB;

  beforeAll(async () => {
    const pw = await bcrypt.hash('Passw0rd123', 10);
    const userA = await prisma.user.create({
      data: { tenantId: 'default', email: 'iso-a@uni.edu', password: pw, role: 'STUDENT' },
    });
    const userB = await prisma.user.create({
      data: { tenantId: TENANT_B.id, email: 'iso-b@uni.edu', password: pw, role: 'STUDENT' },
    });
    // Same roll number in both tenants — only possible with composite keys.
    studentA = await prisma.student.create({
      data: { tenantId: 'default', userId: userA.id, rollNumber: 'ISO-001', name: 'Alpha Student', department: 'BSCS', batch: 'ISO26' },
    });
    studentB = await prisma.student.create({
      data: { tenantId: TENANT_B.id, userId: userB.id, rollNumber: 'ISO-001', name: 'Beta Student', department: 'BSCS', batch: 'ISO26' },
    });
  });

  async function adminTokenFor(tenant) {
    const res = await login('shared@uni.edu', 'Passw0rd123', tenant);
    return res.body.token;
  }

  test('admin listing students sees only their own tenant', async () => {
    const tokenA = await adminTokenFor(undefined);
    const tokenB = await adminTokenFor(TENANT_B.slug);

    const listA = await request(app).get('/api/admin/students?search=ISO-001').set('Authorization', `Bearer ${tokenA}`);
    const listB = await request(app).get('/api/admin/students?search=ISO-001').set('Authorization', `Bearer ${tokenB}`).set('X-Tenant', TENANT_B.slug);

    expect(listA.status).toBe(200);
    expect(listB.status).toBe(200);
    expect(listA.body.students).toHaveLength(1);
    expect(listB.body.students).toHaveLength(1);
    expect(listA.body.students[0].name).toBe('Alpha Student');
    expect(listB.body.students[0].name).toBe('Beta Student');
  });

  test('cross-tenant student update is rejected (404 via scoped where)', async () => {
    const tokenA = await adminTokenFor(undefined);
    const res = await request(app)
      .put(`/api/admin/students/${studentB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(404);

    const untouched = await prisma.student.findUnique({ where: { id: studentB.id } });
    expect(untouched.name).toBe('Beta Student');
  });

  test('same-tenant student update works', async () => {
    const tokenA = await adminTokenFor(undefined);
    const res = await request(app)
      .put(`/api/admin/students/${studentA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Renamed OK' });
    expect(res.status).toBe(200);
    expect(res.body.student.name).toBe('Renamed OK');
  });
});

