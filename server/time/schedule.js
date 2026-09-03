class ScheduleValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScheduleValidationError';
    this.status = 400;
  }
}

function isIanaTimezone(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function normalizeSchedule({ scheduledAt, scheduleTimezone } = {}) {
  if (!scheduledAt) return { scheduledAt: null, scheduleTimezone: null };
  if (typeof scheduledAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(scheduledAt)) {
    throw new ScheduleValidationError('scheduledAt must be an ISO UTC instant ending in Z.');
  }
  const instant = new Date(scheduledAt);
  if (Number.isNaN(instant.getTime())) throw new ScheduleValidationError('scheduledAt must be a valid ISO UTC instant.');
  if (!isIanaTimezone(scheduleTimezone)) throw new ScheduleValidationError('scheduleTimezone must be a valid IANA timezone.');
  return { scheduledAt: instant, scheduleTimezone };
}

function buildDueMessageFilter(now = new Date()) {
  return {
    status: { $in: ['pending', 'scheduled'] },
    $and: [
      { $or: [{ scheduledAt: null }, { scheduledAt: { $lte: now } }] },
      { $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }] }
    ]
  };
}

module.exports = { normalizeSchedule, buildDueMessageFilter, ScheduleValidationError };
