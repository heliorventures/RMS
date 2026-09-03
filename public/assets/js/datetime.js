window.RMS = window.RMS || {};

window.RMS.datetime = {
  browserTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  },

  fromLocalInput(value) {
    const scheduleTimezone = this.browserTimezone();
    if (!value) return { scheduledAt: null, scheduleTimezone };
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) throw new Error('Enter a valid schedule date and time.');
    return { scheduledAt: instant.toISOString(), scheduleTimezone };
  },

  toLocalInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = number => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  format(value, timezone) {
    if (!value) return '';
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || this.browserTimezone()
    }).format(new Date(value));
  }
};
