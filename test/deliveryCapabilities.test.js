const test = require('node:test');
const assert = require('node:assert/strict');
const { getProviderCapabilities } = require('../server/services/providerCapabilities');

test('reports configured providers without advertising unsupported SMS', (t) => {
  const saved = [process.env.WHATSAPP_APP_SECRET, process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN];
  process.env.WHATSAPP_APP_SECRET = 'test-secret';
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify';
  t.after(() => ['WHATSAPP_APP_SECRET', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN'].forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; }));
  const result = getProviderCapabilities({
    smtp: { host: 'smtp.example.test', user: 'mailer@example.test', password: 'secret' },
    whatsapp: { phoneNumberId: '123', apiKey: 'secret', businessAccountId: '456', apiUrl: 'https://graph.facebook.com/v25.0' }
  });

  assert.deepEqual(result, {
    email: { enabled: true },
    whatsapp: { enabled: true },
    sms: { enabled: false, reason: 'SMS provider is not configured' }
  });
});
