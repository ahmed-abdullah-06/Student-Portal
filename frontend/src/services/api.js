import axios from 'axios';
import { getTenant } from './tenant';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Short-lived stale-while-revalidate cache for read-only reference data.
// Mutations and authenticated user-specific reads remain uncached by default.
const getCache = new Map();
const CACHE_TTL_MS = 30_000;
const CACHEABLE = [/^\/(courses|branding|settings|student\/course-catalog)/];

api.interceptors.request.use((config) => {
  if (config.method?.toLowerCase() === 'get' && !config.skipCache
      && CACHEABLE.some((pattern) => pattern.test(config.url || ''))) {
    const key = `${config.baseURL || ''}${config.url}`;
    const hit = getCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      config.adapter = async () => ({
        data: hit.data, status: 200, statusText: 'OK', headers: {}, config,
        request: null,
      });
    } else if (hit) {
      // Return stale data immediately while refreshing in the background.
      config.adapter = async () => ({
        data: hit.data, status: 200, statusText: 'OK', headers: { 'x-cache': 'stale' }, config,
        request: null,
      });
      config.transformResponse = [(data) => {
        void axios.get(config.url, { ...config, adapter: undefined, skipCache: true })
          .then((response) => getCache.set(key, { data: response.data, at: Date.now() }))
          .catch(() => {});
        return data;
      }];
    }
    config.__cacheKey = key;
  }
  return config;
});

api.interceptors.response.use((res) => {
  const key = res.config?.__cacheKey;
  if (key && res.config.method?.toLowerCase() === 'get' && res.status === 200 && !res.headers?.['x-cache']) {
    getCache.set(key, { data: res.data, at: Date.now() });
  }
  return res;
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const tenant = getTenant();
  if (tenant) config.headers['X-Tenant'] = tenant;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config || {};
    const transient = !err.response || err.response.status === 408 || err.response.status === 429 || err.response.status >= 500;
    if (transient && !config.__retryCount && typeof navigator !== 'undefined' && navigator.onLine) {
      config.__retryCount = 1;
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      return api(config);
    }
    if (err.response?.status === 401) {
      if (!config.url?.endsWith('/auth/refresh') && !config.__refreshAttempt) {
        try {
          await api.post('/auth/refresh', {}, { __refreshAttempt: true });
          config.__refreshAttempt = true;
          return api(config);
        } catch {
          // Fall through to the normal session-expired handling.
        }
      }
      window.dispatchEvent(new CustomEvent('portal:session-expired'));
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    if (!err.response && typeof navigator !== 'undefined' && !navigator.onLine) {
      window.dispatchEvent(new Event('offline'));
    }
    return Promise.reject(err);
  }
);

export function apiMessage(err, fallback = 'Something went wrong') {
  if (err?.response?.status === 429) return err.response.data?.message || 'Too many requests. Please wait and try again.';
  return err?.response?.data?.message || err?.message || fallback;
}

export default api;
