const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { verifySignature, statusUpdate, parseWebhook } = require('../server/services/whatsappWebhook');
test('authenticates exact raw bytes and rejects altered, absent or malformed signatures', () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  const signature = `sha256=${crypto.createHmac('sha256', 'app-secret').update(body).digest('hex')}`;
  assert.equal(verifySignature(body, signature, 'app-secret'), true);
  assert.equal(verifySignature(Buffer.from('{}'), signature, 'app-secret'), false);
  for (const s of [undefined, 'sha256=a', signature]) assert.equal(verifySignature(body, s, ''), false);
});
test('status transitions cannot regress read/delivered on reordered or duplicate events', () => {
  assert.equal(statusUpdate('read', 'delivered', new Date()), null);
  assert.equal(statusUpdate('delivered', 'failed', new Date()), null);
  assert.equal(statusUpdate('sent', 'sent', new Date()), null);
  assert.equal(statusUpdate('processing', 'read', new Date('2026-09-17')).status, 'read');
  assert.equal(statusUpdate('failed', 'delivered', new Date()).status, 'delivered');
  assert.equal(statusUpdate('sent', 'unknown', new Date()), null);
});
test('signed callbacks resolve an uncertain failure without weakening confirmed failures', () => {
  assert.equal(statusUpdate('failed', 'sent', new Date(), true)?.status, 'sent');
  assert.equal(statusUpdate('failed', 'failed', new Date(), true)?.outcomeUncertain, false);
  assert.equal(statusUpdate('failed', 'sent', new Date(), false), null);
});
test('accepts only configured account/sender events and recognizes STOP without auto-consenting START', (t) => {
  t.mock.method(Date, 'now', () => 1789600100000);
  const payload = { object: 'whatsapp_business_account', entry: [{ id: '987', changes: [{ field: 'messages', value: { metadata: { phone_number_id: '123' }, statuses: [{ id: 'wamid.1', status: 'read', timestamp: '1789600000', recipient_id: '919876543210' }], messages: [{ from: '919876543210', timestamp: '1789600000', type: 'text', text: { body: ' STOP ' } }, { from: '919876543211', type: 'text', text: { body: 'START' } }] } }] }] };
  const events = parseWebhook(payload, { phoneNumberId: '123', businessAccountId: '987' });
  assert.equal(events.statuses.length, 1);
  assert.equal(events.optOuts.length, 1);
  assert.equal(parseWebhook(payload, { phoneNumberId: '456', businessAccountId: '987' }).statuses.length, 0);
  assert.equal(parseWebhook(payload, { phoneNumberId: '123', businessAccountId: '999' }).optOuts.length, 0);
});
