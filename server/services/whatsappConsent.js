const Consent = require('../models/WhatsAppConsent');
function normalizePhone(value) {
  if (typeof value !== 'string' || !/^\+?[\d ()-]+$/.test(value)) throw Object.assign(new Error('Use a WhatsApp number with country code.'), { status: 400 });
  const phone = value.replace(/\D/g, '');
  if (!/^[1-9]\d{7,14}$/.test(phone)) throw Object.assign(new Error('Use a WhatsApp number with country code (8-15 digits).'), { status: 400 });
  return phone;
}
async function hasConsent(phone) { return Boolean(await Consent.exists({ phone: normalizePhone(phone), status: 'granted' })); }
async function getConsent(phone) { return Consent.findOne({ phone: normalizePhone(phone) }).lean(); }
async function recordConsent({ phone, status, source, actor, at = new Date() }) {
  phone = normalizePhone(phone);
  // Meta timestamps have only second precision. Withdrawal wins ambiguous ties.
  if (status === 'withdrawn') at = new Date(Math.floor(at.getTime() / 1000) * 1000 + 999);
  if (!['granted', 'withdrawn'].includes(status) || typeof source !== 'string' || !source.trim() || source.length > 500) throw Object.assign(new Error('Provide consent status and a source describing the recipient permission or opt-out.'), { status: 400 });
  const entry = { status, source: source.trim(), actor, at };
  try { await Consent.updateOne({ phone }, { $setOnInsert: { phone, status: 'withdrawn', source: entry.source, actor, changedAt: new Date(0), history: [] } }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const order = status === 'withdrawn' ? { $or: [{ changedAt: { $lt: at } }, { changedAt: at, status: 'granted' }] } : { changedAt: { $lt: at } };
  await Consent.updateOne({ phone, ...order }, { $set: { status, source: entry.source, actor, changedAt: at }, $push: { history: entry } });
  return getConsent(phone);
}
module.exports = { normalizePhone, hasConsent, getConsent, recordConsent };
