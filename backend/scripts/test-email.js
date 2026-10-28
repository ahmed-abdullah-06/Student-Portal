#!/usr/bin/env node
/**
 * Send a test email through the configured transport.
 *
 * Usage:
 *   node scripts/test-email.js someone@example.com
 *
 * Without SMTP_HOST the message is written to logs/outbox (dev mode);
 * with SMTP credentials it goes through the real server.
 */
require('dotenv').config({ path: __dirname + '/../.env' });

const { sendTemplate } = require('../src/services/email');
const { env } = require('../src/config/env');

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes('@')) {
    console.error('Usage: node scripts/test-email.js <recipient@example.com>');
    process.exit(1);
  }

  const e = env();
  const mode = e.SMTP_HOST ? `SMTP via ${e.SMTP_HOST}` : 'dev outbox (SMTP_HOST not set)';
  console.log(`Sending test email to ${to} using: ${mode}`);

  const result = await sendTemplate('requestUpdate', to, {
    name: 'Administrator',
    title: 'Novastra test email',
    body: 'If you can read this, email delivery is configured correctly.',
  });

  if (result.dev) console.log(`DEV OUTBOX: saved to ${result.file} (configure SMTP_* for real delivery)`);
  else console.log(`SENT: messageId=${result.messageId}`);
}

main().catch((err) => {
  console.error('Email test failed:', err.message);
  process.exit(1);
});
