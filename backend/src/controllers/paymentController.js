const prisma = require('../config/db');
const { log, logAudit } = require('../utils/logger');
const { getTenantId } = require('../tenancy/context');
const {
  providerName,
  createStripeCheckout,
  verifyStripeWebhook,
  settlePayment,
  reconcileStripePayments,
} = require('../services/payments');

const SIM_METHODS = ['CARD', 'BANK', 'WALLET'];

function randomReference() {
  return `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/**
 * POST /api/payments/checkout { challanId }
 *
 * With PAYMENT_PROVIDER=stripe this creates a Stripe Checkout Session and
 * returns { url } for the browser to redirect to; the payment settles when the
 * signed webhook arrives (or via reconciliation). With the default simulated
 * provider the demo flow settles immediately.
 */
exports.checkout = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const { challanId, method = 'CARD', cardNumber } = req.body;
    if (!challanId) return res.status(400).json({ message: 'challanId is required' });

    const challan = await prisma.feeChallan.findUnique({ where: { id: challanId } });
    if (!challan || challan.studentId !== student.id) {
      return res.status(404).json({ message: 'Challan not found' });
    }
    if (challan.status === 'PAID') {
      return res.status(400).json({ message: 'Challan is already paid' });
    }

    if (providerName() === 'stripe') {
      return stripeCheckout(req, res, { student, challan });
    }
    return simulatedCheckout(req, res, { student, challan, method, cardNumber });
  } catch (err) {
    next(err);
  }
};

async function stripeCheckout(req, res, { student, challan }) {
  const payment = await prisma.payment.create({
    data: {
      challanId: challan.id,
      studentId: student.id,
      amount: challan.totalAmount,
      method: 'CARD',
      reference: randomReference(),
      status: 'PENDING',
    },
  });

  try {
    const session = await createStripeCheckout({ payment, challan, tenantId: getTenantId() });
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { reference: session.id },
    });

    logAudit('PAYMENT_INITIATED', {
      userId: req.user.id, entity: 'Payment', entityId: payment.id, ipAddress: req.ip,
      details: `Stripe session ${session.id} for Rs. ${challan.totalAmount}`,
    });

    return res.status(201).json({
      message: 'Checkout session created',
      provider: 'stripe',
      url: session.url,
      payment: updated,
    });
  } catch (err) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } }).catch(() => {});
    if (err.code === 'STRIPE_NOT_CONFIGURED') {
      return res.status(503).json({ message: 'Card payments are not configured on this portal yet' });
    }
    log('error', 'stripe_checkout_failed', { error: err.message, paymentId: payment.id });
    return res.status(502).json({ message: 'Payment gateway unavailable, please try again shortly' });
  }
}

async function simulatedCheckout(req, res, { student, challan, method, cardNumber }) {
  if (!SIM_METHODS.includes(method)) {
    return res.status(400).json({ message: 'method must be CARD, BANK or WALLET' });
  }

  // Simulated gateway: card numbers ending in 0000 are declined (demo failure path)
  const declined = method === 'CARD' && cardNumber && cardNumber.replace(/\D/g, '').endsWith('0000');
  const reference = randomReference();

  const payment = await prisma.payment.create({
    data: {
      challanId: challan.id,
      studentId: student.id,
      amount: challan.totalAmount,
      method,
      reference,
      status: declined ? 'FAILED' : 'PENDING',
    },
  });

  if (declined) {
    logAudit('PAYMENT_FAILED', {
      userId: req.user.id, entity: 'Payment', entityId: payment.id, ipAddress: req.ip, details: reference,
    });
    return res.status(402).json({ message: 'Card declined by gateway (demo: cards ending 0000 fail)', payment });
  }

  const result = await settlePayment({ paymentId: payment.id, source: 'simulated_gateway' });
  if (!result.settled) {
    return res.status(409).json({ message: `Payment could not be settled (${result.reason})` });
  }

  return res.status(201).json({
    message: 'Payment successful — challan marked as paid',
    provider: 'simulated',
    payment: result.payment,
  });
}

/**
 * POST /api/payments/webhook/stripe
 *
 * Mounted BEFORE tenant resolution (Stripe cannot send tenant headers); the
 * tenant comes from the Checkout Session metadata. Signature-verified against
 * the raw body. Returns 5xx on processing errors so Stripe retries.
 */
exports.stripeWebhook = async (req, res) => {
  if (providerName() !== 'stripe') {
    return res.status(503).json({ message: 'Stripe provider is not enabled' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).json({ message: 'Missing stripe-signature header' });

  let event;
  try {
    event = verifyStripeWebhook(req.rawBody || req.body, signature);
  } catch (err) {
    log('warn', 'stripe_webhook_invalid_signature', { error: err.message });
    return res.status(400).json({ message: 'Invalid signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
          const result = await settlePayment({
            paymentId: session.metadata?.paymentId || session.client_reference_id,
            providerRef: session.id,
            tenantId: session.metadata?.tenantId || null,
            source: 'stripe_webhook',
          });
          log('info', 'stripe_webhook_settled', { sessionId: session.id, ...resultMeta(result) });
        }
        break;
      }
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object;
        const paymentId = session.metadata?.paymentId || session.client_reference_id;
        if (paymentId) {
          await failPayment(paymentId, session.metadata?.tenantId);
        }
        break;
      }
      default:
        break; // ignore unrelated events
    }
    return res.json({ received: true });
  } catch (err) {
    log('error', 'stripe_webhook_processing_failed', { eventId: event.id, type: event.type, error: err.message });
    return res.status(500).json({ message: 'Webhook processing failed' });
  }
};

function resultMeta(result) {
  return result.settled ? { settled: true } : { settled: false, reason: result.reason };
}

async function failPayment(paymentId, tenantId) {
  const { runWithTenant } = require('../tenancy/context');
  const run = async () => {
    const payment = await prisma.payment.findFirst({ where: { id: paymentId } });
    if (!payment || payment.status !== 'PENDING') return;
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    logAudit('PAYMENT_FAILED', { entity: 'Payment', entityId: payment.id, details: payment.reference });
  };
  return tenantId ? runWithTenant({ id: tenantId }, run) : run();
}

/**
 * POST /api/payments/reconcile (admin)
 *
 * Settles pending Stripe payments the webhook may have missed (e.g. downtime).
 */
exports.reconcile = async (req, res, next) => {
  try {
    if (providerName() !== 'stripe') {
      return res.status(400).json({ message: 'Reconciliation is only available when PAYMENT_PROVIDER=stripe' });
    }
    const olderThanMinutes = Number(req.body?.olderThanMinutes) || 30;
    const summary = await reconcileStripePayments({ olderThanMinutes });
    res.json({ message: 'Reconciliation complete', summary });
  } catch (err) {
    next(err);
  }
};

exports.history = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const payments = await prisma.payment.findMany({
      where: { studentId: student.id },
      include: { challan: { select: { voucherId: true, semester: true, totalAmount: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ payments });
  } catch (err) {
    next(err);
  }
};

exports.all = async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      include: {
        challan: { select: { voucherId: true, semester: true } },
        student: { select: { rollNumber: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const revenue = payments
      .filter((p) => p.status === 'COMPLETED')
      .reduce((s, p) => s + p.amount, 0);
    res.json({ payments, totalCollected: revenue });
  } catch (err) {
    next(err);
  }
};
