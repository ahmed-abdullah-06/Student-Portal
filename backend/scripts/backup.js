#!/usr/bin/env node
/**
 * Database backup → gzipped plain-SQL dump.
 *
 * Usage:
 *   node scripts/backup.js [--keep 14]
 *
 * Writes to BACKUP_DIR (default: <repo>/backups) as
 *   student_portal_YYYY-MM-DD_HH-mm-ss.sql.gz
 * and prunes older backups beyond --keep (default 14).
 *
 * Configure with:
 *   DATABASE_URL    connection string (defaults to backend/.env)
 *   BACKUP_DIR      output directory
 *   PG_DUMP         full path to pg_dump if not on PATH
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

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

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

async function sendAlert(message) {
  if (!process.env.BACKUP_ALERT_WEBHOOK) return;
  try {
    await fetch(process.env.BACKUP_ALERT_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: message, service: 'student-portal-backup' }),
    });
  } catch (err) {
    console.error('Backup alert failed:', err.message);
  }
}

async function uploadOffsite(file) {
  if (process.env.STORAGE_DRIVER !== 's3' || !process.env.S3_BUCKET) return false;
  const client = new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
  });
  const key = `${process.env.BACKUP_S3_PREFIX || 'database-backups/'}${path.basename(file)}`;
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: fs.createReadStream(file),
    ContentType: 'application/gzip',
    ServerSideEncryption: 'AES256',
  }));
  console.log(`Off-site backup uploaded: s3://${process.env.S3_BUCKET}/${key}`);
  return true;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set (checked backend/.env and environment).');
    await sendAlert('Student Portal backup failed: DATABASE_URL is not configured.');
    process.exit(1);
  }
  const keep = Number.parseInt(argValue('--keep', '14'), 10) || 14;
  const outDir = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
  fs.mkdirSync(outDir, { recursive: true });

  const tool = resolveTool('pg_dump', 'PG_DUMP');
  if (!tool) {
    console.error('pg_dump not found. Install PostgreSQL client tools or set PG_DUMP to its full path.');
    await sendAlert('Student Portal backup failed: pg_dump was not found.');
    process.exit(1);
  }

  console.log(`Backing up ${url.replace(/:[^:@/]+@/, ':***@')} with ${tool} ...`);
  const started = Date.now();
  const dump = spawnSync(tool, ['--no-owner', '--no-privileges', '--format=plain', url], {
    maxBuffer: 1024 * 1024 * 512,
  });
  if (dump.status !== 0) {
    console.error('pg_dump failed:', dump.stderr ? dump.stderr.toString() : `exit ${dump.status}`);
    process.exit(1);
  }

  const file = path.join(outDir, `student_portal_${stamp()}.sql.gz`);
  fs.writeFileSync(file, zlib.gzipSync(dump.stdout));
  const size = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`Backup written: ${file} (${size} KB, ${Date.now() - started} ms)`);
  try {
    await uploadOffsite(file);
  } catch (err) {
    await sendAlert(`Student Portal off-site backup failed: ${err.message}`);
    console.error('Off-site backup failed:', err.message);
    process.exit(1);
  }

  const backups = fs.readdirSync(outDir).filter((f) => f.startsWith('student_portal_') && f.endsWith('.sql.gz')).sort();
  const excess = backups.slice(0, Math.max(0, backups.length - keep));
  for (const f of excess) {
    fs.unlinkSync(path.join(outDir, f));
    console.log(`Pruned old backup: ${f}`);
  }
  console.log(`Retention: keeping newest ${keep} backup(s), ${backups.length - excess.length} on disk.`);
}

main().catch(async (err) => {
  console.error(err);
  await sendAlert(`Student Portal backup failed: ${err.message}`);
  process.exit(1);
});
