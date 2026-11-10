const crypto = require('crypto');

/** RFC-6238 TOTP (SHA1, 30s step, 6 digits) — dependency-free. */

function base32Decode(b32) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(b32).toUpperCase().replace(/\s/g, '').replace(/=+$/, '');
  let bits = '';
  for (const ch of clean) {
    const idx = A.indexOf(ch);
    if (idx === -1) return null;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function base32Encode(buf) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    out += A[parseInt(chunk, 2)];
  }
  return out;
}

function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = require('crypto').createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return code % 10 ** 6;
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function verifyTOTP(b32Secret, token, window = 1) {
  const secretBuf = base32Decode(b32Secret);
  if (!secretBuf) return false;
  const clean = String(token).replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(Date.now() / 30000);
  for (let w = -window; w <= window; w++) {
    if (String(hotp(secretBuf, counter + w)).padStart(6, '0') === clean) return true;
  }
  return false;
}

/** Compute the current TOTP code for a base32 secret (used in tests/tooling). */
function generateTOTP(b32Secret, step = 0) {
  const secretBuf = base32Decode(b32Secret);
  if (!secretBuf) return null;
  return String(hotp(secretBuf, Math.floor(Date.now() / 30000) + step)).padStart(6, '0');
}

function otpauthURL(secret, accountName, issuer = 'Novastra') {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = { generateSecret, verifyTOTP, generateTOTP, otpauthURL };
