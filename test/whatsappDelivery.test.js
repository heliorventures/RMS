const test = require('node:test');
const assert = require('node:assert/strict');
const Message = require('../server/models/Message');
const Contact = require('../server/models/Contact');
const provider = require('../server/services/whatsappService');
const webhook = require('../server/services/whatsappWebhook');
const { dispatchWhatsApp } = require('../server/services/whatsappDelivery');
function fixture(t, result) {
  const row = { _id: 'message', contactId: 'contact', recipient: '919876543210', status: 'pending', type: 'whatsapp', attempts: [], whatsappTemplate: { name: 'hello', language: 'en_US' } };
  t.mock.method(Message, 'findOneAndUpdate', (filter, update) => ({ lean: async () => {
    const allowed = filter.status?.$in || [filter.status];
    if (!allowed.includes(row.status)) return null;
    Object.assign(row, update.$set);
    if (update.$push?.attempts) row.attempts.push(update.$push.attempts);
    return { ...row };
  } }));
  t.mock.method(Message, 'findById', () => ({ lean: async () => ({ ...row }) }));
  t.mock.method(Contact, 'findById', () => ({ lean: async () => ({ whatsapp: '919876543210', status: 'Active' }) }));
  t.mock.method(webhook, 'syncHistory', async () => {});
  t.mock.method(provider, 'sendWhatsApp', async () => result);
  return row;
}
test('API acceptance remains sent without a delivered timestamp', async t => {
  const row = fixture(t, { success: true, status: 'sent', messageId: 'wamid.1', mode: 'whatsapp-api' });
  await dispatchWhatsApp({ ...row }, { whatsapp: { phoneNumberId: '123' } });
  assert.equal(row.status, 'sent');
  assert.equal(row.providerMessageId, 'wamid.1');
  assert.equal(row.deliveredAt, undefined);
  assert.ok(row.providerAttemptId);
});
test('an early read callback wins over the later API acceptance', async t => {
  const row = fixture(t, {});
  t.mock.method(provider, 'sendWhatsApp', async () => { row.status = 'read'; return { success: true, messageId: 'wamid.1' }; });
  await dispatchWhatsApp({ ...row }, { whatsapp: { phoneNumberId: '123' } });
  assert.equal(row.status, 'read');
});
test('permanent rejection is not retried and dry runs are skipped', async t => {
  const row = fixture(t, { success: false, retryable: false, error: 'Consent withdrawn' });
  await dispatchWhatsApp({ ...row }, { whatsapp: { phoneNumberId: '123' } });
  assert.equal(row.status, 'failed');
  row.status = 'pending';
  t.mock.method(provider, 'sendWhatsApp', async () => ({ success: true, mode: 'dry-run', status: 'skipped' }));
  await dispatchWhatsApp({ ...row }, { whatsapp: { phoneNumberId: '123' } });
  assert.equal(row.status, 'skipped');
  assert.equal(row.deliveredAt, undefined);
});
