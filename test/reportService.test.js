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
