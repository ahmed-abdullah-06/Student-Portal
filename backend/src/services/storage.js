const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { env } = require('../config/env');
const { log } = require('../utils/logger');

/**
 * Storage abstraction:
 *  - driver "local" → files under backend/uploads (dev / single-node)
 *  - driver "s3"    → S3-compatible bucket (MinIO, AWS, Cloudflare R2 …)
 */
const LOCAL_ROOT = path.join(__dirname, '..', '..', 'uploads');

let s3Client = null;
function getS3() {
  if (s3Client !== null) return s3Client;
  const e = env();
  if (e.STORAGE_DRIVER !== 's3') { s3Client = false; return s3Client; }
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: e.S3_REGION,
      endpoint: e.S3_ENDPOINT,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
      credentials: e.S3_ACCESS_KEY_ID
        ? { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY }
        : undefined,
    });
  } catch (err) {
    log('error', 'storage_init_failed', { error: err.message });
    s3Client = false;
  }
  return s3Client;
}

function keyFor(folder, originalName) {
  const safe = String(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safe}`;
}

async function saveFile(folder, buffer, originalName, contentType) {
  const e = env();
  if (e.STORAGE_DRIVER === 's3') {
    const client = getS3();
    if (client) {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const Key = keyFor(folder, originalName);
      await client.send(new PutObjectCommand({ Bucket: e.S3_BUCKET, Key, Body: buffer, ContentType: contentType }));
      log('info', 'storage_s3_put', { key: Key, bucket: e.S3_BUCKET });
      return { driver: 's3', key: Key, size: buffer.length };
    }
  }
  // local driver (also S3 fallback)
  const Key = keyFor(folder, originalName);
  const abs = path.join(LOCAL_ROOT, Key);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buffer);
  return { driver: 'local', key: Key, size: buffer.length };
}

async function readFile(key) {
  const e = env();
  if (e.STORAGE_DRIVER === 's3' && getS3()) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const res = await getS3().send(new GetObjectCommand({ Bucket: e.S3_BUCKET, Key: key }));
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
  const abs = path.join(LOCAL_ROOT, key);
  if (!abs.startsWith(LOCAL_ROOT)) throw new Error('Invalid storage key');
  return fs.readFileSync(abs);
}

async function deleteFile(key) {
  const e = env();
  if (e.STORAGE_DRIVER === 's3' && getS3()) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await getS3().send(new DeleteObjectCommand({ Bucket: e.S3_BUCKET, Key: key }));
    return;
  }
  const abs = path.join(LOCAL_ROOT, key);
  if (abs.startsWith(LOCAL_ROOT) && fs.existsSync(abs)) fs.unlinkSync(abs);
}

function localPath(key) {
  const abs = path.join(LOCAL_ROOT, key);
  if (!abs.startsWith(LOCAL_ROOT)) throw new Error('Invalid storage key');
  return abs;
}

module.exports = { saveFile, readFile, deleteFile, localPath, LOCAL_ROOT };
