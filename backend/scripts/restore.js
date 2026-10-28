#!/usr/bin/env node
/**
 * Restore a backup created by scripts/backup.js into a target database.
 *
 * Usage:
 *   node scripts/restore.js <backup.sql.gz|backup.sql> --url postgresql://... --yes
 *
 * Safety: refuses to run without --yes, and never restores into the live
 * DATABASE_URL from backend/.env unless that exact URL is passed explicitly.
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

function resolveTool(name, envKey) {
  if (process.env[envKey]) return process.env[envKey];
  const roots = ['C:/Program Files/PostgreSQL', 'C:/Program Files (x86)/PostgreSQL'];
  for (const root of roots) {
    try {
      for (const v of fs.readdirSync(root)) {
        const p = path.join(root, v, 'bin', `${name}.exe`);
        if (fs.existsSync(p)) {
          const probe = spawnSync(p, ['--version'], { encoding: 'utf8' });
          if (probe.status === 0) return p;
        }
      }
    } catch { /* directory not present */ }
  }
  const probe = spawnSync(name, ['--version'], { encoding: 'utf8', shell: true });
  if (probe.status === 0) return name;
  return null;
}

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function main() {
  const file = process.argv[2];
  const url = argValue('--url', null);
  const confirmed = process.argv.includes('--yes');

  if (!file || !fs.existsSync(file)) {
    console.error('Usage: node scripts/restore.js <backup.sql.gz> --url <postgresql://host/db> --yes');
    process.exit(1);
  }
  if (!url) {
    console.error('Refusing to restore: pass the target with --url (this is never taken from .env on purpose).');
    process.exit(1);
  }
  if (!confirmed) {
    console.error(`Refusing to restore into ${url.replace(/:[^:@/]+@/, ':***@')} without --yes (destructive).`);
    process.exit(1);
  }

  const tool = resolveTool('psql', 'PSQL');
  if (!tool) {
    console.error('psql not found. Install PostgreSQL client tools or set PSQL to its full path.');
    process.exit(1);
  }

  let sqlFile = file;
  let tempFile = null;
  if (file.endsWith('.gz')) {
    tempFile = path.join(os.tmpdir(), `novastra-restore-${Date.now()}.sql`);
    fs.writeFileSync(tempFile, zlib.gunzipSync(fs.readFileSync(file)));
    sqlFile = tempFile;
    console.log(`Decompressed ${path.basename(file)} → ${tempFile}`);
  }

  console.log(`Restoring into ${url.replace(/:[^:@/]+@/, ':***@')} ...`);
  const started = Date.now();
  const res = spawnSync(tool, ['-v', 'ON_ERROR_STOP=1', '-d', url, '-f', sqlFile], { encoding: 'utf8' });
  if (tempFile) fs.unlinkSync(tempFile);

  if (res.status !== 0) {
    console.error('psql failed:', res.stderr || `exit ${res.status}`);
    process.exit(1);
  }
  console.log(`Restore complete in ${Date.now() - started} ms.`);
  console.log('Verify with: SELECT count(*) FROM users; SELECT count(*) FROM students;');
}

main();
