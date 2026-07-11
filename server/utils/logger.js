const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'rms-delivery.log');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function formatEntry(level, message, meta = {}) {
  return JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...meta
  });
}

function write(level, message, meta) {
  const line = formatEntry(level, message, meta);
  if (process.env.NODE_ENV !== 'production') {
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`[${level.toUpperCase()}] ${message}`, meta && Object.keys(meta).length ? meta : '');
  }
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
  } catch (err) {
    console.error('Logger write failed:', err.message);
  }
}

module.exports = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
      write('debug', message, meta);
    }
  }
};
