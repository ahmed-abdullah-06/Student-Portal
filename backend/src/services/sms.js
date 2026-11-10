const { env } = require('../config/env');
const { log } = require('../utils/logger');

/**
 * SMS abstraction.
 *  - provider "none"   → dev mode: message logged only (default)
 *  - provider "twilio" → Twilio REST API
 *  - provider "http"   → any HTTP gateway (SMS_HTTP_URL with {to},{text} placeholders)
 */
async function sendSMS(to, text) {
  const e = env();
  if (!to) return { skipped: true, reason: 'no_destination' };

  if (e.SMS_PROVIDER === 'none') {
    log('info', 'sms_dev_mode', { to, text });
    return { dev: true };
  }

  try {
    if (e.SMS_PROVIDER === 'twilio') {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${e.SMS_ACCOUNT_SID}/Messages.json`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${e.SMS_ACCOUNT_SID}:${e.SMS_AUTH_TOKEN}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: e.SMS_FROM, Body: text }),
      });
      if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
      log('info', 'sms_sent', { to, provider: 'twilio' });
      return { ok: true };
    }

    if (e.SMS_PROVIDER === 'http' && e.SMS_HTTP_URL) {
      const url = e.SMS_HTTP_URL
        .replace('{to}', encodeURIComponent(to))
        .replace('{text}', encodeURIComponent(text));
      const res = await fetch(url);
      if (!res.ok) throw new Error(`SMS gateway ${res.status}`);
      log('info', 'sms_sent', { to, provider: 'http' });
      return { ok: true };
    }

    return { skipped: true, reason: 'misconfigured' };
  } catch (err) {
    log('error', 'sms_failed', { to, error: err.message });
    return { ok: false, error: err.message };
  }
}

module.exports = { sendSMS };
