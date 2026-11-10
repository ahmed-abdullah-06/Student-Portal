/**
 * OpenAPI 3.1 specification for the Novastra API.
 * Served at /api/docs (Swagger UI) and /api/openapi.json.
 */

const pkg = require('../../package.json');

const errResp = {
  description: 'Error',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
};

const jsonGet = (summary, tag) => ({
  summary,
  tags: [tag],
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } },
    401: errResp,
  },
});

const jsonPost = (summary, tag, bodySchema) => ({
  summary,
  tags: [tag],
  ...(bodySchema ? { requestBody: { required: true, content: { 'application/json': { schema: bodySchema } } } } : {}),
  responses: {
    200: { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } },
    201: { description: 'Created' },
    400: errResp,
    401: errResp,
  },
});

const str = (desc) => ({ type: 'string', description: desc });

module.exports = {
  openapi: '3.1.0',
  info: {
    title: 'Novastra Student Portal API',
    version: pkg.version,
    description: 'REST API for the Novastra University campus portal — auth, academics, fees, requests, admin.',
    license: { name: 'MIT' },
  },
  servers: [{ url: '/api', description: 'Current host' }],
  tags: [
    { name: 'Auth', description: 'Login, sessions, password, 2FA' },
    { name: 'Student', description: 'Student-facing academics & services' },
    { name: 'Faculty', description: 'Teaching tasks' },
    { name: 'Admin', description: 'Administration' },
    { name: 'Requests', description: 'Student request workflows' },
    { name: 'Public', description: 'No authentication required' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'JWT from POST /api/auth/login' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { message: { type: 'string' }, field: { type: 'string' } },
        required: ['message'],
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', description: 'Email or roll number' },
          password: str('Account password'),
          captcha: str('Captcha code shown by GET /auth/captcha'),
          captchaToken: str('Token from captcha endpoint'),
          totp: str('6-digit TOTP code if 2FA is enabled'),
        },
      },
      User: {
        type: 'object',
        properties: {
          id: str('User id'),
          email: str('Login email'),
          role: { type: 'string', enum: ['STUDENT', 'FACULTY', 'ADMIN'] },
          mustChangePassword: { type: 'boolean' },
          permissions: { type: 'array', items: { type: 'string' } },
          twoFactorEnabled: { type: 'boolean' },
        },
      },
      Session: {
        type: 'object',
        properties: {
          id: str('Session id'),
          userAgent: str('Client user agent'),
          ipAddress: str('Client IP'),
          createdAt: { type: 'string', format: 'date-time' },
          lastSeenAt: { type: 'string', format: 'date-time' },
        },
      },
      SettingSection: {
        type: 'object',
        additionalProperties: true,
        description: 'Key/value settings section (branding, academics, fees, features, retention)',
      },
    },
  },
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  paths: {
    '/health': { get: { summary: 'Liveness probe', tags: ['Public'], security: [], responses: { 200: { description: 'Service is alive' } } } },
    '/status': { get: { summary: 'Deep health: DB, storage, email, memory', tags: ['Public'], security: [], responses: { 200: { description: 'Operational' }, 503: { description: 'Degraded' } } } },
    '/public/branding': { get: { summary: 'Branding for login page', tags: ['Public'], security: [], responses: { 200: { description: 'Branding config' } } } },

    '/auth/captcha': { get: { summary: 'Issue login captcha', tags: ['Auth'], security: [], responses: { 200: { description: 'Captcha code + token' } } } },
    '/auth/login': { post: { summary: 'Login (email or roll number)', tags: ['Auth'], security: [], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } }, responses: { 200: { description: 'JWT + user (or requires2FA)' }, 401: errResp, 423: { description: 'Account locked' } } } },
    '/auth/logout': { post: { summary: 'Logout (revokes session)', tags: ['Auth'], responses: { 200: { description: 'Logged out' } } } },
    '/auth/me': { get: jsonGet('Current user profile', 'Auth') },
    '/auth/change-password': { post: jsonPost('Change password (revokes all sessions)', 'Auth', { type: 'object', required: ['oldPassword', 'newPassword', 'confirmPassword'], properties: { oldPassword: str('Current'), newPassword: str('New, policy-checked'), confirmPassword: str('Repeat new') } }) },
    '/auth/forgot-password': { post: { summary: 'Request password reset email', tags: ['Auth'], security: [], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: str('Email or roll number') } } } } }, responses: { 200: { description: 'Always 200 (no account enumeration)' } } } },
    '/auth/reset-password': { post: jsonPost('Reset password with token', 'Auth', { type: 'object', required: ['token', 'newPassword', 'confirmPassword'], properties: { token: str('Reset token'), newPassword: str('New password'), confirmPassword: str('Repeat') } }) },
    '/auth/sessions': {
      get: jsonGet('List active sessions', 'Auth'),
    },
    '/auth/sessions/revoke-all': {
      post: { summary: 'Revoke all sessions (kill all tokens)', tags: ['Auth'], responses: { 200: { description: 'Revoked' } } },
    },
    '/auth/sessions/{id}': {
      delete: { summary: 'Revoke one session', tags: ['Auth'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Revoked' }, 404: errResp } },
    },
    '/auth/2fa/enable': { post: { summary: 'Begin 2FA setup (returns secret + QR)', tags: ['Auth'], responses: { 200: { description: 'Secret, otpauth URL, QR data URL' } } } },
    '/auth/2fa/confirm': { post: jsonPost('Confirm 2FA with a valid code', 'Auth', { type: 'object', required: ['code'], properties: { code: { type: 'string', pattern: '^\\d{6}$' } } }) },
    '/auth/2fa/disable': { post: jsonPost('Disable 2FA (password or code)', 'Auth', { type: 'object', properties: { password: str('Account password'), code: str('Current TOTP') } }) },

    '/settings': { get: jsonGet('All settings (admin)', 'Admin') },
    '/settings/{section}': {
      put: { summary: 'Update a settings section', tags: ['Admin'], parameters: [{ name: 'section', in: 'path', required: true, schema: { type: 'string', enum: ['branding', 'academics', 'fees', 'features', 'retention'] } }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SettingSection' } } } }, responses: { 200: { description: 'Updated' }, 404: errResp } },
    },

    '/student/profile': {
      get: jsonGet('Student profile + completion %', 'Student'),
      put: jsonPost('Update own bio-data', 'Student'),
    },
    '/student/courses': { get: jsonGet('Registered courses', 'Student') },
    '/student/courses/available': { get: jsonGet('Course registration catalogue', 'Student') },
    '/student/courses/register': { post: jsonPost('Register for a section (21h / prereq / capacity rules)', 'Student') },
    '/student/attendance': { get: jsonGet('Attendance per course', 'Student') },
    '/student/marks': { get: jsonGet('Marks breakdown', 'Student') },
    '/student/transcript': { get: jsonGet('Transcript + SGPA/CGPA', 'Student') },
    '/student/challans': { get: jsonGet('Fee challans', 'Student') },
    '/student/timetable': { get: jsonGet('Weekly timetable', 'Student') },
    '/student/evaluations': { get: jsonGet('Teacher evaluations (window-aware)', 'Student') },
    '/student/date-sheet': { get: jsonGet('Exam date sheet', 'Student') },
    '/student/admit-card': { get: { summary: 'Admit card data', tags: ['Student'], parameters: [{ name: 'type', in: 'query', schema: { type: 'string', enum: ['MIDTERM', 'FINAL'] } }], responses: { 200: { description: 'Admit card' } } } },
    '/student/degree-audit': { get: jsonGet('Degree audit: credits, CGPA, standing', 'Student') },

    '/student/rechecks': { get: jsonGet('My result re-checks', 'Requests'), post: jsonPost('Request result re-check', 'Requests') },
    '/student/freezes': { get: jsonGet('My semester freezes', 'Requests'), post: jsonPost('Request semester freeze', 'Requests') },
    '/student/installments': { get: jsonGet('My installment requests', 'Requests'), post: jsonPost('Request fee installments', 'Requests') },
    '/student/refunds': { get: jsonGet('My refund requests', 'Requests'), post: jsonPost('Request fee refund', 'Requests') },
    '/student/scholarships': { get: jsonGet('Open scholarships', 'Requests') },
    '/student/scholarships/{id}/apply': { post: { summary: 'Apply for scholarship', tags: ['Requests'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 201: { description: 'Application created' }, 409: errResp } } },
    '/student/cert-requests': { get: jsonGet('My certificate requests', 'Requests'), post: jsonPost('Request certificate', 'Requests') },
    '/student/bank-proofs': { get: jsonGet('My bank payment proofs', 'Requests') },

    '/documents': { get: jsonGet('List documents', 'Student') },
    '/documents/{id}/download': { get: { summary: 'Download a document (authenticated)', tags: ['Student'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'File stream' }, 404: errResp } } },

    '/faculty/sections': { get: jsonGet('My assigned sections', 'Faculty') },
    '/faculty/attendance': { post: jsonPost('Mark attendance', 'Faculty') },
    '/admin/stats': { get: jsonGet('Dashboard statistics', 'Admin') },
    '/admin/semesters': { get: jsonGet('List semesters', 'Admin'), post: jsonPost('Create semester', 'Admin') },
    '/admin/reports/attendance': { get: { summary: 'Attendance report (CSV)', tags: ['Admin'], responses: { 200: { description: 'text/csv' } } } },
    '/admin/reports/fee-defaulters': { get: { summary: 'Overdue fee report (CSV)', tags: ['Admin'], responses: { 200: { description: 'text/csv' } } } },
    '/admin/reports/result-gazette': { get: { summary: 'Result gazette (CSV)', tags: ['Admin'], parameters: [{ name: 'semester', in: 'query', schema: { type: 'integer' } }], responses: { 200: { description: 'text/csv' } } } },
    '/admin/reports/enrollment': { get: { summary: 'Enrollment report (CSV)', tags: ['Admin'], responses: { 200: { description: 'text/csv' } } } },
    '/admin/students/import': { post: { summary: 'Bulk import students from CSV', tags: ['Admin'], requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Import summary' }, 400: errResp } } },
  },
};
