const messageStore = require('../services/messageStore');
const { resolveRecipients, applyTemplate, channelsForJob, filterContacts } = require('../utils/recipients');
const { validateRecipient } = require('../utils/validators');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');
const { normalizeSchedule } = require('../time/schedule');
const { getProviderCapabilities } = require('../services/providerCapabilities');
const { loadMapping, renderMapping } = require('../services/whatsappTemplates');
const { normalizePhone } = require('../services/whatsappConsent');
const Event = require('../models/Event');
const { eventAttachments } = require('../utils/invitationAttachments');
const { syncEventStatus } = require('../services/invitationLifecycle');

const DEFAULT_MAX_RETRIES = Number(process.env.DELIVERY_MAX_RETRIES) || 3;
const DEFAULT_BATCH = Number(process.env.DELIVERY_BATCH_SIZE) || 25;

async function createDeliveryJob(req, res) {
  let preparingJob;
  let publishing = false;
  let previousCampaign;
  try {
    let attachments = [];
    let eventId = null;
    if (req.body.eventId) {
      const event = await Event.findById(req.body.eventId).lean();
      if (!event) return res.status(404).json({ success: false, message: 'Invitation not found.' });
      eventId = event._id;
      attachments = await eventAttachments(event);
      req.body = { ...req.body, channel: event.channel || 'email',
        contactIds: event.recipients?.contacts || [], groupIds: event.recipients?.groups || [],
        filters: { cities: event.recipients?.cities || [], sectors: event.recipients?.sectors || [] },
        audience: event.audience || 'selected', scheduledAt: event.scheduledAt?.toISOString() || null,
        scheduleTimezone: event.scheduleTimezone, campaignId: null };
    }
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

    if (!['email', 'whatsapp', 'both', 'sms'].includes(channel)) return res.status(400).json({ success: false, message: 'Unsupported delivery channel.' });
    if (!body && !subject && channel !== 'whatsapp') {
      return res.status(400).json({ success: false, message: 'Subject or body is required.' });
    }
    if (channel === 'sms') {
      return res.status(400).json({ success: false, code: 'PROVIDER_UNAVAILABLE', message: 'SMS provider is not configured' });
    }
    let whatsappMapping;
    if (['whatsapp', 'both'].includes(channel)) {
      const capabilities = getProviderCapabilities(await messageStore.getSettings());
      if (!capabilities.whatsapp.enabled) return res.status(400).json({ success: false, message: capabilities.whatsapp.reason });
      whatsappMapping = await loadMapping(req.body.templateId);
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
    if (req.body.audience === 'all') {
      finalRecipients = allContacts.filter(c => c.status !== 'Inactive');
    }
    if (!finalRecipients.length) {
      return res.status(400).json({ success: false, message: 'No recipients found for this job.' });
    }

    const channels = channelsForJob(channel);
    const preparedRecipients = finalRecipients.flatMap(contact => channels.map(ch => {
      let validation = validateRecipient(ch, contact);
      let recipient = ch === 'email' ? contact.email : (contact.whatsapp || contact.mobile);
      let whatsappTemplate;
      if (ch === 'whatsapp') {
        try { recipient = normalizePhone(recipient); whatsappTemplate = renderMapping(whatsappMapping, contact); }
        catch (error) { validation = { valid: false, reason: error.message }; }
      }
      return { contact, ch, validation, recipient, whatsappTemplate };
    }));
    if (!preparedRecipients.some(row => row.validation.valid)) {
      const reasons = [...new Set(preparedRecipients.map(row => row.validation.reason).filter(Boolean))];
      return res.status(400).json({ success: false, message: `No recipients can receive this ${channel} delivery. ${reasons.join('; ')}` });
    }
    const job = await messageStore.createJob({
      name: name || `Delivery ${new Date().toISOString()}`,
      type: eventId ? 'event' : type,
      campaignId: campaignId || null,
      eventId: eventId || null,
      channel,
      status: 'preparing',
      publicationState: 'preparing',
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

    preparingJob = job;

    const messageRows = [];
    preparedRecipients.forEach(({ contact, ch, validation, recipient, whatsappTemplate }) => {
        messageRows.push({
          jobId: job._id,
          contactId: contact._id,
          campaignId: campaignId || null,
          contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          recipient: recipient || '',
          type: ch,
          ...(whatsappTemplate ? { whatsappTemplate } : {}),
          subject: applyTemplate(subject || '', contact),
          body: applyTemplate(body || '', contact),
          attachments: ch === 'email' ? attachments : [],
          status: validation.valid ? (isFutureSchedule ? 'scheduled' : 'pending') : 'skipped',
          ...schedule,
          failureReason: validation.valid ? null : validation.reason,
          error: validation.valid ? null : validation.reason,
          retryCount: 0,
          maxRetries: job.config.maxRetries,
          attempts: validation.valid ? [] : [{ at: new Date(), status: 'skipped', error: validation.reason }]
        });
    });

    const INSERT_CHUNK = Number(process.env.DELIVERY_INSERT_CHUNK) || 1000;
    for (let i = 0; i < messageRows.length; i += INSERT_CHUNK) {
      await messageStore.createMessages(messageRows.slice(i, i + INSERT_CHUNK));
    }
    const stats = await messageStore.recountJobStats(job._id);
    const status = stats.pending > 0
      ? (isFutureSchedule ? 'scheduled' : 'queued')
      : stats.failed + stats.skipped > 0
        ? (stats.sent + stats.delivered > 0 ? 'partial' : 'failed')
        : 'completed';
    // Prepare metadata while this job is still invisible to workers.
    if (eventId) {
      const event = await Event.findByIdAndUpdate(eventId, { status, deliveryJobId: job._id }, { new: true, runValidators: true });
      if (!event) throw Object.assign(new Error('Invitation no longer exists.'), { status: 404 });
    }

    if (campaignId) {
      previousCampaign = await messageStore.prepareCampaign(campaignId, job._id, {
        status: status === 'queued' ? 'running' : status,
        stats: { total: stats.total, sent: stats.sent + stats.delivered, delivered: stats.delivered, failed: stats.failed }
      });
    }

    // Publication is the last lifecycle write by this request.
    publishing = true;
    const published = await messageStore.publishJob(job._id, { stats, status });
    if (!published) throw new Error('Delivery publication could not be confirmed.');
    logger.info('Delivery job created', { jobId: job._id, total: stats.total, channel });

    res.status(201).json({
      success: true,
      data: { ...job, publicationState: 'published', status, stats },
      message: `Queued ${preparedRecipients.filter(row => row.validation.valid).length} messages for delivery${stats.skipped ? `; ${stats.skipped} skipped (see delivery details)` : ''}`
    });
  } catch (err) {
    if (preparingJob) {
      try {
        // Never abort a job whose publication already committed.
        const aborted = await messageStore.abortJobPreparation(preparingJob._id, err.message);
        if (aborted) {
          await syncEventStatus(preparingJob, 'failed');
          if (previousCampaign) await messageStore.restoreCampaignPreparation(preparingJob, previousCampaign);
        }
        else if (publishing) {
          const current = await messageStore.getJob(preparingJob._id);
          if (current?.publicationState === 'published') {
            return res.status(201).json({ success: true, data: current, message: 'Delivery job accepted.' });
          }
        }
      } catch (recoveryError) {
        logger.error('Delivery preparation recovery failed', { jobId: preparingJob._id, error: recoveryError.message });
        if (publishing) return res.status(202).json({ success: false, code: 'PUBLICATION_UNCONFIRMED', data: preparingJob,
          message: `Publication confirmation is pending for job ${preparingJob._id}. Check Delivery Tracking before sending again.` });
      }
    }
    logger.error('Create delivery job failed', { error: err.message });
    res.status(err.status || (err.name === 'CastError' ? 400 : 500)).json({ success: false, message: err.message });
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

    if (['preparing', 'aborted'].includes(job.publicationState)) {
      return res.status(409).json({ success: false, message: 'This job was not published. Its partial recipient list cannot be retried.' });
    }
    const count = await messageStore.requeueFailedMessages(job._id);
    const stats = await messageStore.recountJobStats(job._id);
    if (count > 0) {
      await messageStore.updateJob(job._id, { status: 'queued', stats, completedAt: null });
      await syncEventStatus(job, 'queued');
    }
    else await require('../services/deliveryQueue').finalizeJob(job._id);

    logger.info('Failed messages requeued', { jobId: job._id, count });
    res.json({ success: true, data: { requeued: count, stats }, message: count ? `${count} failed messages requeued` : 'No eligible messages to retry. Uncertain WhatsApp outcomes require checking Meta logs before creating a new delivery.' });
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
