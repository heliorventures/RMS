const logger = require('../utils/logger');

function isDryRun() {
  return process.env.DELIVERY_DRY_RUN === 'true';
}

async function sendWhatsApp({ settings, to, body }) {
  if (isDryRun()) {
    logger.info('DRY RUN WhatsApp', { to });
    return { success: true, messageId: `wa-dry-${Date.now()}`, mode: 'dry-run' };
  }

  const wa = settings?.whatsapp || {};
  if (!wa.apiKey || !wa.phoneNumberId) {
    return { success: false, error: 'WhatsApp API not configured' };
  }

  const phone = String(to).replace(/\D/g, '');
  const url = `${(wa.apiUrl || 'https://graph.facebook.com/v18.0').replace(/\/$/, '')}/${wa.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${wa.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: body || 'Hello from RMS' }
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.error?.message || res.statusText || 'WhatsApp API error';
      logger.error('WhatsApp send failed', { to, error: errMsg });
      return { success: false, error: errMsg };
    }

    logger.info('WhatsApp sent', { to, messageId: data.messages?.[0]?.id });
    return { success: true, messageId: data.messages?.[0]?.id, mode: 'whatsapp-api' };
  } catch (err) {
    logger.error('WhatsApp request failed', { to, error: err.message });
    return { success: false, error: err.message };
  }
}

module.exports = { sendWhatsApp, isDryRun };
