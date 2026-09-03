const nodemailer = require('nodemailer');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { getSecretCipher } = require('../security/secretCipher');

let transporterCache = null;
let cacheKey = null;

function resolveStoredSecret(value) {
  if (typeof value === 'string' || value == null) return value || '';
  return getSecretCipher().decrypt(value);
}

function isDryRun() {
  return process.env.DELIVERY_DRY_RUN === 'true';
}

function resolveSmtpPort(port) {
  const normalizedPort = Number(port);
  return Number.isInteger(normalizedPort) && normalizedPort > 0 && normalizedPort <= 65535
    ? normalizedPort
    : 587;
}

function resolveSmtpTlsMode() {
  const mode = (process.env.SMTP_TLS_MODE || 'auto').trim().toLowerCase();
  if (!['auto', 'starttls', 'implicit'].includes(mode)) {
    throw new Error('SMTP_TLS_MODE must be one of: auto, starttls, implicit');
  }
  return mode;
}

function buildCacheKey(smtp) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      host: smtp?.host || '',
      port: resolveSmtpPort(smtp?.port),
      user: smtp?.user || '',
      password: resolveStoredSecret(smtp?.password || smtp?.pass),
      tlsMode: resolveSmtpTlsMode()
    }))
    .digest('hex');
}

function buildSmtpTransportOptions(smtp) {
  const port = resolveSmtpPort(smtp?.port);
  const tlsMode = resolveSmtpTlsMode();
  const secure = tlsMode === 'implicit' || (tlsMode === 'auto' && port === 465);

  return {
    host: smtp.host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user: smtp.user, pass: resolveStoredSecret(smtp.password || smtp.pass) },
    pool: true,
    maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS) || 5,
    maxMessages: Number(process.env.SMTP_MAX_MESSAGES) || 100
  };
}

function closeTransporter() {
  if (transporterCache && typeof transporterCache.close === 'function') {
    transporterCache.close();
  }
  transporterCache = null;
  cacheKey = null;
}

async function getTransporter(smtp) {
  if (isDryRun()) return null;
  if (!smtp?.host || !smtp?.user) return null;

  const key = buildCacheKey(smtp);
  if (transporterCache && cacheKey === key) return transporterCache;

  closeTransporter();
  transporterCache = nodemailer.createTransport(buildSmtpTransportOptions(smtp));

  cacheKey = key;
  return transporterCache;
}

async function verifySmtp(smtp) {
  if (isDryRun()) return { ok: true, mode: 'dry-run' };
  try {
    const transporter = await getTransporter(smtp);
    if (!transporter) return { ok: false, error: 'SMTP is not configured. Set host, user, and password in Settings.' };
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

  try {
    const transporter = await getTransporter(smtp);
    if (!transporter) {
      return { success: false, error: 'SMTP not configured' };
    }

    const from = fromName
      ? `"${fromName}" <${smtp.fromEmail || smtp.user}>`
      : (smtp.fromEmail || smtp.user);

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
  closeTransporter();
}

module.exports = {
  sendEmail,
  verifySmtp,
  isDryRun,
  resetTransporter,
  buildCacheKey,
  buildSmtpTransportOptions,
  resolveSmtpTlsMode
};
