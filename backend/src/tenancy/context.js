const { AsyncLocalStorage } = require('async_hooks');

/**
 * Request-scoped tenant context.
 *
 * The active tenant is resolved once per request (see `middlewares/tenant.js`)
 * and stored in AsyncLocalStorage so any downstream service/controller can read
 * it without threading it through every function signature.
 */

const DEFAULT_TENANT_ID = 'default';

const storage = new AsyncLocalStorage();

/** Run `fn` with `tenant` set as the active tenant for the whole async chain. */
function runWithTenant(tenant, fn) {
  return storage.run({ tenant }, fn);
}

/** The full tenant record for the current request, or null outside a request. */
function getTenant() {
  return storage.getStore()?.tenant || null;
}

/** The id of the active tenant, or null when there is no context. */
function getTenantId() {
  return storage.getStore()?.tenant?.id || null;
}

module.exports = { DEFAULT_TENANT_ID, runWithTenant, getTenant, getTenantId };
