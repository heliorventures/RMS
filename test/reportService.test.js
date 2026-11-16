const test = require('node:test');
const assert = require('node:assert/strict');
const { getMonthlyChannelSeries } = require('../server/services/reportService');

test('returns exact monthly message totals for every supported channel', async () => {
  const Message = {
    aggregate: async () => [
      { _id: { month: '2026-08', channel: 'email' }, count: 3 },
      { _id: { month: '2026-09', channel: 'email' }, count: 12 },
      { _id: { month: '2026-09', channel: 'whatsapp' }, count: 4 }
    ]
  };

  const result = await getMonthlyChannelSeries(Message);

  assert.deepEqual(result, [
    { month: '2026-08', email: 3, whatsapp: 0, sms: 0 },
    { month: '2026-09', email: 12, whatsapp: 4, sms: 0 }
  ]);
});

test('monthly totals count confirmed sends at their send date, never queued or skipped creation dates', async () => {
  let pipeline;
  await getMonthlyChannelSeries({ aggregate: async stages => { pipeline = stages; return []; } });
  assert.deepEqual(pipeline[0].$match.status, { $in: ['sent', 'delivered', 'read'] });
  assert.deepEqual(pipeline[0].$match.sentAt, { $type: 'date' });
  assert.equal(JSON.stringify(pipeline).includes('$createdAt'), false);
});

test('monthly series includes zero activity between recorded send months across years', async () => {
  const result = await getMonthlyChannelSeries({ aggregate: async () => [
    { _id: { month: '2025-12', channel: 'sms' }, count: 2 },
    { _id: { month: '2026-02', channel: 'email' }, count: 3 }
  ] });
  assert.deepEqual(result, [
    { month: '2025-12', email: 0, whatsapp: 0, sms: 2 },
    { month: '2026-01', email: 0, whatsapp: 0, sms: 0 },
    { month: '2026-02', email: 3, whatsapp: 0, sms: 0 }
  ]);
});
