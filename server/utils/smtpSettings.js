const SMTP_FIELDS = ['host', 'port', 'user', 'fromEmail', 'fromName'];
const WHATSAPP_FIELDS = ['apiUrl', 'phoneNumberId', 'businessAccountId'];
const { webhookSecretState } = require('../security/whatsappSecrets');

function hasStoredSecret(value) {
  return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value?.ciphertext);
}

function copyFields(update, prefix, source, fields) {
  if (!source || typeof source !== 'object') return;
  for (const field of fields) {
    if (Object.hasOwn(source, field)) update[`${prefix}.${field}`] = source[field];
  }
}

function buildProviderSettingsUpdate({ smtp, whatsapp } = {}, cipher) {
  const update = {};
  copyFields(update, 'smtp', smtp, SMTP_FIELDS);
  copyFields(update, 'whatsapp', whatsapp, WHATSAPP_FIELDS);
  if (typeof smtp?.password === 'string' && smtp.password.trim()) {
    if (!cipher) throw new Error('Settings encryption is required before storing an SMTP credential.');
    update['smtp.password'] = cipher.encrypt(smtp.password);
  }
  for (const key of ['apiKey', 'appSecret', 'webhookVerifyToken']) {
    if (whatsapp?.[key] !== undefined && typeof whatsapp[key] !== 'string') throw Object.assign(new Error('WhatsApp secrets must be text.'), { status: 400 });
    if (typeof whatsapp?.[key] === 'string' && whatsapp[key].trim()) {
      if (!cipher) throw new Error('Settings encryption is required before storing a WhatsApp credential.');
      update[`whatsapp.${key}`] = cipher.encrypt(whatsapp[key].trim());
    }
  }
  return update;
}

function buildSmtpSettingsUpdate(smtp, cipher) {
  return buildProviderSettingsUpdate({ smtp }, cipher);
}

function sanitizeSettingsForUser(settings, user) {
  const plain = settings?.toObject ? settings.toObject() : settings;
  if (user?.role !== 'admin') {
    return {
      company: plain?.company,
      labels: plain?.labels,
      theme: plain?.theme ? { primaryColor: plain.theme.primaryColor, darkMode: plain.theme.darkMode } : undefined
    };
  }
  const { password, ...smtp } = plain?.smtp || {};
  const { apiKey, appSecret, webhookVerifyToken, ...whatsapp } = plain?.whatsapp || {};
  return { ...plain, smtp: { ...smtp, configured: hasStoredSecret(password) }, whatsapp: { ...whatsapp, configured: hasStoredSecret(apiKey), ...webhookSecretState({ appSecret, webhookVerifyToken }) } };
}

module.exports = { buildSmtpSettingsUpdate, buildProviderSettingsUpdate, sanitizeSettingsForUser, hasStoredSecret };
