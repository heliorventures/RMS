const test = require('node:test');
const assert = require('node:assert/strict');
const { createSecretCipher } = require('../server/security/secretCipher');
const { buildProviderSettingsUpdate, sanitizeSettingsForUser } = require('../server/utils/smtpSettings');

const cipher = createSecretCipher([{ id: 'test-key', key: Buffer.alloc(32, 3) }]);

test('encrypts new SMTP and WhatsApp secrets while blank values preserve stored credentials', () => {
  const update = buildProviderSettingsUpdate({
    smtp: { password: 'smtp-secret', host: 'smtp.test' },
    whatsapp: { apiKey: 'whatsapp-secret', phoneNumberId: 'phone-id' }
  }, cipher);

  assert.equal(cipher.decrypt(update['smtp.password']), 'smtp-secret');
  assert.equal(cipher.decrypt(update['whatsapp.apiKey']), 'whatsapp-secret');
  assert.equal(update['smtp.host'], 'smtp.test');
  assert.equal(update['whatsapp.phoneNumberId'], 'phone-id');

  assert.deepEqual(buildProviderSettingsUpdate({
    smtp: { password: '  ' },
    whatsapp: { apiKey: '' }
  }, cipher), {});
});

test('admin settings response exposes configured state but no provider secret', () => {
  const result = sanitizeSettingsForUser({
    company: { name: 'RMS' },
    smtp: { host: 'smtp.test', user: 'mailer@test', password: cipher.encrypt('smtp-secret') },
    whatsapp: { phoneNumberId: 'phone-id', apiKey: cipher.encrypt('wa-secret') }
  }, { role: 'admin' });

  assert.deepEqual(result, {
    company: { name: 'RMS' },
    smtp: { host: 'smtp.test', user: 'mailer@test', configured: true },
    whatsapp: { phoneNumberId: 'phone-id', configured: true }
  });
  assert.equal(JSON.stringify(result).includes('ciphertext'), false);
});
