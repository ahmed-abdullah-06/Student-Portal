// k6 smoke/load test. Requires k6 >= 0.50.
// Usage: k6 run loadtest/k6.js --env BASE_URL=http://127.0.0.1:5000
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:5000';

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      exec: 'smokeFlow',
    },
    read: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '40s', target: 20 },
        { duration: '10s', target: 0 },
      ],
      exec: 'readFlow',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    checks: ['rate>0.95'],
  },
};

export function smokeFlow() {
  const health = http.get(`${BASE}/api/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const captcha = http.get(`${BASE}/api/auth/captcha`);
  check(captcha, { 'captcha 200': (r) => r.status === 200 });

  const loginRes = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: 'SP23-BSCS-001', password: 'student123' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const ok = check(loginRes, { 'login 200': (r) => r.status === 200 });
  if (!ok) return;

  const token = loginRes.json('token');
  const auth = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };

  const profile = http.get(`${BASE}/api/student/profile`, auth);
  check(profile, { 'profile 200': (r) => r.status === 200 });

  const audit = http.get(`${BASE}/api/student/degree-audit`, auth);
  check(audit, { 'degree audit 200': (r) => r.status === 200 });

  sleep(1);
}

export function readFlow() {
  const branding = http.get(`${BASE}/api/public/branding`);
  check(branding, { 'branding 200': (r) => r.status === 200 });

  const status = http.get(`${BASE}/api/status`);
  check(status, { 'status reachable': (r) => r.status === 200 || r.status === 503 });

  sleep(0.5);
}
