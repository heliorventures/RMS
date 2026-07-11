const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporterCache = null;
let cacheKey = null;

function isDryRun() {
  return process.env.DELIVERY_DRY_RUN === 'true';
}

function buildCacheKey(smtp) {
  return `${smtp.host}:${smtp.port}:${smtp.user}:${smtp.fromEmail}`;
}

async function getTransporter(smtp) {
  if (isDryRun()) return null;
  if (!smtp?.host || !smtp?.user) return null;

  const key = buildCacheKey(smtp);
  if (transporterCache && cacheKey === key) return transporterCache;

  transporterCache = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port) || 587,
    secure: smtp.secure === true || smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.password || smtp.pass || '' },
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS) || 5,
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES) || 100
  });

  cacheKey = key;
  return transporterCache;
}

async function verifySmtp(smtp) {
  if (isDryRun()) return { ok: true, mode: 'dry-run' };
  const transporter = await getTransporter(smtp);
  if (!transporter) return { ok: false, error: 'SMTP is not configured. Set host, user, and password in Settings.' };
  try {
    await transporter.verify();
    return { ok: true, mode: 'smtp' };
  } catch (err) {
    logger.error('SMTP verification failed', { error: err.message });
    return { ok: false, error: err.message };
  }
}

async function sendEmail({ smtp, to, subject, body, fromName }) {
  if (isDryRun()) {
    logger.info('DRY RUN email', { to, subject });
    return { success: true, messageId: `dry-${Date.now()}`, mode: 'dry-run' };
  }

  const transporter = await getTransporter(smtp);
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }

  const from = fromName
    ? `"${fromName}" <${smtp.fromEmail || smtp.user}>`
    : (smtp.fromEmail || smtp.user);

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: subject || 'Message from RMS',
      text: body,
      html: body.replace(/\n/g, '<br>')
    });
    logger.info('Email sent', { to, messageId: info.messageId });
    return { success: true, messageId: info.messageId, mode: 'smtp' };
  } catch (err) {
    logger.error('Email send failed', { to, error: err.message });
    return { success: false, error: err.message };
  }
}

function resetTransporter() {
  transporterCache = null;
  cacheKey = null;
}

module.exports = { sendEmail, verifySmtp, isDryRun, resetTransporter };
