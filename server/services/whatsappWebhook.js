const crypto = require('node:crypto');
const Message = require('../models/Message');
const CommunicationHistory = require('../models/CommunicationHistory');
const { normalizePhone, recordConsent } = require('./whatsappConsent');

function verifySignature(raw, signature, secret) {
  if (!secret || !Buffer.isBuffer(raw) || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return crypto.timingSafeEqual(crypto.createHmac('sha256', secret).update(raw).digest(), Buffer.from(signature.slice(7), 'hex'));
}
const rank = { pending: 0, scheduled: 0, processing: 0, sent: 1, failed: 2, delivered: 3, read: 4 };
function statusUpdate(current, incoming, at, uncertain = false) {
  const currentRank = current === 'failed' && uncertain ? 0 : (rank[current] ?? 0);
  if (!['sent', 'failed', 'delivered', 'read'].includes(incoming) || current === 'skipped' || rank[incoming] <= currentRank) return null;
  return { status: incoming, outcomeUncertain: false, error: null, failureReason: null, ...(incoming === 'sent' ? { sentAt: at } : {}), ...(['delivered', 'read'].includes(incoming) ? { deliveredAt: at } : {}), ...(incoming === 'read' ? { readAt: at } : {}) };
}
function eventDate(timestamp) {
  const ms = Number(timestamp) * 1000;
  return Number.isFinite(ms) && ms > 0 && ms <= Date.now() + 300000 ? new Date(ms) : null;
}
function parseWebhook(payload, wa) {
  const result = { statuses: [], optOuts: [] };
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return result;
  for (const entry of payload.entry) {
    if (!wa.businessAccountId || String(entry.id) !== wa.businessAccountId) continue;
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const value = change.value;
      if (change.field !== 'messages' || String(value?.metadata?.phone_number_id) !== wa.phoneNumberId) continue;
      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        if (typeof status.id === 'string' && eventDate(status.timestamp)) result.statuses.push(status);
      }
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const text = message.text?.body || message.button?.text || message.interactive?.button_reply?.title;
        if (typeof text === 'string' && /^(stop|unsubscribe|cancel|end|quit|opt[ -]?out)$/i.test(text.trim()) && eventDate(message.timestamp)) result.optOuts.push(message);
      }
    }
  }
  return result;
}

async function syncHistory(message) {
  if (!message || !['sent', 'delivered', 'read', 'failed'].includes(message.status)) return;
  const attempt = message.providerAttemptNumber || 0;
  const entry = { messageId: message._id, contactId: message.contactId, contactName: message.contactName, type: 'whatsapp', subject: message.subject, message: (message.body || '').slice(0, 500), sentBy: 'RMS System', sentAt: message.sentAt || new Date(), status: message.status };
  entry.providerAttemptNumber = attempt;
  entry.outcomeUncertain = Boolean(message.outcomeUncertain);
  try { await CommunicationHistory.updateOne({ messageId: message._id }, { $setOnInsert: entry }, { upsert: true }); }
  catch (error) { if (error.code !== 11000) throw error; }
  const lower = message.outcomeUncertain ? [] : Object.keys(rank).filter(s => rank[s] < rank[message.status]);
  await CommunicationHistory.updateOne({ messageId: message._id, $or: [
    { providerAttemptNumber: { $lt: attempt } },
    { providerAttemptNumber: { $exists: false } },
    { providerAttemptNumber: attempt, status: { $in: lower } },
    ...(!message.outcomeUncertain ? [{ providerAttemptNumber: attempt, outcomeUncertain: true }] : [])
  ] }, { $set: { status: message.status, providerAttemptNumber: attempt, sentAt: entry.sentAt, outcomeUncertain: Boolean(message.outcomeUncertain) } });
}

async function applyStatus(status, wa) {
  let phone;
  try { phone = normalizePhone(status.recipient_id); } catch { return; }
  const match = { type: 'whatsapp', recipient: phone, providerPhoneNumberId: wa.phoneNumberId,
    ...(typeof status.biz_opaque_callback_data === 'string' ? { providerAttemptId: status.biz_opaque_callback_data } : { providerMessageId: status.id }) };
  // Compare-and-set also protects against two simultaneous webhook deliveries.
  for (let attempt = 0; attempt < 5; attempt++) {
    const message = await Message.findOne(match).lean();
    if (!message) return;
    const update = statusUpdate(message.status, status.status, eventDate(status.timestamp), message.outcomeUncertain);
    if (!update) { await syncHistory(message); return message.jobId; }
    update.providerMessageId = status.id;
    if (message.deliveredAt) delete update.deliveredAt;
    if (status.status === 'failed') {
      update.error = update.failureReason = `WhatsApp delivery failed${Number.isInteger(status.errors?.[0]?.code) ? ` (Meta code ${status.errors[0].code})` : ''}.`;
      update.outcomeUncertain = false;
    }
    const updated = await Message.findOneAndUpdate({ ...match, _id: message._id, status: message.status, outcomeUncertain: message.outcomeUncertain === true ? true : { $ne: true } }, { $set: update }, { new: true }).lean();
    if (updated) { await syncHistory(updated); return updated.jobId; }
  }
  throw new Error('Concurrent webhook update; retry required');
}
async function handleWebhook(payload, wa) {
  const events = parseWebhook(payload, wa);
  // Apply opt-outs before status work; redeliveries cannot re-grant or repeat history.
  for (const message of events.optOuts) {
    await recordConsent({ phone: message.from, status: 'withdrawn', source: 'WhatsApp recipient opt-out', actor: 'WhatsApp webhook', at: eventDate(message.timestamp) });
  }
  const jobs = new Set();
  for (const status of events.statuses) { const job = await applyStatus(status, wa); if (job) jobs.add(String(job)); }
  for (const job of jobs) await require('./deliveryQueue').finalizeJob(job);
}
module.exports = { verifySignature, statusUpdate, parseWebhook, handleWebhook, syncHistory, applyStatus };
