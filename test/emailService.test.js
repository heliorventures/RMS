const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildSmtpTransportOptions,
  buildCacheKey
} = require('../server/services/emailService');

function withSmtpTlsMode(mode, callback) {
  const original = process.env.SMTP_TLS_MODE;
  if (mode === undefined) delete process.env.SMTP_TLS_MODE;
  else process.env.SMTP_TLS_MODE = mode;

  try {
    callback();
  } finally {
    if (original === undefined) delete process.env.SMTP_TLS_MODE;
    else process.env.SMTP_TLS_MODE = original;
  }
}

test('uses STARTTLS on port 587 even when legacy settings mark it secure', () => {
  withSmtpTlsMode('auto', () => {
    const options = buildSmtpTransportOptions({
      host: 'smtp.example.com',
      port: 587,
      user: 'mailer@example.com',
      password: 'secret',
      secure: true
    });

    assert.equal(options.port, 587);
    assert.equal(options.secure, false);
    assert.equal(options.requireTLS, true);
  });
});

test('uses implicit TLS on port 465', () => {
  withSmtpTlsMode('auto', () => {
    const options = buildSmtpTransportOptions({
      host: 'smtp.example.com',
      port: 465,
      user: 'mailer@example.com',
      password: 'secret'
    });

    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.equal(options.requireTLS, false);
  });
});

test('defaults an omitted SMTP port to STARTTLS on port 587', () => {
  withSmtpTlsMode('auto', () => {
    const options = buildSmtpTransportOptions({
      host: 'smtp.example.com',
      user: 'mailer@example.com',
      password: 'secret'
    });

    assert.equal(options.port, 587);
    assert.equal(options.secure, false);
    assert.equal(options.requireTLS, true);
  });
});

test('can force STARTTLS on port 465 through SMTP_TLS_MODE', () => {
  withSmtpTlsMode('starttls', () => {
    const options = buildSmtpTransportOptions({
      host: 'smtp.example.com',
      port: 465,
      user: 'mailer@example.com',
      password: 'secret'
    });

    assert.equal(options.secure, false);
    assert.equal(options.requireTLS, true);
  });
});

test('can force implicit TLS on port 587 through SMTP_TLS_MODE', () => {
  withSmtpTlsMode('implicit', () => {
    const options = buildSmtpTransportOptions({
      host: 'smtp.example.com',
      port: 587,
      user: 'mailer@example.com',
      password: 'secret'
    });

    assert.equal(options.secure, true);
    assert.equal(options.requireTLS, false);
  });
});

test('rejects an unsupported SMTP_TLS_MODE', () => {
  withSmtpTlsMode('disabled', () => {
    assert.throws(
      () => buildSmtpTransportOptions({ host: 'smtp.example.com', user: 'mailer@example.com' }),
      /SMTP_TLS_MODE must be one of: auto, starttls, implicit/
    );
  });
});

test('changes the transport cache key when the SMTP password changes', () => {
  const base = {
    host: 'smtp.example.com',
    port: 587,
    user: 'mailer@example.com',
    fromEmail: 'mailer@example.com',
    password: 'old-secret'
  };

  assert.notEqual(
    buildCacheKey(base),
    buildCacheKey({ ...base, password: 'new-secret' })
  );
});
