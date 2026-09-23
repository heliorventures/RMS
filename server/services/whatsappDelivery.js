const { randomUUID } = require('node:crypto');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const provider = require('./whatsappService');
const webhook = require('./whatsappWebhook');
const { normalizePhone } = require('./whatsappConsent');
const { buildDueMessageFilter } = require('../time/schedule');

async function dispatchWhatsApp(message, settings, job) {
  const attemptId = randomUUID();
  const claimed = await Message.findOneAndUpdate({ ...buildDueMessageFilter(new Date()), _id: message._id }, {
    $set: { status: 'processing', providerAttemptId: attemptId, providerPhoneNumberId: settings.whatsapp?.phoneNumberId, providerMessageId: null, outcomeUncertain: false },
    $inc: { providerAttemptNumber: 1 }
  }, { new: true }).lean();
  if (!claimed) return { outcome: 'already-claimed' };
  let result;
  try {
    const contact = await Contact.findById(message.contactId).lean();
    if (!contact || contact.status === 'Inactive' || normalizePhone(contact.whatsapp || contact.mobile) !== message.recipient) {
      result = { success: false, retryable: false, error: 'Contact is inactive, removed, or its WhatsApp number changed. Create a new delivery after review.' };
    } else {
      result = await provider.sendWhatsApp({ settings, to: message.recipient, template: message.whatsappTemplate, callbackData: attemptId });
    }
  } catch { result = { success: false, retryable: false, error: 'Unable to validate the contact. Review before retrying.' }; }
  const now = new Date();
  const count = (message.retryCount || 0) + 1;
  const retry = !result.success && result.retryable === true && count < (message.maxRetries ?? job?.config?.maxRetries ?? 3);
  const status = result.success ? (result.mode === 'dry-run' ? 'skipped' : 'sent') : (retry ? 'pending' : 'failed');
  const error = result.mode === 'dry-run' ? 'Dry run: no WhatsApp message sent.' : result.error || null;
  const update = { status, error, failureReason: error, outcomeUncertain: Boolean(result.uncertain),
    ...(result.messageId ? { providerMessageId: result.messageId } : {}),
    ...(status === 'sent' ? { sentAt: now } : {}),
    ...(!result.success ? { retryCount: count } : {}),
    nextRetryAt: retry ? new Date(now.getTime() + (job?.config?.retryDelayMs || 5000) * 2 ** (count - 1)) : null };
  // A signed callback can arrive before POST /messages returns. Never overwrite it.
  await Message.findOneAndUpdate({ _id: message._id, providerAttemptId: attemptId, status: 'processing' }, {
    $set: update, $push: { attempts: { at: now, status, error } }
  }, { new: true }).lean();
  const current = await Message.findById(message._id).lean();
  await webhook.syncHistory(current);
  return { outcome: current?.status || status };
}

// A process may die after submitting to Meta. Do not automatically submit again.
async function recoverInterruptedWhatsApp() {
  const filter = { type: 'whatsapp', status: 'processing', updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } };
  const stale = await Message.find(filter).lean();
  const jobs = new Set();
  for (const message of stale) {
    const recovered = await Message.findOneAndUpdate({ ...filter, _id: message._id, providerAttemptId: message.providerAttemptId }, {
      $set: { status: 'failed', outcomeUncertain: true, error: 'Interrupted WhatsApp send; check Meta logs before retrying.', failureReason: 'Interrupted WhatsApp send; check Meta logs before retrying.' }
    }, { new: true }).lean();
    if (recovered) { await webhook.syncHistory(recovered); if (recovered.jobId) jobs.add(String(recovered.jobId)); }
  }
  for (const id of jobs) await require('./deliveryQueue').finalizeJob(id);
}
module.exports = { dispatchWhatsApp, recoverInterruptedWhatsApp };
