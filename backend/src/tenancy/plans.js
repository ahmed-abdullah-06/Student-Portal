const prisma = require('../config/db');

/**
 * SaaS plan catalog and quota enforcement.
 *
 * `Tenant.plan` selects the catalog entry; `Tenant.maxStudents` /
 * `Tenant.maxFaculty` can override it per tenant (custom enterprise deals).
 * `null` limit means unlimited.
 */

const PLANS = {
  starter: {
    label: 'Starter',
    maxStudents: 500,
    maxFaculty: 50,
    features: { smsNotifications: false, chatEnabled: true },
  },
  standard: {
    label: 'Standard',
    maxStudents: 5000,
    maxFaculty: 500,
    features: { smsNotifications: true, chatEnabled: true },
  },
  enterprise: {
    label: 'Enterprise',
    maxStudents: null,
    maxFaculty: null,
    features: { smsNotifications: true, chatEnabled: true },
  },
};

const DEFAULT_PLAN = 'standard';
const RESOURCES = ['students', 'faculty'];

function planFor(name) {
  return PLANS[name] || null;
}

function effectiveLimits(tenant) {
  const plan = planFor(tenant?.plan) || PLANS[DEFAULT_PLAN];
  return {
    plan: tenant?.plan && PLANS[tenant.plan] ? tenant.plan : DEFAULT_PLAN,
    label: plan.label,
    maxStudents: tenant?.maxStudents ?? plan.maxStudents,
    maxFaculty: tenant?.maxFaculty ?? plan.maxFaculty,
  };
}

function limitFor(limits, resource) {
  return resource === 'students' ? limits.maxStudents : limits.maxFaculty;
}

/**
 * Express middleware: rejects creation when the tenant's plan quota for
 * `resource` is exhausted. Must run inside tenant context (after tenantResolver
 * and auth) so the count is automatically tenant-scoped.
 */
function enforceQuota(resource) {
  if (!RESOURCES.includes(resource)) throw new Error(`Unknown quota resource: ${resource}`);

  return async (req, res, next) => {
    try {
      const tenant = req.tenant;
      if (!tenant) return next();

      const limits = effectiveLimits(tenant);
      const max = limitFor(limits, resource);
      if (max == null) return next();

      const current = resource === 'students'
        ? await prisma.student.count()
        : await prisma.faculty.count();

      if (current >= max) {
        return res.status(403).json({
          message: `Plan limit reached: your ${limits.label} plan allows up to ${max} ${resource}. Contact your platform administrator to upgrade.`,
          code: 'PLAN_LIMIT_REACHED',
          resource,
          limit: max,
          current,
          plan: limits.plan,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

async function tenantUsage(tenant) {
  const [students, faculty, users] = await Promise.all([
    prisma.student.count({ where: { tenantId: tenant.id } }),
    prisma.faculty.count({ where: { tenantId: tenant.id } }),
    prisma.user.count({ where: { tenantId: tenant.id } }),
  ]);
  return { students, faculty, users, limits: effectiveLimits(tenant) };
}

module.exports = { PLANS, DEFAULT_PLAN, planFor, effectiveLimits, enforceQuota, tenantUsage };
