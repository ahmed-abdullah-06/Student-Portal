const prisma = require('../config/db');

/**
 * Fine-grained permission guard (granular RBAC).
 * Permissions are strings like `students:write`, `fees:manage`, `reports:export`.
 * ADMIN role always passes; other roles must hold the permission explicitly.
 *
 * Usage: router.post('/students', requirePerm('students:write'), handler)
 */
function normalize(p) {
  return String(p).toLowerCase().trim();
}

function hasPermission(user, perm) {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const list = user.permissions || [];
  const p = normalize(perm);
  // wildcard: `students:*` grants `students:write`
  const [domain] = p.split(':');
  return list.map(normalize).some((x) => x === p || x === `${domain}:*` || x === '*');
}

function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Authentication required' });
    if (!hasPermission(req.user, perm)) {
      return res.status(403).json({ message: `Missing permission: ${perm}` });
    }
    next();
  };
}

/** Load full permission list for a user (authMiddleware selects it already). */
async function loadPermissions(userId) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { permissions: true, role: true } });
  return u?.permissions || [];
}

const CATALOG = [
  'students:read', 'students:write', 'students:import',
  'faculty:read', 'faculty:write',
  'courses:manage', 'sections:manage', 'semesters:manage',
  'fees:manage', 'approvals:manage', 'scholarships:manage',
  'documents:manage', 'masterdata:manage', 'reports:export',
  'notices:manage', 'audit:read', 'settings:manage', 'retention:run',
];

module.exports = { requirePerm, hasPermission, loadPermissions, CATALOG };
