const { runWithTenant } = require('../tenancy/context');
const { tenantKeyFromRequest, resolveTenantForKey } = require('../tenancy/resolve');

/**
 * Resolves the request tenant and runs the rest of the request inside that
 * tenant's AsyncLocalStorage context. Must be mounted before any route that
 * touches tenant-scoped data.
 */
async function tenantResolver(req, res, next) {
  try {
    const key = tenantKeyFromRequest(req);
    const tenant = await resolveTenantForKey(key);

    if (!tenant) {
      return res.status(404).json({ message: 'Unknown tenant' });
    }
    if (tenant.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Tenant is not active' });
    }

    req.tenant = tenant;
    return runWithTenant(tenant, () => next());
  } catch (err) {
    return next(err);
  }
}

module.exports = tenantResolver;
