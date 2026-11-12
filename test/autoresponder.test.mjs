import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOOKING_URL,
  OWNER_EMAIL,
  PHONE_DISPLAY,
  buildMessage,
  decide,
  normalizeEmail,
  sendAutoreply,
} from '../netlify/lib/autoresponder.mjs';

const enquiry = (extra) => ({ source: 'contact', name: 'Sarah Nguyen', contact: 'sarah@shop.com.au', ...extra });

describe('normalizeEmail', () => {
  it('accepts a normal address and trims it', () => {
    assert.equal(normalizeEmail('  Sarah@Shop.com.au  '), 'Sarah@Shop.com.au');
  });

  it('rejects empty, phone numbers, and broken addresses', () => {
    for (const value of ['', '   ', null, undefined, 12, '0417 813 548', 'sarah', 'sarah@', 'sarah@shop', 'sarah@shop.c', 'a b@shop.com', 'sarah@shop.com, other@shop.com', 'sa\nrah@shop.com', '<sarah@shop.com>']) {
      assert.equal(normalizeEmail(value), null, String(value));
    }
  });

  it('rejects an address that is too long', () => {
    assert.equal(normalizeEmail(`${'a'.repeat(250)}@shop.com`), null);
  });
});

describe('decide', () => {
  it('sends to the email on a contact or tech-check form', () => {
    const contact = decide(enquiry());
    assert.equal(contact.send, true);
    assert.equal(contact.email, 'sarah@shop.com.au');

    const tech = decide({ source: 'techcheck', 'form-name': 'techcheck-enquiry', name: 'Sam', contact: 'sam@millinery.com' });
    assert.equal(tech.send, true);
    assert.equal(tech.email, 'sam@millinery.com');
  });

  it('uses the email field on the start form and ignores a phone-only enquiry', () => {
    const withEmail = decide({ source: 'start', name: 'Pat Lee', phone: '0412345678', email: 'pat@example.com' });
    assert.equal(withEmail.send, true);
    assert.equal(withEmail.email, 'pat@example.com');

    const phoneOnly = decide({ source: 'start', name: 'Pat Lee', phone: '0412345678', email: '' });
    assert.deepEqual(phoneOnly, { send: false, reason: 'no-email' });

    const contactPhone = decide({ source: 'contact', name: 'Pat', contact: '0412 345 678' });
    assert.equal(contactPhone.reason, 'no-email');
  });

  it('ignores the newsletter, honeypot, and spam', () => {
    assert.equal(decide({ 'form-name': 'newsletter', email: 'news@example.com', consent: 'yes' }).reason, 'not-enquiry');
    assert.equal(decide({ email: 'news@example.com' }).reason, 'not-enquiry');
    assert.equal(decide(enquiry({ company: 'Acme Bots' })).reason, 'spam');
    assert.equal(decide(enquiry({ spam: 'true' })).reason, 'spam');
    assert.equal(decide(null).reason, 'empty');
  });

  it('still recognises an enquiry from the form name alone', () => {
    const result = decide({ 'form-name': 'start-enquiry', name: 'Jo', email: 'jo@shop.com' });
    assert.equal(result.send, true);
  });
});

describe('buildMessage', () => {
  it('thanks them by their first name and includes the calendar and phone', () => {
    const { subject, text, html } = buildMessage({ name: 'Sarah Nguyen' });
    assert.equal(subject, "We've got your enquiry");
    assert.match(text, /^Hi Sarah,/);
    assert.match(text, /within one business day/);
    assert.match(text, /Ring us|ring us/);
    assert.ok(text.includes(BOOKING_URL));
    assert.ok(text.includes(PHONE_DISPLAY));
    assert.ok(text.includes(OWNER_EMAIL));
    assert.ok(html.includes('Hi Sarah,'));
    assert.ok(html.includes(`href="${BOOKING_URL}"`));
    assert.ok(html.includes('tel:0417813548'));
    assert.equal(text.includes('A$'), false);
    assert.equal(html.includes('A$'), false);
  });

  it('does not invent a name, and escapes HTML in one', () => {
    const unnamed = buildMessage({});
    assert.match(unnamed.text, /^Hi,/);
    assert.equal(unnamed.html.includes('Hi ,'), false);

    const messy = buildMessage({ name: '<b>Ann</b>\nSmith' });
    assert.match(messy.text, /^Hi Ann,/);
    assert.equal(messy.html.includes('<b>Ann</b>'), false);
    assert.ok(messy.html.includes('Hi Ann,'));
    assert.equal(messy.text.includes('\nSmith'), false);
  });
});

describe('sendAutoreply', () => {
  it('does not call Resend when there is nothing to send', async () => {
    let called = false;
    const result = await sendAutoreply({
      data: { source: 'start', name: 'Pat', phone: '0412345678' },
      env: { RESEND_API_KEY: 're_test' },
      fetchImpl: async () => { called = true; return { ok: true }; },
    });
    assert.equal(called, false);
    assert.equal(result.sent, false);
    assert.equal(result.ok, true);
  });

  it('does not throw when the API key is missing', async () => {
    const result = await sendAutoreply({
      data: enquiry(),
      env: {},
      fetchImpl: async () => { throw new Error('should not be called'); },
    });
    assert.deepEqual(result, { ok: true, sent: false, reason: 'no-api-key' });
  });

  it('posts a plain-text and HTML email from Jake, and stays quiet if Resend fails', async () => {
    let captured;
    const ok = await sendAutoreply({
      data: enquiry(),
      env: { RESEND_API_KEY: 're_test_key' },
      fetchImpl: async (url, init) => {
        captured = { url, init };
        return { ok: true, text: async () => '' };
      },
    });
    assert.equal(ok.sent, true);
    assert.equal(captured.url, 'https://api.resend.com/emails');
    assert.equal(captured.init.headers.Authorization, 'Bearer re_test_key');
    const body = JSON.parse(captured.init.body);
    assert.equal(body.from, 'Second Wind Integration <jake@secondwindintegration.com>');
    assert.equal(body.reply_to, 'jake@secondwindintegration.com');
    assert.deepEqual(body.to, ['sarah@shop.com.au']);
    assert.equal(body.subject, "We've got your enquiry");
    assert.match(body.text, /Hi Sarah,/);
    assert.match(body.html, /Hi Sarah,/);
    assert.equal(body.text.includes('re_test_key'), false);

    const failed = await sendAutoreply({
      data: enquiry(),
      env: { RESEND_API_KEY: 're_test_key' },
      fetchImpl: async () => ({ ok: false, status: 422, text: async () => 'bad' }),
    });
    assert.deepEqual(failed, { ok: true, sent: false, reason: 'provider-error' });

    const thrown = await sendAutoreply({
      data: enquiry(),
      env: { RESEND_API_KEY: 're_test_key' },
      fetchImpl: async () => { throw new Error('network down'); },
    });
    assert.equal(thrown.reason, 'error');
    assert.equal(thrown.ok, true);
  });

  it('uses the same idempotency key for the same enquiry', async () => {
    const keys = [];
    const fetchImpl = async (_url, init) => {
      keys.push(init.headers['Idempotency-Key']);
      return { ok: true, text: async () => '' };
    };
    const env = { RESEND_API_KEY: 're_test_key', AUTOREPLY_FROM: 'Second Wind <hello@mail.secondwindintegration.com>' };
    await sendAutoreply({ data: enquiry(), env, fetchImpl });
    await sendAutoreply({ data: enquiry(), env, fetchImpl });
    assert.equal(keys[0], keys[1]);
    assert.equal(keys[0].length, 64);
  });
});
