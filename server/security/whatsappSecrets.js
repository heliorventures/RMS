const { getSecretCipher } = require('./secretCipher');
const fields = { appSecret: 'WHATSAPP_APP_SECRET', webhookVerifyToken: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN' };
function hasValue(value) { return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value?.ciphertext); }
function webhookSecretState(wa = {}, env = process.env) {
  return Object.fromEntries(Object.entries(fields).map(([key, variable]) => [`${key}Configured`, hasValue(wa[key]) || hasValue(env[variable])]));
}
function resolveWebhookSecret(wa, field, env = process.env, cipher) {
  if (!Object.hasOwn(fields, field)) throw new Error('Unknown webhook secret.');
  const value = wa?.[field];
  // A stored value wins. Decryption failure must never fall back to another credential.
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') return (cipher || getSecretCipher()).decrypt(value);
  return env[fields[field]] || '';
}
module.exports = { webhookSecretState, resolveWebhookSecret };
