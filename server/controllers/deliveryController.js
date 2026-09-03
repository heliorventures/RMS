const messageStore = require('../services/messageStore');
const { resolveRecipients, applyTemplate, channelsForJob, filterContacts } = require('../utils/recipients');
const { validateRecipient } = require('../utils/validators');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');
const { normalizeSchedule } = require('../time/schedule');
const { getProviderCapabilities } = require('../services/providerCapabilities');

const DEFAULT_MAX_RETRIES = Number(process.env.DELIVERY_MAX_RETRIES) || 3;
const DEFAULT_BATCH = Number(process.env.DELIVERY_BATCH_SIZE) || 25;

async function createDeliveryJob(req, res) {
  try {
    const {
      name,
      type = 'bulk',
      channel = 'email',
      subject,
      body,
      contactIds = [],
      groupIds = [],
      filters,
      campaignId,
      maxRetries,
      createdBy,
      scheduledAt,
      scheduleTimezone
    } = req.body;

    if (!body && !subject) {
      return res.status(400).json({ success: false, message: 'Subject or body is required.' });
    }
    if (channel === 'sms') {
      return res.status(400).json({ success: false, code: 'PROVIDER_UNAVAILABLE', message: 'SMS provider is not configured' });
    }
    const schedule = normalizeSchedule({ scheduledAt, scheduleTimezone });
    const isFutureSchedule = schedule.scheduledAt && schedule.scheduledAt.getTime() > Date.now();

    const [allContacts, allGroups] = await Promise.all([
      messageStore.getAllContacts(),
      messageStore.getAllGroups()
    ]);

    const recipients = resolveRecipients({ contactIds, groupIds, allContacts, allGroups });
    let finalRecipients = recipients;
    if (!finalRecipients.length && filters && Object.values(filters).some(v => Array.isArray(v) && v.length)) {
      finalRecipients = filterContacts(allContacts, filters);
    }
    if (!finalRecipients.length && (req.body.audience === 'all' || campaignId)) {
      finalRecipients = allContacts.filter(c => c.status !== 'Inactive');
    }
    if (!finalRecipients.length) {
      return res.status(400).json({ success: false, message: 'No recipients found for this job.' });
    }

    const channels = channelsForJob(channel);
    const job = await messageStore.createJob({
      name: name || `Delivery ${new Date().toISOString()}`,
      type,
      campaignId: campaignId || null,
      channel,
      status: isFutureSchedule ? 'scheduled' : 'queued',
      ...schedule,
      subject: subject || '',
      body: body || '',
      stats: { total: 0, processed: 0, sent: 0, delivered: 0, failed: 0, skipped: 0, pending: 0, retrying: 0 },
      config: {
        maxRetries: maxRetries ?? DEFAULT_MAX_RETRIES,
        batchSize: DEFAULT_BATCH,
        retryDelayMs: Number(process.env.DELIVERY_RETRY_DELAY_MS) || 5000
      },
      createdBy: createdBy || req.user?.name || req.user?.email || 'Admin'
    });

    const messageRows = [];
    finalRecipients.forEach(contact => {
      channels.forEach(ch => {
        const validation = validateRecipient(ch, contact);
        const recipient = ch === 'email' ? contact.email : (contact.whatsapp || contact.mobile);
        messageRows.push({
          jobId: job._id,
          contactId: contact._id,
          campaignId: campaignId || null,
          contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          recipient: recipient || '',
          type: ch,
          subject: applyTemplate(subject || '', contact),
          body: applyTemplate(body || '', contact),
          status: validation.valid ? (isFutureSchedule ? 'scheduled' : 'pending') : 'skipped',
          ...schedule,
          failureReason: validation.valid ? null : validation.reason,
          error: validation.valid ? null : validation.reason,
          retryCount: 0,
          maxRetries: job.config.maxRetries,
          attempts: validation.valid ? [] : [{ at: new Date(), status: 'skipped', error: validation.reason }]
        });
      });
    });

    const INSERT_CHUNK = Number(process.env.DELIVERY_INSERT_CHUNK) || 1000;
    for (let i = 0; i < messageRows.length; i += INSERT_CHUNK) {
      await messageStore.createMessages(messageRows.slice(i, i + INSERT_CHUNK));
    }
    const stats = await messageStore.recountJobStats(job._id);
    await messageStore.updateJob(job._id, {
      stats,
      status: stats.pending > 0 ? (isFutureSchedule ? 'scheduled' : 'queued') : 'completed'
    });

    if (campaignId) {
      await messageStore.updateCampaign(campaignId, { status: 'running', stats: { total: stats.total, sent: 0, delivered: 0, failed: stats.failed } });
    }

    logger.info('Delivery job created', { jobId: job._id, total: stats.total, channel });

    res.status(201).json({
      success: true,
      data: { ...job, stats },
      message: `Queued ${stats.total} messages for delivery`
    });
  } catch (err) {
    logger.error('Create delivery job failed', { error: err.message });
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
}

async function getJob(req, res) {
  try {
    const job = await messageStore.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    const stats = await messageStore.recountJobStats(job._id);
    await messageStore.updateJob(job._id, { stats });
    res.json({ success: true, data: { ...job, stats } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listJobs(req, res) {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 20;
    const result = await messageStore.listJobs({ page, limit, campaignId: req.query.campaignId });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getJobMessages(req, res) {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 50;
    const status = req.query.status;
    const result = await messageStore.getJobMessages(req.params.id, { status, page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function retryFailed(req, res) {
  try {
    const job = await messageStore.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });

    const count = await messageStore.requeueFailedMessages(job._id);
    const stats = await messageStore.recountJobStats(job._id);
    await messageStore.updateJob(job._id, { status: 'queued', stats, completedAt: null });

    logger.info('Failed messages requeued', { jobId: job._id, count });
    res.json({ success: true, data: { requeued: count, stats }, message: `${count} failed messages requeued` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function testEmail(req, res) {
  try {
    const { to } = req.body;
    const settings = await messageStore.getSettings();
    const verify = await emailService.verifySmtp(settings.smtp);
    if (!verify.ok && process.env.DELIVERY_DRY_RUN !== 'true') {
      return res.status(400).json({ success: false, message: verify.error });
    }

    const result = await emailService.sendEmail({
      smtp: settings.smtp,
      to: to || settings.smtp?.fromEmail,
      subject: 'RMS Test Email',
      body: 'This is a test email from Helior RMS delivery system.',
      fromName: settings.smtp?.fromName
    });

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({ success: true, message: 'Test email sent successfully', data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getLogs(req, res) {
  try {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(__dirname, '../../logs/rms-delivery.log');
    if (!fs.existsSync(logFile)) {
      return res.json({ success: true, data: [] });
    }
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').slice(-100);
    const entries = lines.map(line => {
      try { return JSON.parse(line); } catch { return { message: line }; }
    }).reverse();
    res.json({ success: true, data: entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getCapabilities(req, res) {
  try {
    const settings = await messageStore.getSettings();
    res.json({ success: true, data: getProviderCapabilities(settings) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

const deliveryController = {
  createDeliveryJob,
  getJob,
  listJobs,
  getJobMessages,
  retryFailed,
  testEmail,
  getLogs,
  getCapabilities
};

module.exports = deliveryController;
