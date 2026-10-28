require('dotenv').config({ path: __dirname + '/../.env' });
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-0123456789abcdef';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
process.env.PAYMENT_PROVIDER = 'stripe';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake_for_offline_webhook_tests';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_123';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const Stripe = require('stripe');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../generated/prisma');
const app = require('../server');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const PASSWORD = 'Passw0rd123';

const TENANT_B = { id: 'tenB', slug: 'tenant-b', name: 'Tenant B University' };

let studentToken;
let student;
let challan;

async function login(email) {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function makeStudent(tenantId, rollNumber, email) {
  const user = await prisma.user.create({
    data: { tenantId, email, password: await bcrypt.hash(PASSWORD, 10), role: 'STUDENT' },
  });
  const profile = await prisma.student.create({
    data: { tenantId, userId: user.id, rollNumber, name: `Student ${rollNumber}`, department: 'CS', batch: 'SP23' },
  });
  const ownChallan = await prisma.feeChallan.create({
    data: {
      tenantId,
      studentId: profile.id,
      semester: 3,
      voucherId: `VCH-3-${rollNumber}`,
      creditHours: 15,
      totalAmount: 45000,
      dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  return { user, profile, challan: ownChallan };
}

function checkoutEvent({
  eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  type = 'checkout.session.completed',
  csId,
  paymentId,
  challanId,
  studentId,
  tenantId = 'default',
  paymentStatus = 'paid',
}) {
  return JSON.stringify({
    id: eventId,
    object: 'event',
    api_version: '2025-01-01',
    type,
    data: {
      object: {
        id: csId,
        object: 'checkout.session',
        payment_status: paymentStatus,
        status: paymentStatus === 'paid' ? 'complete' : 'open',
        client_reference_id: paymentId,
        metadata: { paymentId, challanId, studentId, tenantId },
      },
    },
  });
}

function signPayload(payload) {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
}

function postWebhook(payload, signature) {
  const req = request(app)
    .post('/api/payments/webhook/stripe')
    .set('Content-Type', 'application/json');
  if (signature) req.set('stripe-signature', signature);
  // Send the exact raw string — superagent serializes Buffers as JSON objects
  return req.send(payload);
}

async function makePendingPayment({ tenantId = 'default', csId, overrides = {} }) {
  return prisma.payment.create({
    data: {
      tenantId,
      challanId: challan.id,
      studentId: student.id,
      amount: challan.totalAmount,
      method: 'CARD',
      reference: csId,
      status: 'PENDING',
      ...overrides,
    },
  });
}

beforeAll(async () => {
  await prisma.payment.deleteMany();
  await prisma.feeChallan.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany({ where: { id: { not: 'default' } } });
  await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', slug: 'default', name: 'Default University' },
  });
  await prisma.tenant.create({ data: TENANT_B });

  const a = await makeStudent('default', 'SP23-BSCS-001', 'pay-student@uni.edu');
  student = a.profile;
  challan = a.challan;
  studentToken = await login('pay-student@uni.edu');
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { not: 'default' } } });
  await prisma.$disconnect();
});

afterEach(() => {
  process.env.PAYMENT_PROVIDER = 'stripe';
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake_for_offline_webhook_tests';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret_123';
});

describe('Payments: simulated provider (demo flow)', () => {
  test('checkout settles a challan and blocks double payment', async () => {
    process.env.PAYMENT_PROVIDER = 'simulated';
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ challanId: challan.id, method: 'CARD' });

    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('COMPLETED');

    const fresh = await prisma.feeChallan.findUnique({ where: { id: challan.id } });
    expect(fresh.status).toBe('PAID');

    const again = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ challanId: challan.id, method: 'CARD' });
    expect(again.status).toBe(400);
  });

  test('declined card fails the payment and leaves the challan unpaid', async () => {
    process.env.PAYMENT_PROVIDER = 'simulated';
    const c = await prisma.feeChallan.create({
      data: {
        studentId: student.id, semester: 4, voucherId: 'VCH-4-DECLINE', creditHours: 12,
        totalAmount: 36000, dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      },
    });
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ challanId: c.id, method: 'CARD', cardNumber: '4242 4242 4242 0000' });

    expect(res.status).toBe(402);
    const fresh = await prisma.feeChallan.findUnique({ where: { id: c.id } });
    expect(fresh.status).not.toBe('PAID');
  });

  test('a student cannot pay another student\'s challan', async () => {
    process.env.PAYMENT_PROVIDER = 'simulated';
    const other = await makeStudent('default', 'SP23-BSCS-002', 'pay-student2@uni.edu');
    const otherToken = await login('pay-student2@uni.edu');
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ challanId: challan.id, method: 'CARD' });
    expect(res.status).toBe(404);
    expect(other.challan.id).toBeTruthy();
  });

  test('checkout requires authentication', async () => {
    const res = await request(app).post('/api/payments/checkout').send({ challanId: challan.id });
    expect(res.status).toBe(401);
  });
});

describe('Payments: Stripe provider', () => {
  test('checkout returns 503 when Stripe keys are missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const c = await prisma.feeChallan.create({
      data: {
        studentId: student.id, semester: 5, voucherId: 'VCH-5-NOKEY', creditHours: 12,
        totalAmount: 36000, dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      },
    });
    const res = await request(app)
      .post('/api/payments/checkout')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ challanId: c.id });
    expect(res.status).toBe(503);

    const payment = await prisma.payment.findFirst({ where: { challanId: c.id } });
    expect(payment.status).toBe('FAILED');
  });

  test('webhook endpoint rejects invalid signatures', async () => {
    const payment = await makePendingPayment({ csId: 'cs_test_badsig' });
    const payload = checkoutEvent({
      csId: 'cs_test_badsig', paymentId: payment.id, challanId: challan.id, studentId: student.id,
    });
    const res = await postWebhook(payload, 't=123,v1=deadbeef');
    expect(res.status).toBe(400);

    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh.status).toBe('PENDING');
    await prisma.payment.delete({ where: { id: payment.id } });
  });

  test('a signed checkout.session.completed settles payment, challan and notification', async () => {
    const c = await prisma.feeChallan.create({
      data: {
        studentId: student.id, semester: 6, voucherId: 'VCH-6-STRIPE', creditHours: 15,
        totalAmount: 45000, dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      },
    });
    const payment = await makePendingPayment({
      csId: 'cs_test_ok_1',
      overrides: { challanId: c.id },
    });

    const payload = checkoutEvent({
      csId: 'cs_test_ok_1', paymentId: payment.id, challanId: c.id, studentId: student.id,
    });
    const res = await postWebhook(payload, signPayload(payload));
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const settledPayment = await prisma.payment.findUnique({ where: { id: payment.id } });
    const settledChallan = await prisma.feeChallan.findUnique({ where: { id: c.id } });
    expect(settledPayment.status).toBe('COMPLETED');
    expect(settledPayment.reference).toBe('cs_test_ok_1');
    expect(settledChallan.status).toBe('PAID');

    const notes = await prisma.notification.findMany({ where: { userId: student.userId } });
    expect(notes.some((n) => n.title === 'Payment Received')).toBe(true);

    // Duplicate delivery is a no-op (idempotent)
    const before = await prisma.notification.count({ where: { userId: student.userId } });
    const dup = await postWebhook(payload, signPayload(payload));
    expect(dup.status).toBe(200);
    const after = await prisma.notification.count({ where: { userId: student.userId } });
    expect(after).toBe(before);
  });

  test('checkout.session.expired marks the payment failed', async () => {
    const c = await prisma.feeChallan.create({
      data: {
        studentId: student.id, semester: 7, voucherId: 'VCH-7-EXP', creditHours: 9,
        totalAmount: 27000, dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000),
      },
    });
    const payment = await makePendingPayment({ csId: 'cs_test_expired', overrides: { challanId: c.id } });
    const payload = checkoutEvent({
      type: 'checkout.session.expired', csId: 'cs_test_expired', paymentId: payment.id,
      challanId: c.id, studentId: student.id, paymentStatus: 'unpaid',
    });
    const res = await postWebhook(payload, signPayload(payload));
    expect(res.status).toBe(200);

    const fresh = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(fresh.status).toBe('FAILED');
  });

  test('webhook settles payments in the tenant from metadata (cross-tenant isolation)', async () => {
    const b = await makeStudent(TENANT_B.id, 'TB-001', 'student@tenant-b.edu');
    const payment = await prisma.payment.create({
      data: {
        tenantId: TENANT_B.id, challanId: b.challan.id, studentId: b.profile.id,
        amount: b.challan.totalAmount, method: 'CARD', reference: 'cs_test_tenB', status: 'PENDING',
      },
    });

    const payload = checkoutEvent({
      csId: 'cs_test_tenB', paymentId: payment.id, challanId: b.challan.id,
      studentId: b.profile.id, tenantId: TENANT_B.id,
    });
    const res = await postWebhook(payload, signPayload(payload));
    expect(res.status).toBe(200);

    const settled = await prisma.payment.findUnique({ where: { id: payment.id } });
    const tenantChallan = await prisma.feeChallan.findUnique({ where: { id: b.challan.id } });
    expect(settled.status).toBe('COMPLETED');
    expect(settled.tenantId).toBe(TENANT_B.id);
    expect(tenantChallan.status).toBe('PAID');

    const note = await prisma.notification.findFirst({ where: { userId: b.user.id } });
    expect(note).toBeTruthy();
    expect(note.tenantId).toBe(TENANT_B.id);
  });

  test('webhook is disabled while the simulated provider is active', async () => {
    process.env.PAYMENT_PROVIDER = 'simulated';
    const payload = checkoutEvent({
      csId: 'cs_test_nope', paymentId: 'whatever', challanId: 'x', studentId: 'y',
    });
    const res = await postWebhook(payload, 't=1,v1=deadbeef');
    expect(res.status).toBe(503);
  });

  test('reconciliation endpoint requires stripe and reports a summary', async () => {
    process.env.PAYMENT_PROVIDER = 'simulated';
    const adminUser = await prisma.user.create({
      data: { email: 'pay-admin@uni.edu', password: await bcrypt.hash(PASSWORD, 10), role: 'ADMIN' },
    });
    const adminToken = await login('pay-admin@uni.edu');

    const off = await request(app)
      .post('/api/payments/reconcile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(off.status).toBe(400);

    process.env.PAYMENT_PROVIDER = 'stripe';
    const on = await request(app)
      .post('/api/payments/reconcile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ olderThanMinutes: 30 });
    expect(on.status).toBe(200);
    expect(on.body.summary.checked).toBe(0);

    await prisma.user.delete({ where: { id: adminUser.id } });
  });
});
