import axios from 'axios';

const KEY = 'platformToken';

const platformApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

platformApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

platformApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem(KEY)) {
      localStorage.removeItem(KEY);
      window.dispatchEvent(new Event('platform:unauthorized'));
    }
    return Promise.reject(err);
  }
);

export function getPlatformToken() {
  return localStorage.getItem(KEY);
}

export function setPlatformToken(token) {
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
}

export default platformApi;
