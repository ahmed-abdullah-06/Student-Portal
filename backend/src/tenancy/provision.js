const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { runWithTenant } = require('./context');
const { invalidateTenantCache } = require('./resolve');
const { PLANS, DEFAULT_PLAN } = require('./plans');
const settingsService = require('../services/settings');

/**
 * Tenant provisioning: creates a university (tenant) with its first admin
 * account and baseline branding, so a new tenant is immediately usable.
 *
 * CLI: `node scripts/tenants.js create --slug <slug> --name <name>
 *        --admin-email <email> --admin-password <password> [--domain <domain>]`
 */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const RESERVED_SLUGS = new Set(['default', 'www', 'api', 'app', 'admin', 'static', 'assets', 'public']);

function initials(name) {
  const words = String(name).split(/\s+/).filter(Boolean);
  const pick = words.filter((w) => /^[A-Za-z]/.test(w));
  if (pick.length === 0) return 'U';
  if (pick.length === 1) return pick[0].slice(0, 2).toUpperCase();
  return (pick[0][0] + pick[1][0] + (pick.length > 2 ? pick[2][0] : '')).toUpperCase();
}

function brandingFor(name, { slug, domain } = {}) {
  return {
    universityName: name,
    portalName: `${initials(name)} Portal`,
    tagline: 'Student Portal',
    logoText: initials(name),
    supportEmail: domain ? `support@${domain}` : `support@${slug}.edu`,
    supportPhone: '',
  };
}

async function createTenant({
  slug, name, domain = null, adminEmail, adminPassword,
  mustChangePassword = false, plan = DEFAULT_PLAN, maxStudents = null, maxFaculty = null,
}) {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanEmail = String(adminEmail || '').trim().toLowerCase();
  const cleanDomain = domain ? String(domain).trim().toLowerCase() : null;
  const cleanPlan = String(plan || DEFAULT_PLAN).trim().toLowerCase();

  if (!SLUG_RE.test(cleanSlug)) {
    throw new Error('Invalid slug: use 2-40 lowercase letters, digits and hyphens (no leading/trailing hyphen)');
  }
  if (RESERVED_SLUGS.has(cleanSlug)) throw new Error(`Slug "${cleanSlug}" is reserved`);
  if (!cleanName) throw new Error('Tenant name is required');
  if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) throw new Error('A valid admin email is required');
  if (!adminPassword || String(adminPassword).length < 8) throw new Error('Admin password must be at least 8 characters');
  if (!PLANS[cleanPlan]) throw new Error(`Unknown plan "${cleanPlan}". Use one of: ${Object.keys(PLANS).join(', ')}`);
  for (const [field, value] of [['maxStudents', maxStudents], ['maxFaculty', maxFaculty]]) {
    if (value != null && (!Number.isInteger(value) || value < 0)) {
      throw new Error(`${field} must be a non-negative integer or null (unlimited)`);
    }
  }

  const existing = await prisma.tenant.findFirst({
    where: { OR: [{ id: cleanSlug }, { slug: cleanSlug }, ...(cleanDomain ? [{ domain: cleanDomain }] : [])] },
  });
  if (existing) throw new Error(`Tenant "${existing.slug}" already exists`);

  const tenant = await prisma.tenant.create({
    data: {
      id: cleanSlug, slug: cleanSlug, name: cleanName, domain: cleanDomain,
      plan: cleanPlan, maxStudents, maxFaculty,
    },
  });

  let admin;
  try {
    const password = await bcrypt.hash(String(adminPassword), 10);
    admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: cleanEmail,
        password,
        role: 'ADMIN',
        mustChangePassword: Boolean(mustChangePassword),
      },
    });

    await runWithTenant(tenant, () =>
      settingsService.setSettings('branding', brandingFor(cleanName, { slug: cleanSlug, domain: cleanDomain }), admin.id)
    );
  } catch (err) {
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.setting.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } }).catch(() => {});
    throw err;
  }

  invalidateTenantCache();

  return {
    tenant: {
      id: tenant.id, slug: tenant.slug, name: tenant.name, status: tenant.status,
      domain: tenant.domain, plan: tenant.plan,
      maxStudents: tenant.maxStudents, maxFaculty: tenant.maxFaculty,
    },
    admin: { id: admin.id, email: admin.email },
  };
}

async function listTenants() {
  return prisma.tenant.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, slug: true, name: true, status: true, plan: true, domain: true, createdAt: true,
      _count: { select: { users: true, students: true } },
    },
  });
}

async function setTenantStatus(slug, status) {
  const clean = String(slug || '').trim().toLowerCase();
  const value = String(status || '').trim().toUpperCase();
  if (!['ACTIVE', 'SUSPENDED'].includes(value)) throw new Error('Status must be ACTIVE or SUSPENDED');

  const tenant = await prisma.tenant.findFirst({ where: { OR: [{ id: clean }, { slug: clean }] } });
  if (!tenant) throw new Error(`Tenant "${clean}" not found`);

  const updated = await prisma.tenant.update({ where: { id: tenant.id }, data: { status: value } });
  invalidateTenantCache();
  return { id: updated.id, slug: updated.slug, name: updated.name, status: updated.status };
}

module.exports = { createTenant, listTenants, setTenantStatus, brandingFor, initials, SLUG_RE };
