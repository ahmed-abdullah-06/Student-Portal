const prisma = require('../config/db');
const { DEFAULT_TENANT_ID } = require('./context');

/**
 * Tenant resolution: maps an incoming request to a Tenant record.
 *
 * Priority:
 *   1. `X-Tenant` header (tenant id or slug)  — explicit, used by APIs/integrations
 *   2. Subdomain of `TENANT_BASE_DOMAIN`       — e.g. novastra.portal.ac.uk
 *   3. The default tenant                       — single-tenant / local installs
 *
 * Results are cached briefly to avoid a DB round-trip on every request.
 */

const TTL_MS = 60 * 1000;
const cache = new Map();

function invalidateTenantCache() {
  cache.clear();
}

function tenantKeyFromRequest(req) {
  const header = req.headers['x-tenant'];
  if (header) return String(header).trim().toLowerCase();

  const base = process.env.TENANT_BASE_DOMAIN
    ? String(process.env.TENANT_BASE_DOMAIN).toLowerCase().replace(/^\./, '')
    : null;
  const host = String(req.hostname || '').toLowerCase();
  if (base && host.endsWith(`.${base}`) && host !== base) {
    return host.slice(0, -(base.length + 1)).split('.').pop();
  }
  return null;
}

async function findTenantByKey(key) {
  if (!key) return null;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.tenant;

  const tenant = await prisma.tenant.findFirst({
    where: { OR: [{ id: String(key) }, { slug: String(key) }] },
  });
  cache.set(key, { tenant, at: Date.now() });
  return tenant;
}

async function resolveTenantForKey(key) {
  return findTenantByKey(key || DEFAULT_TENANT_ID);
}

module.exports = { tenantKeyFromRequest, findTenantByKey, resolveTenantForKey, invalidateTenantCache };
