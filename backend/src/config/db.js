require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient, Prisma } = require('../../generated/prisma');
const { getTenantId } = require('../tenancy/context');

/**
 * Tenant-scoped Prisma client.
 *
 * Every model that carries a `tenantId` column is automatically filtered to the
 * active request tenant (see `tenancy/context.js`). This centralises isolation
 * so controllers cannot accidentally read or write another tenant's rows.
 *
 * Behaviour when no tenant context is active (CLI scripts, maintenance jobs,
 * background purge): queries pass through unscoped by design — those run
 * privileged and intentionally operate across tenants.
 *
 * Manually handled (compound keys must be passed explicitly by callers):
 *   FeeStructure.semester, EvaluationWindow.(semester, year),
 *   Student.rollNumber, FeeChallan.voucherId, Payment.reference, etc.
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const base = new PrismaClient({ adapter });

const TENANT_MODELS = new Set(
  Prisma.dmmf.datamodel.models
    .filter((m) => m.name !== 'Tenant' && m.fields.some((f) => f.name === 'tenantId'))
    .map((m) => m.name)
);

const WHERE_FILTER_OPS = new Set([
  'findFirst', 'findMany', 'findFirstOrThrow', 'count', 'aggregate', 'groupBy',
]);
const WHERE_MANY_OPS = new Set(['updateMany', 'deleteMany']);
const UNIQUE_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete']);

/** Injects tenantId into a unique-mode `where` (id present) or compound key containing tenantId. */
function scopeUniqueWhere(where, tenantId) {
  if (!where || typeof where !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(where, 'id')) where.tenantId = tenantId;
  for (const key of Object.keys(where)) {
    if (key === 'tenantId') continue;
    const nested = where[key];
    if (nested && typeof nested === 'object' && /tenantid/i.test(key)) {
      nested.tenantId = tenantId;
    }
  }
}

const prisma = base.$extends({
  name: 'tenant-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) return query(args);

        const tenantId = getTenantId();
        if (!tenantId) return query(args); // privileged / out-of-request context

        const next = args || {};

        if (operation === 'create') {
          next.data = { ...(next.data || {}), tenantId };
        } else if (operation === 'createMany' || operation === 'createManyAndReturn') {
          next.data = Array.isArray(next.data)
            ? next.data.map((d) => ({ ...d, tenantId }))
            : { ...(next.data || {}), tenantId };
        } else if (operation === 'upsert') {
          next.where = next.where || {};
          scopeUniqueWhere(next.where, tenantId);
          next.create = { ...(next.create || {}), tenantId };
        } else if (WHERE_FILTER_OPS.has(operation)) {
          next.where = { tenantId, ...(next.where || {}) };
        } else if (WHERE_MANY_OPS.has(operation)) {
          next.where = { tenantId, ...(next.where || {}) };
        } else if (UNIQUE_OPS.has(operation)) {
          next.where = next.where || {};
          scopeUniqueWhere(next.where, tenantId);
        }

        return query(next);
      },
    },
  },
});

module.exports = prisma;
module.exports.TENANT_MODELS = TENANT_MODELS;
