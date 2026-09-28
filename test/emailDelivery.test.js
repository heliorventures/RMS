const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../server/services/messageStore');
const email = require('../server/services/emailService');
const whatsapp = require('../server/services/whatsappDelivery');
const { processBatch } = require('../server/services/deliveryQueue');

async function deliver(t, providerResult) {
  const message = { _id: 'message-1', jobId: 'job-1', type: 'email', recipient: 'test@example.com', status: 'pending', attempts: [] };
  t.mock.method(whatsapp, 'recoverInterruptedWhatsApp', async () => {});
  t.mock.method(store, 'getSettings', async () => ({ smtp: {} }));
  t.mock.method(store, 'getPendingMessages', async () => [message]);
  t.mock.method(store, 'getJob', async () => ({ _id: 'job-1', status: 'queued' }));
  t.mock.method(store, 'updateJob', async () => {});
  t.mock.method(store, 'updateMessage', async (id, changes) => Object.assign(message, changes));
  const history = t.mock.method(store, 'addCommHistory', async () => {});
  t.mock.method(store, 'recountJobStats', async () => ({ total: 1, sent: message.status === 'sent' ? 1 : 0, delivered: 0, skipped: message.status === 'skipped' ? 1 : 0, failed: 0, pending: 0, retrying: 0 }));
  t.mock.method(email, 'sendEmail', async () => providerResult);
  await processBatch();
  return { message, history };
}

test('SMTP acceptance records sent without inventing recipient delivery confirmation', async t => {
  const { message, history } = await deliver(t, { success: true, mode: 'smtp', messageId: 'smtp-1' });
  assert.equal(message.status, 'sent');
  assert.equal(message.deliveredAt, null);
  assert.equal(message.providerMessageId, 'smtp-1');
  assert.equal(history.mock.calls[0].arguments[0].status, 'sent');
});

test('email dry runs are explicit skips with no sent timestamp or communication entry', async t => {
  const { message, history } = await deliver(t, { success: true, mode: 'dry-run' });
  assert.equal(message.status, 'skipped');
  assert.match(message.failureReason, /no email was sent/i);
  assert.equal(message.sentAt, undefined);
  assert.equal(history.mock.callCount(), 0);
});
