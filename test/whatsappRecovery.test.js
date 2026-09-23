const test = require('node:test');
const assert = require('node:assert/strict');
const Consent = require('../server/models/WhatsAppConsent');
const { recordConsent } = require('../server/services/whatsappConsent');
const Message = require('../server/models/Message');
const History = require('../server/models/CommunicationHistory');
const webhook = require('../server/services/whatsappWebhook');
const queue = require('../server/services/deliveryQueue');
const { recoverInterruptedWhatsApp } = require('../server/services/whatsappDelivery');
test('same-second STOP wins over a grant, while old replay cannot revoke newer consent', async t => {
  const row = { status: 'granted', changedAt: new Date('2026-01-01T12:00:00.500Z') };
  t.mock.method(Consent, 'updateOne', async (filter, update) => {
    const match = filter.changedAt?.$lt ? row.changedAt < filter.changedAt.$lt : filter.$or?.some(f => f.changedAt.$lt ? row.changedAt < f.changedAt.$lt : row.changedAt.getTime() === f.changedAt.getTime() && row.status === f.status);
    if (match) Object.assign(row, update.$set);
  });
  t.mock.method(Consent, 'findOne', () => ({ lean: async () => row }));
  await recordConsent({ phone: '919876543210', status: 'withdrawn', source: 'STOP', at: new Date('2026-01-01T12:00:00Z') });
  assert.equal(row.status, 'withdrawn');
  row.status = 'granted'; row.changedAt = new Date('2026-01-01T12:00:00.999Z');
  await recordConsent({ phone: '919876543210', status: 'withdrawn', source: 'STOP', at: new Date('2026-01-01T12:00:00Z') });
  assert.equal(row.status, 'withdrawn');
  await recordConsent({ phone: '919876543210', status: 'granted', source: 'new signed permission', at: new Date('2026-01-01T12:00:02Z') });
  await recordConsent({ phone: '919876543210', status: 'withdrawn', source: 'STOP', at: new Date('2026-01-01T12:00:00Z') });
  assert.equal(row.status, 'granted');
});
test('a newer send attempt can replace failed history with sent', async t => {
  let updateFilter;
  t.mock.method(History, 'updateOne', async (filter, update) => { if (update.$set) updateFilter = filter; });
  await webhook.syncHistory({ _id: 'm', providerAttemptNumber: 2, status: 'sent' });
  assert.deepEqual(updateFilter.$or[0], { providerAttemptNumber: { $lt: 2 } });
});
test('interrupted recovery reconciles terminal jobs even without pending work', async t => {
  const recovered = { _id: 'm', jobId: 'job', status: 'failed', providerAttemptId: 'attempt' };
  t.mock.method(Message, 'find', () => ({ lean: async () => [recovered] }));
  t.mock.method(Message, 'findOneAndUpdate', () => ({ lean: async () => recovered }));
  t.mock.method(Message, 'updateMany', async () => ({}));
  const histories = [], jobs = [];
  t.mock.method(webhook, 'syncHistory', async m => histories.push(m._id));
  t.mock.method(queue, 'finalizeJob', async id => jobs.push(id));
  await recoverInterruptedWhatsApp();
  assert.deepEqual(histories, ['m']);
  assert.deepEqual(jobs, ['job']);
});
