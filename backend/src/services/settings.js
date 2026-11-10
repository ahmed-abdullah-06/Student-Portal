const prisma = require('../config/db');
const { log } = require('../utils/logger');
const { getTenantId, DEFAULT_TENANT_ID } = require('../tenancy/context');

/**
 * Platform settings (key/value JSON), scoped per tenant. Used for branding,
 * academic policy, and feature configuration so each university can adapt the
 * portal without code changes.
 */

const DEFAULTS = {
  branding: {
    universityName: 'Novastra University',
    portalName: 'Novastra',
    tagline: 'Campus Portal',
    logoText: 'NU',
    primaryColor: '#1e3a8a',
    accentColor: '#0f9d8a',
    supportEmail: 'support@novastra.edu.pk',
    supportPhone: '+92-51-111-001-001',
  },
  academics: {
    maxCreditHours: 21,
    minAttendancePct: 75,
    passingGradePoints: 2.0,
    deansListCgpa: 3.8,
    withdrawalWindowDays: 60,
    evaluationWeights: { assignments: 10, quizzes: 10, midterms: 20, finals: 60 },
    degreeRequirementCredits: 133,
  },
  fees: {
    currency: 'PKR',
    lateFeePct: 5,
    installmentPlans: ['2_PARTS', '3_PARTS'],
    challengeGraceDays: 7,
  },
  features: {
    registrationOpen: true,
    evaluationsOpen: true,
    chatEnabled: true,
    smsNotifications: false,
    emailNotifications: true,
  },
  retention: {
    auditLogDays: 365,
    chatMessageDays: 180,
    notificationDays: 90,
  },
};

const TTL_MS = 30 * 1000;
const cache = new Map(); // tenantId -> { value, at }

function currentTenantId() {
  return getTenantId() || DEFAULT_TENANT_ID;
}

async function getSettings(tenantId = currentTenantId()) {
  const cached = cache.get(tenantId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  let rows = [];
  try {
    rows = await prisma.setting.findMany({ where: { tenantId } });
  } catch (err) {
    log('warn', 'settings_read_failed', { error: err.message, tenantId });
  }
  const out = structuredClone(DEFAULTS);
  for (const r of rows) {
    if (r.key in out && typeof r.value === 'object' && r.value) {
      out[r.key] = { ...out[r.key], ...r.value };
    }
  }
  cache.set(tenantId, { value: out, at: Date.now() });
  return out;
}

async function getSection(section, tenantId = currentTenantId()) {
  const all = await getSettings(tenantId);
  return all[section] || {};
}

async function setSettings(section, values, actorId = null, tenantId = currentTenantId()) {
  if (!(section in DEFAULTS)) throw new Error(`Unknown settings section: ${section}`);
  const merged = { ...(await getSection(section, tenantId)), ...values };
  await prisma.setting.upsert({
    where: { tenantId_key: { tenantId, key: section } },
    create: { tenantId, key: section, value: merged },
    update: { value: merged },
  });
  cache.delete(tenantId); // invalidate only this tenant

  const { logAudit } = require('../utils/logger');
  logAudit('UPDATE_SETTINGS', {
    userId: actorId, entity: 'Setting', entityId: section,
    details: `Updated ${section} settings`,
  });
  return merged;
}

function invalidate(tenantId) {
  if (tenantId) cache.delete(tenantId);
  else cache.clear();
}

module.exports = { getSettings, getSection, setSettings, DEFAULTS, invalidate };
