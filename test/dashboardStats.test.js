const test = require('node:test');
const assert = require('node:assert/strict');
const Contact = require('../server/models/Contact');
const Message = require('../server/models/Message');
const Campaign = require('../server/models/Campaign');
const Event = require('../server/models/Event');
const CommunicationHistory = require('../server/models/CommunicationHistory');
const Notification = require('../server/models/Notification');
const controller = require('../server/controllers/dashboardController');

function query() { const result = { sort: () => result, limit: () => result, lean: async () => [] }; return result; }

async function stats(t, baseline) {
  const messageFilters = [];
  t.mock.method(Contact, 'countDocuments', async filter => {
    if (filter?.createdAt?.$lt) return baseline;
    if (filter?.createdAt?.$gte) return 5;
    return filter ? 0 : baseline + 5;
  });
  t.mock.method(Contact, 'aggregate', async () => []);
  t.mock.method(Message, 'aggregate', async () => []);
  t.mock.method(Message, 'countDocuments', async filter => { messageFilters.push(filter); return 0; });
  t.mock.method(Campaign, 'countDocuments', async () => 0);
  t.mock.method(Event, 'countDocuments', async () => 0);
  for (const model of [Contact, CommunicationHistory, Notification]) t.mock.method(model, 'find', query);
  let response;
  await controller.getStats({}, { json: body => { response = body; }, status: () => { throw Error('Unexpected controller failure'); } });
  return { response, messageFilters };
}

test('dashboard Sent Today excludes skipped, failed, queued and undated messages', async t => {
  const { messageFilters } = await stats(t, 20);
  const today = messageFilters[0];
  assert.deepEqual(today.status, { $in: ['sent', 'delivered', 'read'] });
  assert.ok(today.sentAt.$gte instanceof Date);
  assert.ok(today.sentAt.$lt > today.sentAt.$gte);
  assert.equal(today.$or, undefined);
});

test('contact monthly growth comes from stored contact creation dates and prior baseline', async t => {
  const { response } = await stats(t, 20);
  assert.deepEqual(response.data.stats.contactGrowth, { addedThisMonth: 5, baseline: 20, percent: 25 });
});

test('first month growth has no fabricated percentage when there is no baseline', async t => {
  const { response } = await stats(t, 0);
  assert.deepEqual(response.data.stats.contactGrowth, { addedThisMonth: 5, baseline: 0, percent: null });
});
