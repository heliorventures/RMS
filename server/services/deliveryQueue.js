const logger = require('../utils/logger');
const messageStore = require('./messageStore');
const emailService = require('./emailService');
const whatsappService = require('./whatsappService');
const { validateEmail, validatePhone } = require('../utils/validators');
const { applyTemplate } = require('../utils/recipients');

const POLL_MS = Number(process.env.DELIVERY_POLL_MS) || 2000;
const DEFAULT_BATCH = Number(process.env.DELIVERY_BATCH_SIZE) || 25;
const DEFAULT_MAX_RETRIES = Number(process.env.DELIVERY_MAX_RETRIES) || 3;
const DEFAULT_RETRY_DELAY = Number(process.env.DELIVERY_RETRY_DELAY_MS) || 5000;

let running = false;
let timer = null;
let processing = false;

function retryDelayMs(retryCount, baseDelay) {
  return baseDelay * Math.pow(2, Math.max(0, retryCount - 1));
}

async function processMessage(message, settings, job) {
  const maxRetries = message.maxRetries ?? job?.config?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = job?.config?.retryDelayMs ?? DEFAULT_RETRY_DELAY;
  const contactName = message.contactName || 'Contact';

  const validation = message.type === 'email'
    ? validateEmail(message.recipient)
    : validatePhone(message.recipient);

  if (!validation.valid) {
    const attempts = [...(message.attempts || []), { at: new Date(), status: 'skipped', error: validation.reason }];
    await messageStore.updateMessage(message._id, {
      status: 'skipped',
      failureReason: validation.reason,
      error: validation.reason,
      attempts,
      sentAt: new Date()
    });
    logger.warn('Recipient skipped', { messageId: message._id, reason: validation.reason });
    return { outcome: 'skipped' };
  }

  await messageStore.updateMessage(message._id, { status: 'processing' });

  let result;
  if (message.type === 'email') {
    result = await emailService.sendEmail({
      smtp: settings.smtp,
      to: validation.value,
      subject: message.subject,
      body: message.body,
      fromName: settings.smtp?.fromName
    });
  } else if (message.type === 'whatsapp') {
    result = await whatsappService.sendWhatsApp({
      settings,
      to: validation.value,
      body: message.body
    });
  } else {
    result = { success: false, error: 'SMS channel not yet implemented' };
  }

  const attempt = {
    at: new Date(),
    status: result.success ? 'sent' : 'failed',
    error: result.error || null
  };
  const attempts = [...(message.attempts || []), attempt];

  if (result.success) {
    await messageStore.updateMessage(message._id, {
      status: 'delivered',
      sentAt: new Date(),
      deliveredAt: new Date(),
      error: null,
      failureReason: null,
      attempts
    });
    await messageStore.addCommHistory({
      contactId: message.contactId,
      contactName,
      type: message.type,
      subject: message.subject,
      message: (message.body || '').substring(0, 500),
      status: 'delivered',
      sentBy: job?.createdBy || 'RMS System',
      sentAt: new Date()
    });
    logger.info('Message delivered', { messageId: message._id, type: message.type, recipient: message.recipient });
    return { outcome: 'delivered' };
  }

  const nextRetry = (message.retryCount || 0) + 1;
  if (nextRetry < maxRetries) {
    const nextRetryAt = new Date(Date.now() + retryDelayMs(nextRetry, baseDelay));
    await messageStore.updateMessage(message._id, {
      status: 'pending',
      retryCount: nextRetry,
      nextRetryAt,
      error: result.error,
      failureReason: result.error,
      attempts
    });
    logger.warn('Message failed — scheduled retry', {
      messageId: message._id,
      retry: nextRetry,
      maxRetries,
      nextRetryAt,
      error: result.error
    });
    return { outcome: 'retry' };
  }

  await messageStore.updateMessage(message._id, {
    status: 'failed',
    retryCount: nextRetry,
    error: result.error,
    failureReason: result.error,
    sentAt: new Date(),
    attempts
  });
  await messageStore.addCommHistory({
    contactId: message.contactId,
    contactName,
    type: message.type,
    subject: message.subject,
    message: (message.body || '').substring(0, 500),
    status: 'failed',
    sentBy: job?.createdBy || 'RMS System',
    sentAt: new Date()
  });
  logger.error('Message failed permanently', { messageId: message._id, error: result.error });
  return { outcome: 'failed' };
}

async function finalizeJob(jobId) {
  const stats = await messageStore.recountJobStats(jobId);
  const job = await messageStore.getJob(jobId);
  if (!job) return;

  let status = job.status;
  if (stats.pending > 0 || stats.retrying > 0) {
    status = 'processing';
  } else if (stats.failed > 0 && stats.delivered + stats.sent + stats.skipped > 0) {
    status = 'partial';
  } else if (stats.failed > 0 && stats.delivered === 0 && stats.sent === 0) {
    status = 'failed';
  } else {
    status = 'completed';
  }

  const updates = {
    stats,
    status,
    completedAt: ['completed', 'partial', 'failed'].includes(status) ? new Date() : job.completedAt
  };

  await messageStore.updateJob(jobId, updates);

  if (job.campaignId) {
    await messageStore.updateCampaign(job.campaignId, {
      status: status === 'completed' ? 'completed' : status === 'processing' ? 'running' : status,
      stats: {
        total: stats.total,
        sent: stats.sent + stats.delivered,
        delivered: stats.delivered,
        failed: stats.failed
      }
    });
  }
}

async function processBatch() {
  if (processing) return;
  processing = true;

  try {
    const settings = await messageStore.getSettings();
    const batchSize = DEFAULT_BATCH;
    const pending = await messageStore.getPendingMessages(batchSize);
    if (!pending.length) return;

    const jobIds = [...new Set(pending.map(m => String(m.jobId)).filter(Boolean))];
    const jobs = {};
    for (const jid of jobIds) {
      jobs[jid] = await messageStore.getJob(jid);
      if (jobs[jid] && ['queued', 'scheduled'].includes(jobs[jid].status)) {
        await messageStore.updateJob(jid, { status: 'processing', startedAt: new Date() });
      }
    }

    for (const message of pending) {
      const job = jobs[String(message.jobId)];
      await processMessage(message, settings, job);
    }

    for (const jid of jobIds) {
      await finalizeJob(jid);
    }
  } catch (err) {
    logger.error('Delivery batch error', { error: err.message, stack: err.stack });
  } finally {
    processing = false;
  }
}

function startDeliveryWorker() {
  if (running) return;
  running = true;
  logger.info('Delivery worker started', {
    pollMs: POLL_MS,
    batchSize: DEFAULT_BATCH,
    maxRetries: DEFAULT_MAX_RETRIES,
    dryRun: process.env.DELIVERY_DRY_RUN === 'true'
  });
  timer = setInterval(processBatch, POLL_MS);
  processBatch();
}

function stopDeliveryWorker() {
  if (timer) clearInterval(timer);
  running = false;
  timer = null;
}

module.exports = { startDeliveryWorker, stopDeliveryWorker, processBatch };
