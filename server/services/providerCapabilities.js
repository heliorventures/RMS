function hasSecret(value) {
  return typeof value === 'string' ? Boolean(value.trim()) : Boolean(value?.ciphertext);
}

function getProviderCapabilities(settings = {}) {
  const smtp = settings.smtp || {};
  const whatsapp = settings.whatsapp || {};
  return {
    email: { enabled: Boolean(smtp.host && smtp.user && hasSecret(smtp.password)) },
    whatsapp: { enabled: Boolean(whatsapp.phoneNumberId && hasSecret(whatsapp.apiKey)) },
    sms: { enabled: false, reason: 'SMS provider is not configured' }
  };
}

module.exports = { getProviderCapabilities };
