const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSchedule, buildDueMessageFilter } = require('../server/time/schedule');

test('normalizes an ISO UTC schedule while preserving its IANA interpretation zone', () => {
  const result = normalizeSchedule({
    scheduledAt: '2026-10-01T04:30:00.000Z',
    scheduleTimezone: 'Asia/Kolkata'
  });

  assert.equal(result.scheduledAt.toISOString(), '2026-10-01T04:30:00.000Z');
  assert.equal(result.scheduleTimezone, 'Asia/Kolkata');
});

test('rejects a schedule without an explicit UTC offset or valid IANA timezone', () => {
  assert.throws(
    () => normalizeSchedule({ scheduledAt: '2026-10-01T10:00', scheduleTimezone: 'Asia/Kolkata' }),
    /ISO UTC instant/
  );
  assert.throws(
    () => normalizeSchedule({ scheduledAt: '2026-10-01T04:30:00.000Z', scheduleTimezone: 'Mars\/Base' }),
    /IANA timezone/
  );
});

test('due-message filter excludes future schedules', () => {
  const now = new Date('2026-10-01T04:00:00.000Z');
  assert.deepEqual(buildDueMessageFilter(now), {
    status: { $in: ['pending', 'scheduled'] },
    $and: [
      { $or: [{ scheduledAt: null }, { scheduledAt: { $lte: now } }] },
      { $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: now } }] }
    ]
  });
});
