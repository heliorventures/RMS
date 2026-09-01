const SMTP_FIELDS = ['host', 'port', 'user', 'password', 'fromEmail', 'fromName'];

function buildSmtpSettingsUpdate(smtp) {
  const update = {};
  if (!smtp || typeof smtp !== 'object') return update;

  for (const field of SMTP_FIELDS) {
    if (!Object.hasOwn(smtp, field)) continue;

    const value = smtp[field];
    if (field === 'password' && (typeof value !== 'string' || value.trim() === '')) {
      continue;
    }

    update[`smtp.${field}`] = value;
  }

  return update;
}

function sanitizeSettingsForUser(settings, user) {
  const plainSettings = settings?.toObject ? settings.toObject() : settings;
  if (user?.role === 'admin') {
    if (!plainSettings?.smtp) return plainSettings;
    const { password, ...smtp } = plainSettings.smtp;
    return { ...plainSettings, smtp };
  }

  return {
    company: plainSettings?.company,
    labels: plainSettings?.labels,
    theme: plainSettings?.theme ? {
      primaryColor: plainSettings.theme.primaryColor,
      darkMode: plainSettings.theme.darkMode
    } : undefined
  };
}

module.exports = { buildSmtpSettingsUpdate, sanitizeSettingsForUser };
