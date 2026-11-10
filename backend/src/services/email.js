const fs = require('fs');
const path = require('path');
const { env } = require('../config/env');
const { log } = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter !== null) return transporter;
  const e = env();
  if (!e.SMTP_HOST) {
    transporter = false; // dev mode: no real SMTP configured
    log('warn', 'email_dev_mode', { detail: 'SMTP_HOST not set — messages written to logs/outbox' });
    return transporter;
  }
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: e.SMTP_HOST,
      port: e.SMTP_PORT || 587,
      secure: (e.SMTP_PORT || 587) === 465,
      auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
    });
  } catch (err) {
    log('error', 'email_transport_failed', { error: err.message });
    transporter = false;
  }
  return transporter;
}

function shell(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px;font-family:Inter,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e4e7ec;overflow:hidden">
    <tr><td style="background:#1e3a8a;padding:20px 28px">
      <div style="color:#fff;font-weight:700;font-size:16px">Novastra</div>
      <div style="color:#c7d2f0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase">Student Portal</div>
    </td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 14px;font-size:18px;color:#172033">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#465166">${bodyHtml}</div>
    </td></tr>
    <tr><td style="padding:16px 28px;border-top:1px solid #e4e7ec;font-size:11px;color:#98a0ae">
      This is an automated message from Novastra Student Portal. Please do not reply.
    </td></tr>
  </table></td></tr></table></body></html>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry transient SMTP failures with exponential backoff. */
async function withRetry(fn, attempts = 3, baseDelayMs = 500) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i);
    }
  }
  throw lastErr;
}

async function sendEmail({ to, subject, html, text }) {
  const e = env();
  try {
    const t = getTransporter();
    if (!t) {
      // Dev fallback: persist to logs/outbox so flows remain testable without SMTP
      const dir = path.join(__dirname, '..', '..', 'logs', 'outbox');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${Date.now()}-${subject.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60)}.json`);
      fs.writeFileSync(file, JSON.stringify({ to, subject, text, at: new Date().toISOString() }, null, 2));
      log('info', 'email_outbox_saved', { to, subject, file });
      return { dev: true, file };
    }
    const info = await withRetry(() => t.sendMail({ from: e.SMTP_FROM, to, subject, html, text }));
    log('info', 'email_sent', { to, subject, messageId: info.messageId });
    return { messageId: info.messageId };
  } catch (err) {
    log('error', 'email_failed', { to, subject, error: err.message });
    throw err;
  }
}

// ---------- Templates ----------
const templates = {
  passwordReset: ({ name, link, expiresIn }) => ({
    subject: 'Reset your Novastra password',
    html: shell('Password reset requested',
      `<p>Hi ${name || ''},</p><p>We received a request to reset your password.</p>
       <p><a href="${link}" style="display:inline-block;background:#1e3a8a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
       <p>Or paste this link: <br><span style="font-family:monospace;font-size:12px">${link}</span></p>
       <p>This link expires in ${expiresIn}. If you didn't request this, you can safely ignore this email.</p>`),
    text: `Reset your password: ${link} (expires in ${expiresIn})`,
  }),
  passwordChanged: ({ name }) => ({
    subject: 'Your Novastra password was changed',
    html: shell('Password changed',
      `<p>Hi ${name || ''},</p><p>Your password was just changed. If this wasn't you, reset your password immediately and contact administration.</p>`),
    text: 'Your Novastra password was changed.',
  }),
  welcome: ({ name, roll, password }) => ({
    subject: 'Welcome to Novastra Student Portal',
    html: shell('Welcome to Novastra',
      `<p>Hi ${name},</p><p>Your account has been created.</p>
       <table style="font-size:13px;border-collapse:collapse">
       <tr><td style="padding:4px 12px;color:#697386">Registration #</td><td><b>${roll}</b></td></tr>
       <tr><td style="padding:4px 12px;color:#697386">Password</td><td><b>${password}</b></td></tr></table>
       <p style="color:#d14545;font-size:12px">Please change your password after first login.</p>`),
    text: `Welcome! Login: ${roll} / ${password}`,
  }),
  requestUpdate: ({ name, title, body }) => ({
    subject: `${title} — Novastra`,
    html: shell(title, `<p>Hi ${name},</p><p>${body}</p>`),
    text: `${title}: ${body}`,
  }),
  feeChallan: ({ name, voucher, amount, dueDate }) => ({
    subject: `Fee challan ${voucher} generated`,
    html: shell('New fee challan',
      `<p>Hi ${name},</p><p>A fee challan has been generated.</p>
       <table style="font-size:13px;border-collapse:collapse">
       <tr><td style="padding:4px 12px;color:#697386">Voucher</td><td><b>${voucher}</b></td></tr>
       <tr><td style="padding:4px 12px;color:#697386">Amount</td><td><b>PKR ${amount}</b></td></tr>
       <tr><td style="padding:4px 12px;color:#697386">Due date</td><td><b>${dueDate}</b></td></tr></table>`),
    text: `Fee challan ${voucher}: PKR ${amount}, due ${dueDate}`,
  }),
  paymentReceipt: ({ name, voucher, amount, reference }) => ({
    subject: `Payment received — voucher ${voucher}`,
    html: shell('Payment received',
      `<p>Hi ${name},</p><p>We have received your fee payment. Keep this email as your receipt.</p>
       <table style="font-size:13px;border-collapse:collapse">
       <tr><td style="padding:4px 12px;color:#697386">Voucher</td><td><b>${voucher}</b></td></tr>
       <tr><td style="padding:4px 12px;color:#697386">Amount</td><td><b>PKR ${amount}</b></td></tr>
       <tr><td style="padding:4px 12px;color:#697386">Reference</td><td><b>${reference}</b></td></tr></table>`),
    text: `Payment received for voucher ${voucher}: PKR ${amount} (ref ${reference})`,
  }),
};

async function sendTemplate(name, to, data) {
  const tpl = templates[name];
  if (!tpl) throw new Error(`Unknown email template: ${name}`);
  const { subject, html, text } = tpl(data);
  return sendEmail({ to, subject, html, text });
}

module.exports = { sendEmail, sendTemplate, templates };
