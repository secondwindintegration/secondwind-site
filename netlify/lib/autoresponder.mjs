// Thank-you email for a verified enquiry. Never throws: a failure here must
// not affect the form submission or Jake's existing Web3Forms notification.
//
// Env (set in Netlify, never in this file):
//   RESEND_API_KEY     required to send. If it is missing, we log and stop.
//   AUTOREPLY_FROM     optional. Default: Second Wind Integration <jake@secondwindintegration.com>
//   AUTOREPLY_REPLY_TO optional. Default: jake@secondwindintegration.com

import { createHash } from 'node:crypto';

export const BOOKING_URL = 'https://calendly.com/jake-secondwindintegration/30min';
export const PHONE_DISPLAY = '0417 813 548';
export const PHONE_TEL = '0417813548';
export const OWNER_EMAIL = 'jake@secondwindintegration.com';
export const DEFAULT_FROM = `Second Wind Integration <${OWNER_EMAIL}>`;

export const ENQUIRY_SOURCES = new Set(['techcheck', 'contact', 'start']);
export const ENQUIRY_FORMS = new Set(['techcheck-enquiry', 'contact-enquiry', 'start-enquiry']);

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (!email || email.length > 254) return null;
  if (/[\s,;<>()\\"]/.test(email)) return null;
  if (!EMAIL.test(email)) return null;
  return email;
}

export function firstName(value) {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .trim();
  const first = cleaned.split(/\s+/)[0] || '';
  return first.slice(0, 40);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function isHoneypot(data) {
  if (!data || typeof data !== 'object') return false;
  const company = data.company;
  return typeof company === 'string' && company.trim() !== '';
}

export function isSpamFlagged(data) {
  if (!data || typeof data !== 'object') return false;
  const flag = data.spam;
  return flag === true || flag === 'true' || flag === '1';
}

export function isEnquiry(data) {
  if (!data || typeof data !== 'object') return false;
  const source = String(data.source || '').trim();
  const formName = String(data['form-name'] || data.form_name || '').trim();
  if (source && ENQUIRY_SOURCES.has(source)) return true;
  if (formName && ENQUIRY_FORMS.has(formName)) return true;
  return false;
}

export function recipientFrom(data) {
  if (!data || typeof data !== 'object') return null;
  return normalizeEmail(data.email) || normalizeEmail(data.contact);
}

export function buildMessage(data) {
  const name = firstName(data && data.name);
  const hello = name ? `Hi ${name},` : 'Hi,';
  const text = [
    hello,
    '',
    "Thanks for writing to us. We've got your enquiry, and we'll be in touch within one business day.",
    '',
    "If you'd like to pick a time, our booking calendar is here:",
    BOOKING_URL,
    '',
    `Or ring us on ${PHONE_DISPLAY}.`,
    '',
    'Second Wind Integration',
    OWNER_EMAIL,
    '',
  ].join('\n');

  const helloHtml = name ? `Hi ${escapeHtml(name)},` : 'Hi,';
  const html = `<!DOCTYPE html>
<html lang="en-AU">
<body style="margin:0;padding:0;background:#ffffff;color:#1b1d22;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:18px;line-height:1.5;">
  <div style="max-width:560px;padding:24px;">
    <p style="margin:0 0 16px;">${helloHtml}</p>
    <p style="margin:0 0 16px;">Thanks for writing to us. We've got your enquiry, and we'll be in touch within one business day.</p>
    <p style="margin:0 0 16px;">If you'd like to pick a time, our booking calendar is here:<br><a href="${BOOKING_URL}" style="color:#1f3a5f;">${BOOKING_URL}</a></p>
    <p style="margin:0 0 16px;">Or ring us on <a href="tel:${PHONE_TEL}" style="color:#1f3a5f;">${PHONE_DISPLAY}</a>.</p>
    <p style="margin:24px 0 0;">Second Wind Integration<br><a href="mailto:${OWNER_EMAIL}" style="color:#1f3a5f;">${OWNER_EMAIL}</a></p>
  </div>
</body>
</html>`;

  return { subject: "We've got your enquiry", text, html };
}

function envLine(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/.test(trimmed) || trimmed.length > 200) return fallback;
  return trimmed;
}

export function decide(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { send: false, reason: 'empty' };
  if (isSpamFlagged(data) || isHoneypot(data)) return { send: false, reason: 'spam' };
  if (!isEnquiry(data)) return { send: false, reason: 'not-enquiry' };
  const email = recipientFrom(data);
  if (!email) return { send: false, reason: 'no-email' };
  return { send: true, email, message: buildMessage(data) };
}

export async function sendAutoreply({ data, env, fetchImpl }) {
  try {
    const decision = decide(data);
    if (!decision.send) return { ok: true, sent: false, reason: decision.reason };

    const apiKey = env && typeof env.RESEND_API_KEY === 'string' ? env.RESEND_API_KEY.trim() : '';
    if (!apiKey) {
      console.error('autoresponder: RESEND_API_KEY is not set, so no thank-you email was sent');
      return { ok: true, sent: false, reason: 'no-api-key' };
    }

    const from = envLine(env.AUTOREPLY_FROM, DEFAULT_FROM);
    const replyTo = envLine(env.AUTOREPLY_REPLY_TO, OWNER_EMAIL);
    const idempotencyKey = createHash('sha256')
      .update(JSON.stringify({
        to: decision.email,
        source: String(data.source || ''),
        form: String(data['form-name'] || data.form_name || ''),
        name: String(data.name || ''),
        note: String(data.headache || data.busywork || ''),
      }))
      .digest('hex');

    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [decision.email],
        reply_to: replyTo,
        subject: decision.message.subject,
        text: decision.message.text,
        html: decision.message.html,
      }),
    });

    if (!res.ok) {
      const detail = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
      console.error('autoresponder: Resend rejected the thank-you email', res.status, String(detail).slice(0, 300));
      return { ok: true, sent: false, reason: 'provider-error' };
    }
    return { ok: true, sent: true };
  } catch (err) {
    console.error('autoresponder: thank-you email failed', err && err.message ? err.message : 'unknown error');
    return { ok: true, sent: false, reason: 'error' };
  }
}
