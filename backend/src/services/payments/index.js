const prisma = require('../../config/db');
const { env } = require('../../config/env');
const { log, logAudit } = require('../../utils/logger');
const { runWithTenant, getTenantId } = require('../../tenancy/context');

/**
 * Payment provider facade.
 *
 *  - PAYMENT_PROVIDER=simulated (default): in-house demo flow. Card numbers
 *    ending in 0000 decline; everything else settles immediately. Used for
 *    local development and demos.
 *  - PAYMENT_PROVIDER=stripe: real card payments through Stripe Checkout.
 *    Requires STRIPE_SECRET_KEY and (for webhooks) STRIPE_WEBHOOK_SECRET.
 *
 * Provider selection is read from process.env at call time so ops can flip
 * providers without a restart and tests can switch it per-suite.
 */

function providerName() {
  const raw = (process.env.PAYMENT_PROVIDER || 'simulated').toLowerCase();
  return raw === 'stripe' ? 'stripe' : 'simulated';
}

function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let stripeClient = null;

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    const err = new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
    err.code = 'STRIPE_NOT_CONFIGURED';
    throw err;
  }
  if (stripeClient && stripeClient.__configuredKey === key) return stripeClient;
  const Stripe = require('stripe');
  stripeClient = new Stripe(key);
  stripeClient.__configuredKey = key;
  return stripeClient;
}

function paymentCurrency() {
  return (process.env.PAYMENT_CURRENCY || 'pkr').toLowerCase();
}

/** Minor units for Stripe (PKR/USD etc. have 2 decimals). */
function toMinorUnits(amount) {
  return Math.round(Number(amount) * 100);
}

/**
 * Create a Stripe Checkout Session for a challan payment.
 * Returns the session; the caller stores `session.id` as the payment reference.
 */
async function createStripeCheckout({ payment, challan, tenantId }) {
  const stripe = getStripe();
  const config = env();
  const currency = paymentCurrency();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: payment.id,
    metadata: {
      paymentId: payment.id,
      challanId: challan.id,
      studentId: challan.studentId,
      tenantId: tenantId || 'default',
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: toMinorUnits(challan.totalAmount),
          product_data: {
            name: `Fee voucher ${challan.voucherId} (Semester ${challan.semester})`,
          },
        },
      },
    ],
    success_url: `${config.CLIENT_URL}/student/challans?payment=success&session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.CLIENT_URL}/student/challans?payment=cancelled`,
  });

  return session;
}

/** Verify a Stripe webhook signature against the raw request body. */
function verifyStripeWebhook(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    const err = new Error('STRIPE_WEBHOOK_SECRET is not configured');
    err.code = 'STRIPE_NOT_CONFIGURED';
    throw err;
  }
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** Retrieve a Checkout Session (used by reconciliation). */
async function retrieveStripeSession(sessionId) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Settle a pending payment: mark it completed and the challan paid, notify the
 * student, and audit. Idempotent — safe to call from webhooks and reconcilers.
 *
 * Runs inside the payment's tenant context (from webhook metadata) so Prisma
 * scoping, audit logs and notifications land in the right tenant.
 */
async function settlePayment({ paymentId, providerRef = null, tenantId = null, source = 'gateway' }) {
  const run = async () => {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId },
      include: { challan: true, student: { include: { user: { select: { id: true, email: true, tenantId: true } } } } },
    });
    if (!payment) return { settled: false, reason: 'payment_not_found' };
    if (payment.status === 'COMPLETED') return { settled: false, reason: 'already_completed' };
    if (payment.status !== 'PENDING') return { settled: false, reason: `not_pending_${payment.status}` };

    const challan = payment.challan;
    if (challan.status === 'PAID') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      return { settled: false, reason: 'challan_already_paid' };
    }

    const receiptRef = providerRef || payment.reference;

    const settled = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          ...(providerRef ? { reference: providerRef } : {}),
        },
      });
      await tx.feeChallan.update({
        where: { id: challan.id },
        data: { status: 'PAID', paidAt: new Date() },
      });
      const preference = await tx.notificationPreference.findUnique({
        where: { userId_category: { userId: payment.student.user.id, category: 'FEES' } },
        select: { inApp: true },
      });
      if (preference?.inApp !== false) {
        await tx.notification.create({
          data: {
            userId: payment.student.user.id,
            title: 'Payment Received',
            body: `Rs. ${Number(challan.totalAmount).toLocaleString()} received for voucher ${challan.voucherId}. Reference: ${receiptRef}`,
            type: 'SUCCESS',
            link: '/student/challans',
          },
        });
      }
      return updated;
    });

    logAudit('PAYMENT_COMPLETED', {
      userId: payment.student.user.id,
      entity: 'Payment',
      entityId: settled.id,
      details: `${payment.method} Rs. ${challan.totalAmount} (${receiptRef}) via ${source}`,
    });

    // Out-of-band comms: email receipt + optional SMS (fire and forget).
    const { notifyComms } = require('../notify');
    notifyComms({
      user: payment.student.user,
      phone: payment.student.phone,
      emailTemplate: {
        name: 'paymentReceipt',
        data: {
          name: payment.student.name,
          voucher: challan.voucherId,
          amount: Number(challan.totalAmount).toLocaleString(),
          reference: receiptRef,
        },
      },
      sms: `Payment of Rs. ${Number(challan.totalAmount).toLocaleString()} received for voucher ${challan.voucherId}. Ref: ${receiptRef}`,
      type: 'FEES',
    });

    return { settled: true, payment: settled, challan };
  };

  if (tenantId) return runWithTenant({ id: tenantId }, run);
  return run();
}

/**
 * Reconcile pending Stripe payments against the gateway. Used by cron/scripts
 * and the admin endpoint. Settles payments Stripe says are paid, fails ones
 * whose session expired.
 */
async function reconcileStripePayments({ olderThanMinutes = 30, limit = 100 } = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const tenantId = getTenantId();
  const pending = await prisma.payment.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff }, reference: { startsWith: 'cs_' } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const summary = { checked: pending.length, settled: 0, expired: 0, unchanged: 0, errors: 0 };
  for (const p of pending) {
    try {
      const session = await retrieveStripeSession(p.reference);
      if (session.payment_status === 'paid') {
        const r = await settlePayment({ paymentId: p.id, providerRef: session.id, tenantId, source: 'reconcile' });
        if (r.settled) summary.settled += 1;
        else summary.unchanged += 1;
      } else if (session.status === 'expired') {
        await prisma.payment.update({ where: { id: p.id }, data: { status: 'FAILED' } });
        summary.expired += 1;
      } else {
        summary.unchanged += 1;
      }
    } catch (err) {
      summary.errors += 1;
      log('warn', 'reconcile_payment_failed', { paymentId: p.id, error: err.message });
    }
  }
  return summary;
}

module.exports = {
  providerName,
  stripeConfigured,
  getStripe,
  createStripeCheckout,
  verifyStripeWebhook,
  retrieveStripeSession,
  settlePayment,
  reconcileStripePayments,
  paymentCurrency,
};
