const { getSecretCipher } = require('../security/secretCipher');
const { normalizePhone, hasConsent } = require('./whatsappConsent');
const isDryRun = () => process.env.DELIVERY_DRY_RUN === 'true';
function invalid(message) { return Object.assign(new Error(message), { status: 400 }); }

function validateWhatsAppConfig(wa = {}, { requireToken = true } = {}) {
  // Never send a bearer token to an arbitrary host or follow redirects.
  if (typeof wa.apiUrl !== 'string' || !/^https:\/\/graph\.facebook\.com\/v\d+\.0\/?$/.test(wa.apiUrl)) {
    throw invalid('WhatsApp API URL must be https://graph.facebook.com/v<supported-version>.0. Set an explicit supported Graph API version.');
  }
  if (!/^\d+$/.test(wa.phoneNumberId || '')) throw invalid('WhatsApp Phone Number ID must contain digits only.');
  if (wa.businessAccountId && !/^\d+$/.test(wa.businessAccountId)) throw invalid('WhatsApp Business Account ID must contain digits only.');
  if (requireToken && !(typeof wa.apiKey === 'string' ? wa.apiKey.trim() : wa.apiKey?.ciphertext)) throw invalid('WhatsApp API token is not configured.');
  return wa.apiUrl.replace(/\/$/, '');
}

function buildTemplate(value) {
  if (!value || !/^[a-z0-9_]{1,512}$/.test(value.name || '') || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(value.language || '')) throw invalid('Select a WhatsApp template with its exact Meta name and language.');
  const params = value.bodyParameters || [];
  if (!Array.isArray(params) || params.length > 30 || params.some(p => typeof p !== 'string' || !p.trim() || p.length > 1024 || /[\r\n\t]/.test(p))) throw invalid('WhatsApp template body parameters must be nonempty single-line text (maximum 1024 characters each).');
  return { name: value.name, language: { code: value.language }, ...(params.length ? { components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }] } : {}) };
}
function token(wa) { return typeof wa.apiKey === 'string' ? wa.apiKey : getSecretCipher().decrypt(wa.apiKey); }

async function verifyWhatsApp(settings, fetchImpl = globalThis.fetch) {
  const wa = settings?.whatsapp || {};
  const base = validateWhatsAppConfig(wa);
  const response = await fetchImpl(`${base}/${wa.phoneNumberId}?fields=id,display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${token(wa)}` }, redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw invalid('Meta rejected the configuration check. Verify token permissions, Phone Number ID and API version.');
  const data = await response.json();
  if (String(data.id) !== wa.phoneNumberId) throw invalid('Meta returned an unexpected Phone Number ID.');
  const { resolveWebhookSecret } = require('../security/whatsappSecrets');
  return { phoneNumber: data.display_phone_number, name: data.verified_name, webhookConfigured: Boolean(resolveWebhookSecret(wa, 'appSecret') && resolveWebhookSecret(wa, 'webhookVerifyToken')) };
}

async function sendWhatsApp({ settings, to, template, callbackData }, dependencies = {}) {
  let dispatched = false;
  try {
    const phone = normalizePhone(to);
    const payload = { messaging_product: 'whatsapp', to: phone, type: 'template', template: buildTemplate(template), ...(callbackData ? { biz_opaque_callback_data: callbackData } : {}) };
    const wa = settings?.whatsapp || {};
    const base = validateWhatsAppConfig(wa);
    if (!await (dependencies.hasConsent || hasConsent)(phone)) throw invalid('WhatsApp consent is missing or withdrawn for this phone number.');
    if (isDryRun()) return { success: true, status: 'skipped', mode: 'dry-run' };
    const accessToken = token(wa);
    dispatched = true;
    const response = await (dependencies.fetch || globalThis.fetch)(`${base}/${wa.phoneNumberId}/messages`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const code = data.error?.code;
      return { success: false, retryable: response.status === 429, uncertain: response.status >= 500,
        error: `Meta rejected the WhatsApp message (HTTP ${response.status}${Number.isInteger(code) ? `, code ${code}` : ''}). Check template approval, parameters, token and account limits.` };
    }
    if (!data.messages?.[0]?.id) return { success: false, retryable: false, uncertain: true, error: 'Meta response has no message ID. Check provider logs before retrying.' };
    return { success: true, status: 'sent', messageId: data.messages[0].id, mode: 'whatsapp-api' };
  } catch (error) {
    return { success: false, retryable: false, uncertain: dispatched,
      error: dispatched ? 'WhatsApp request outcome is unknown. Check provider logs before retrying.' : error.message };
  }
}
module.exports = { sendWhatsApp, isDryRun, buildTemplate, validateWhatsAppConfig, verifyWhatsApp };
