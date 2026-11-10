const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { signPlatformToken } = require('./auth');
const { createTenant } = require('../tenancy/provision');
const { invalidateTenantCache } = require('../tenancy/resolve');
const { PLANS, effectiveLimits, DEFAULT_PLAN } = require('../tenancy/plans');
const { parsePagination, pageMeta } = require('../utils/pagination');
const { log } = require('../utils/logger');

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

function publicAdmin(admin) {
  return { id: admin.id, email: admin.email, name: admin.name };
}

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await prisma.platformAdmin.findUnique({ where: { email: String(email).toLowerCase().trim() } });
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (admin.lockedUntil && new Date(admin.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(admin.lockedUntil) - new Date()) / 60000);
      return res.status(423).json({ message: `Account locked. Try again in ${mins} minute(s).` });
    }

    const ok = await bcrypt.compare(String(password), admin.password);
    if (!ok) {
      const attempts = (admin.failedLoginAttempts || 0) + 1;
      await prisma.platformAdmin.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: attempts >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    log('info', 'platform_login', { email: admin.email, ip: req.ip });
    res.json({ admin: publicAdmin(admin), token: signPlatformToken(admin) });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({ admin: req.platformAdmin });
};

exports.stats = async (req, res, next) => {
  try {
    const [tenants, activeTenants, suspendedTenants, users, students, faculty, byPlan] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
      prisma.user.count(),
      prisma.student.count(),
      prisma.faculty.count(),
      prisma.tenant.groupBy({ by: ['plan'], _count: { _all: true } }),
    ]);

    res.json({
      stats: {
        tenants,
        activeTenants,
        suspendedTenants,
        users,
        students,
        faculty,
        tenantsByPlan: Object.fromEntries(byPlan.map((p) => [p.plan, p._count._all])),
      },
      plans: PLANS,
    });
  } catch (err) {
    next(err);
  }
};

exports.listTenants = async (req, res, next) => {
  try {
    const { page, limit, skip, take, search, order } = parsePagination(req, { defaultLimit: 50, maxLimit: 100 });
    const where = search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { slug: { contains: search, mode: 'insensitive' } }] }
      : {};

    const sortable = { name: 'name', createdAt: 'createdAt', status: 'status' };
    const sort = sortable[req.query.sort] || 'createdAt';

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy: { [sort]: order },
        skip,
        take,
        include: {
          _count: { select: { users: true, students: true, facultyMembers: true } },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    const items = tenants.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      plan: t.plan,
      domain: t.domain,
      createdAt: t.createdAt,
      usage: {
        users: t._count.users,
        students: t._count.students,
        faculty: t._count.facultyMembers,
        limits: effectiveLimits(t),
      },
    }));

    res.json({ tenants: items, pagination: pageMeta({ page, limit, total }) });
  } catch (err) {
    next(err);
  }
};

exports.createTenant = async (req, res, next) => {
  try {
    const { slug, name, domain, adminEmail, adminPassword, plan, maxStudents, maxFaculty } = req.body;
    if (plan && !PLANS[plan]) {
      return res.status(400).json({ message: `Unknown plan "${plan}". Use one of: ${Object.keys(PLANS).join(', ')}` });
    }

    const result = await createTenant({ slug, name, domain, adminEmail, adminPassword, plan, maxStudents, maxFaculty });

    log('info', 'platform_tenant_created', {
      admin: req.platformAdmin.email, slug: result.tenant.slug, plan: plan || DEFAULT_PLAN, ip: req.ip,
    });

    res.status(201).json(result);
  } catch (err) {
    if (/already exists|Invalid slug|reserved|required|at least/i.test(err.message || '')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

const STATUSES = ['ACTIVE', 'SUSPENDED'];

exports.updateTenant = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await prisma.tenant.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!tenant) return res.status(404).json({ message: 'Tenant not found' });

    const data = {};
    const { status, plan, maxStudents, maxFaculty, name, domain } = req.body;

    if (status !== undefined) {
      if (!STATUSES.includes(status)) return res.status(400).json({ message: `status must be ${STATUSES.join(' or ')}` });
      data.status = status;
    }
    if (plan !== undefined) {
      if (!PLANS[plan]) return res.status(400).json({ message: `Unknown plan "${plan}"` });
      data.plan = plan;
    }
    for (const field of ['maxStudents', 'maxFaculty']) {
      const value = req.body[field];
      if (value !== undefined) {
        if (value !== null && (!Number.isInteger(value) || value < 0)) {
          return res.status(400).json({ message: `${field} must be a non-negative integer or null (unlimited)` });
        }
        data[field] = value;
      }
    }
    if (name !== undefined) {
      const clean = String(name).trim();
      if (!clean) return res.status(400).json({ message: 'name cannot be empty' });
      data.name = clean;
    }
    if (domain !== undefined) {
      data.domain = domain ? String(domain).trim().toLowerCase() : null;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    const updated = await prisma.tenant.update({ where: { id: tenant.id }, data });
    invalidateTenantCache();

    log('info', 'platform_tenant_updated', {
      admin: req.platformAdmin.email, slug: updated.slug, fields: Object.keys(data).join(','), ip: req.ip,
    });

    res.json({
      tenant: {
        id: updated.id, slug: updated.slug, name: updated.name, status: updated.status,
        plan: updated.plan, domain: updated.domain,
        usage: { limits: effectiveLimits(updated) },
      },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ message: 'That domain is already in use by another tenant' });
    }
    next(err);
  }
};
