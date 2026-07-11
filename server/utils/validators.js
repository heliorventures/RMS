const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_RE = /^\+?[\d\s\-()]{8,20}$/;

function validateEmail(email) {
  if (!email || !String(email).trim()) {
    return { valid: false, reason: 'Email address is missing' };
  }
  const normalized = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return { valid: false, reason: 'Invalid email format' };
  }
  if (normalized.includes('..') || normalized.startsWith('.') || normalized.endsWith('.')) {
    return { valid: false, reason: 'Invalid email format' };
  }
  return { valid: true, value: normalized };
}

function validatePhone(phone) {
  if (!phone || !String(phone).trim()) {
    return { valid: false, reason: 'Phone number is missing' };
  }
  const normalized = String(phone).trim().replace(/\s+/g, ' ');
  if (!PHONE_RE.test(normalized)) {
    return { valid: false, reason: 'Invalid phone number format' };
  }
  return { valid: true, value: normalized };
}

function validateRecipient(channel, contact) {
  if (channel === 'email') return validateEmail(contact.email);
  if (channel === 'whatsapp' || channel === 'sms') {
    const phone = contact.whatsapp || contact.mobile;
    return validatePhone(phone);
  }
  return { valid: false, reason: `Unsupported channel: ${channel}` };
}

module.exports = { validateEmail, validatePhone, validateRecipient };
