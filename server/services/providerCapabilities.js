function hasSecret(value) {
  return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value?.ciphertext);
}

function getProviderCapabilities(settings = {}) {
  const smtp = settings.smtp || {};
  const whatsapp = settings.whatsapp || {};
  let whatsappCapability;
  try {
    require('./whatsappService').validateWhatsAppConfig(whatsapp);
    const secrets = require('../security/whatsappSecrets').webhookSecretState(whatsapp);
    if (!whatsapp.businessAccountId || !secrets.appSecretConfigured || !secrets.webhookVerifyTokenConfigured) throw new Error('Configure WhatsApp Business Account ID and webhook secrets in Settings before sending.');
    whatsappCapability = { enabled: true };
  } catch (error) { whatsappCapability = { enabled: false, reason: error.message }; }
  return {
    email: { enabled: Boolean(smtp.host && smtp.user && hasSecret(smtp.password)) },
    whatsapp: whatsappCapability,
    sms: { enabled: false, reason: 'SMS provider is not configured' }
  };
}

module.exports = { getProviderCapabilities };
