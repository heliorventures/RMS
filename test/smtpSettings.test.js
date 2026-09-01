const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildSmtpSettingsUpdate,
  sanitizeSettingsForUser
} = require('../server/utils/smtpSettings');

test('preserves the stored SMTP password when an update leaves the password blank', () => {
  const update = buildSmtpSettingsUpdate({
    host: 'smtp.gmail.com',
    port: 587,
    user: 'mailer@example.com',
    password: '   ',
    fromEmail: 'mailer@example.com',
    fromName: 'RMS Team'
  });

  assert.deepEqual(update, {
    'smtp.host': 'smtp.gmail.com',
    'smtp.port': 587,
    'smtp.user': 'mailer@example.com',
    'smtp.fromEmail': 'mailer@example.com',
    'smtp.fromName': 'RMS Team'
  });
});

test('replaces the stored SMTP password only when a new value is supplied', () => {
  const update = buildSmtpSettingsUpdate({ password: 'new-app-password' });

  assert.deepEqual(update, { 'smtp.password': 'new-app-password' });
});

test('does not expose the SMTP password in an admin settings response', () => {
  const settings = sanitizeSettingsForUser({
    company: { name: 'RMS' },
    smtp: {
      host: 'smtp.gmail.com',
      user: 'mailer@example.com',
      password: 'stored-app-password'
    }
  }, { role: 'admin' });

  assert.deepEqual(settings, {
    company: { name: 'RMS' },
    smtp: {
      host: 'smtp.gmail.com',
      user: 'mailer@example.com'
    }
  });
});
