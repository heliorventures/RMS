const test = require('node:test');
const assert = require('node:assert/strict');
const { getProviderCapabilities } = require('../server/services/providerCapabilities');

test('reports configured providers without advertising unsupported SMS', () => {
  const result = getProviderCapabilities({
    smtp: { host: 'smtp.example.test', user: 'mailer@example.test', password: 'secret' },
    whatsapp: { phoneNumberId: 'phone-id', apiKey: 'secret' }
  });

  assert.deepEqual(result, {
    email: { enabled: true },
    whatsapp: { enabled: true },
    sms: { enabled: false, reason: 'SMS provider is not configured' }
  });
});
