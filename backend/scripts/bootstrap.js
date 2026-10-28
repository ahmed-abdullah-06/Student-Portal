#!/usr/bin/env node
/**
 * Production bootstrap: creates the default tenant and the platform operator
 * account WITHOUT seeding demo data.
 *
 *   PLATFORM_ADMIN_EMAIL=ops@university.edu PLATFORM_ADMIN_PASSWORD='...' node scripts/bootstrap.js
 *
 * If PLATFORM_ADMIN_PASSWORD is omitted, a strong password is generated and
 * printed once. Re-running rotates the password to the provided value.
 */
require('dotenv').config();

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');

async function main() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || 'platform@novastra.edu.pk').toLowerCase();
  const generated = !process.env.PLATFORM_ADMIN_PASSWORD;
  const password = process.env.PLATFORM_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const defaultTenantName = process.env.DEFAULT_TENANT_NAME || 'Default University';

  if (process.env.NODE_ENV === 'production' && generated) {
    console.log('No PLATFORM_ADMIN_PASSWORD provided — generating one.');
  }

  await prisma.tenant.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', slug: 'default', name: defaultTenantName },
  });

  const hashed = await bcrypt.hash(password, 12);
  await prisma.platformAdmin.upsert({
    where: { email },
    update: { password: hashed, isActive: true, failedLoginAttempts: 0, lockedUntil: null },
    create: { email, password: hashed, name: 'Platform Operator' },
  });

  console.log(`Default tenant ready: ${defaultTenantName}`);
  console.log(`Platform operator ready: ${email}`);
  if (generated) {
    console.log('');
    console.log('Generated password (shown once — store it in your password manager):');
    console.log(`  ${password}`);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('bootstrap failed:', err.message);
  process.exit(1);
});
