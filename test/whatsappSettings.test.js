const test = require('node:test');
const assert = require('node:assert/strict');
const { createSecretCipher } = require('../server/security/secretCipher');
const { buildProviderSettingsUpdate, sanitizeSettingsForUser } = require('../server/utils/smtpSettings');
const cipher = createSecretCipher([{ id: 'test', key: Buffer.alloc(32, 9) }]);
const { resolveWebhookSecret } = require('../server/security/whatsappSecrets');
test('saved encrypted secrets win over env and invalid saved secrets fail closed', () => {
  const env = { WHATSAPP_APP_SECRET: 'old-secret' };
  assert.equal(resolveWebhookSecret({}, 'appSecret', env), 'old-secret');
  assert.equal(resolveWebhookSecret({ appSecret: cipher.encrypt('new-secret') }, 'appSecret', env, cipher), 'new-secret');
  assert.throws(() => resolveWebhookSecret({ appSecret: {} }, 'appSecret', env, cipher));
});
test('webhook secrets are encrypted and omitted from admin and non-admin responses', () => {
  const update = buildProviderSettingsUpdate({ whatsapp: { appSecret: 'app-secret', webhookVerifyToken: 'verify-secret' } }, cipher);
  assert.equal(cipher.decrypt(update['whatsapp.appSecret']), 'app-secret');
  assert.equal(cipher.decrypt(update['whatsapp.webhookVerifyToken']), 'verify-secret');
  const settings = { whatsapp: { appSecret: update['whatsapp.appSecret'], webhookVerifyToken: update['whatsapp.webhookVerifyToken'] } };
  const admin = sanitizeSettingsForUser(settings, { role: 'admin' });
  assert.equal(admin.whatsapp.appSecretConfigured, true);
  assert.equal(admin.whatsapp.webhookVerifyTokenConfigured, true);
  assert.equal(admin.whatsapp.appSecret, undefined);
  assert.equal(admin.whatsapp.webhookVerifyToken, undefined);
  assert.equal(sanitizeSettingsForUser(settings, { role: 'user' }).whatsapp, undefined);
  assert.deepEqual(buildProviderSettingsUpdate({ whatsapp: { appSecret: ' ', webhookVerifyToken: '' } }, cipher), {});
});
