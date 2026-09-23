const test = require('node:test');
const assert = require('node:assert/strict');
const { sendWhatsApp, validateWhatsAppConfig, buildTemplate } = require('../server/services/whatsappService');

const settings = { whatsapp: { apiUrl: 'https://graph.facebook.com/v25.0', phoneNumberId: '123456', apiKey: 'secret' } };
const template = { name: 'birthday_greeting', language: 'en_US', bodyParameters: ['Anita'] };

test('rejects arbitrary hosts, redirects through URL credentials, and missing API versions', () => {
  for (const apiUrl of ['https://evil.test/v25.0', 'http://graph.facebook.com/v25.0', 'https://graph.facebook.com@evil.test/v25.0', 'https://graph.facebook.com', 'https://graph.facebook.com/v25.0?token=secret']) {
    assert.throws(() => validateWhatsAppConfig({ ...settings.whatsapp, apiUrl }), /API URL/);
  }
});
test('builds a Meta template and rejects missing or malformed mappings', () => {
  assert.deepEqual(buildTemplate(template), { name: 'birthday_greeting', language: { code: 'en_US' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Anita' }] }] });
  for (const value of [undefined, {}, { ...template, name: 'Bad Name' }, { ...template, bodyParameters: [''] }]) assert.throws(() => buildTemplate(value), /template/i);
});
test('sends a template with correlation data and reports API acceptance only', async () => {
  let request;
  const result = await sendWhatsApp({ settings, to: '+91 9876543210', template, callbackData: 'attempt-1' }, {
    hasConsent: async () => true,
    fetch: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) }; }
  });
  assert.equal(result.success, true);
  assert.equal(result.messageId, 'wamid.1');
  assert.equal(result.status, 'sent');
  assert.equal(request.url, 'https://graph.facebook.com/v25.0/123456/messages');
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.type, 'template');
  assert.equal(payload.to, '919876543210');
  assert.equal(payload.biz_opaque_callback_data, 'attempt-1');
  assert.equal(request.options.redirect, 'error');
});
test('blocks absent consent and plain text without contacting Meta', async () => {
  const dependencies = { hasConsent: async () => false, fetch: async () => { throw new Error('must not call transport'); } };
  const denied = await sendWhatsApp({ settings, to: '919876543210', template }, dependencies);
  assert.equal(denied.success, false);
  assert.match(denied.error, /consent/i);
  const unmapped = await sendWhatsApp({ settings, to: '919876543210', body: 'hello' }, { ...dependencies, hasConsent: async () => true });
  assert.equal(unmapped.success, false);
  assert.equal(unmapped.retryable, false);
});
test('does not automatically resend on an ambiguous network failure or missing provider ID', async () => {
  for (const fetch of [async () => { throw new Error('timeout'); }, async () => ({ ok: true, json: async () => ({}) })]) {
    const result = await sendWhatsApp({ settings, to: '919876543210', template }, { hasConsent: async () => true, fetch });
    assert.equal(result.success, false);
    assert.equal(result.retryable, false);
    assert.equal(result.uncertain, true);
  }
});
test('dry runs still enforce template and consent and never report delivery', async () => {
  const before = process.env.DELIVERY_DRY_RUN;
  process.env.DELIVERY_DRY_RUN = 'true';
  try {
    const result = await sendWhatsApp({ settings, to: '919876543210', template }, { hasConsent: async () => true });
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.status, 'skipped');
    const denied = await sendWhatsApp({ settings, to: '919876543210', template }, { hasConsent: async () => false });
    assert.equal(denied.success, false);
  } finally { if (before === undefined) delete process.env.DELIVERY_DRY_RUN; else process.env.DELIVERY_DRY_RUN = before; }
});
