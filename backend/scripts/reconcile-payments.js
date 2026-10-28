#!/usr/bin/env node
/**
 * Reconcile pending Stripe payments across all active tenants.
 * Intended to run from cron (e.g. every 30 minutes) as a webhook safety net.
 *
 *   node scripts/reconcile-payments.js [olderThanMinutes]
 */
require('dotenv').config();

const prisma = require('../src/config/db');
const { runWithTenant } = require('../src/tenancy/context');
const { providerName, reconcileStripePayments } = require('../src/services/payments');

async function main() {
  if (providerName() !== 'stripe') {
    console.log(`PAYMENT_PROVIDER=${providerName()} — reconciliation only applies to the stripe provider.`);
    return;
  }

  const olderThanMinutes = Number(process.argv[2]) || 30;
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, slug: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  let grandTotal = { checked: 0, settled: 0, expired: 0, unchanged: 0, errors: 0 };
  for (const tenant of tenants) {
    const summary = await runWithTenant(tenant, () => reconcileStripePayments({ olderThanMinutes }));
    if (summary.checked > 0) {
      console.log(`[${tenant.slug}] checked=${summary.checked} settled=${summary.settled} expired=${summary.expired} unchanged=${summary.unchanged} errors=${summary.errors}`);
    }
    for (const k of Object.keys(grandTotal)) grandTotal[k] += summary[k];
  }

  console.log(`Done. checked=${grandTotal.checked} settled=${grandTotal.settled} expired=${grandTotal.expired} unchanged=${grandTotal.unchanged} errors=${grandTotal.errors}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('reconcile-payments failed:', err.message);
  process.exit(1);
});
