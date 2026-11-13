const TENANT_KEY = 'tenant';

function normalize(value) {
  return String(value || '').trim().toLowerCase() || null;
}

/**
 * Resolves the active tenant key for the browser session.
 *
 * Priority:
 *   1. `?tenant=<slug>` query param — explicit, persisted for the session (dev / switching)
 *   2. subdomain of `VITE_TENANT_BASE_DOMAIN` — production deployments
 *   3. previously selected tenant (localStorage)
 *   4. null → default tenant (no header sent)
 */
export function getTenant() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = normalize(params.get('tenant'));
    if (fromQuery) {
      localStorage.setItem(TENANT_KEY, fromQuery);
      return fromQuery;
    }

    const base = normalize(import.meta.env.VITE_TENANT_BASE_DOMAIN);
    const host = normalize(window.location.hostname);
    if (base && host && host.endsWith(`.${base}`) && host !== base) {
      return host.slice(0, -(base.length + 1)).split('.').pop();
    }

    return normalize(localStorage.getItem(TENANT_KEY));
  } catch {
    return null;
  }
}

/** Switch tenant: clears the bound auth session and reloads on the login page. */
export function switchTenant(slug) {
  const value = normalize(slug);
  try {
    if (value) localStorage.setItem(TENANT_KEY, value);
    else localStorage.removeItem(TENANT_KEY);
  } catch {
    /* storage unavailable */
  }
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}

export function resetTenant() {
  switchTenant(null);
}
