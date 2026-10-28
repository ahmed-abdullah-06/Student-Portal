// Tenant management CLI (provisioning and lifecycle).
//
// Usage:
//   node scripts/tenants.js create --slug north --name "Novastra University North Campus" \
//     --admin-email admin@vehari.edu.pk --admin-password <password> \
//     [--domain vehari.example.com] [--must-change-password]
//   node scripts/tenants.js list
//   node scripts/tenants.js status <slug> ACTIVE|SUSPENDED
const { createTenant, listTenants, setTenantStatus } = require('../src/tenancy/provision');

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else if (!flags._positional) {
      flags._positional = arg;
    }
  }
  return flags;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (command === 'create') {
    const asInt = (v) => (v === undefined ? null : parseInt(v, 10));
    const result = await createTenant({
      slug: flags.slug,
      name: flags.name,
      domain: typeof flags.domain === 'string' ? flags.domain : null,
      adminEmail: flags['admin-email'],
      adminPassword: flags['admin-password'],
      mustChangePassword: Boolean(flags['must-change-password']),
      plan: typeof flags.plan === 'string' ? flags.plan : undefined,
      maxStudents: asInt(flags['max-students']),
      maxFaculty: asInt(flags['max-faculty']),
    });
    console.log('Tenant created.');
    console.log(`  id/slug:  ${result.tenant.id}`);
    console.log(`  name:     ${result.tenant.name}`);
    if (result.tenant.domain) console.log(`  domain:   ${result.tenant.domain}`);
    console.log(`  plan:     ${result.tenant.plan}`);
    if (result.tenant.maxStudents != null) console.log(`  maxStudents: ${result.tenant.maxStudents}`);
    if (result.tenant.maxFaculty != null) console.log(`  maxFaculty:  ${result.tenant.maxFaculty}`);
    console.log(`  admin:    ${result.admin.email}`);
    console.log(`\nClients can scope to it with the header:  X-Tenant: ${result.tenant.slug}`);
    return;
  }

  if (command === 'list') {
    const tenants = await listTenants();
    if (tenants.length === 0) {
      console.log('No tenants.');
      return;
    }
    console.log(`${'SLUG'.padEnd(24)} ${'STATUS'.padEnd(10)} ${'PLAN'.padEnd(11)} ${'USERS'.padStart(6)} ${'STUDENTS'.padStart(9)}  NAME`);
    for (const t of tenants) {
      console.log(
        `${t.slug.padEnd(24)} ${t.status.padEnd(10)} ${(t.plan || 'standard').padEnd(11)} ${String(t._count.users).padStart(6)} ${String(t._count.students).padStart(9)}  ${t.name}`
      );
    }
    return;
  }

  if (command === 'status') {
    const slug = flags._positional;
    const status = typeof flags.status === 'string' ? flags.status : rest.filter((a) => !a.startsWith('--'))[1];
    const updated = await setTenantStatus(slug, status);
    console.log(`Tenant "${updated.slug}" is now ${updated.status}.`);
    return;
  }

  console.log('Usage:');
  console.log('  node scripts/tenants.js create --slug <slug> --name "<name>" --admin-email <email> --admin-password <password> [--domain <domain>] [--plan starter|standard|enterprise] [--max-students <n>] [--max-faculty <n>] [--must-change-password]');
  console.log('  node scripts/tenants.js list');
  console.log('  node scripts/tenants.js status <slug> ACTIVE|SUSPENDED');
  process.exit(command ? 1 : 0);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
