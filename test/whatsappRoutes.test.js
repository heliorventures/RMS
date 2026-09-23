const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const store = require('../server/services/messageStore');
const queue = require('../server/services/deliveryQueue');
const delivery = require('../server/controllers/deliveryController');

test('webhook challenge and raw-body signature are enforced through the HTTP route', async t => {
  const saved = [process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN, process.env.WHATSAPP_APP_SECRET, process.env.SETTINGS_ENCRYPTION_KEYS];
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-test'; process.env.WHATSAPP_APP_SECRET = 'secret-test';
  process.env.SETTINGS_ENCRYPTION_KEYS = `webhook-test:${Buffer.alloc(32, 7).toString('base64')}`;
  t.after(() => ['WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'SETTINGS_ENCRYPTION_KEYS'].forEach((key, i) => { if (saved[i] === undefined) delete process.env[key]; else process.env[key] = saved[i]; }));
  const cipher = require('../server/security/secretCipher').getSecretCipher();
  t.mock.method(store, 'getSettings', async () => ({ whatsapp: { appSecret: cipher.encrypt('saved-secret'), webhookVerifyToken: cipher.encrypt('saved-verify') } }));
  const app = express(); app.use('/webhook', require('../server/routes/whatsappWebhook')); app.use(express.json());
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/webhook`;
  assert.equal((await fetch(`${base}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123`)).status, 403);
  assert.equal((await fetch(`${base}?hub.mode=subscribe&hub.verify_token=verify-test&hub.challenge=123`)).status, 403);
  assert.equal(await (await fetch(`${base}?hub.mode=subscribe&hub.verify_token=saved-verify&hub.challenge=123`)).text(), '123');
  const body = '{ "object": "whatsapp_business_account", "entry": [] }';
  const signature = `sha256=${crypto.createHmac('sha256', 'saved-secret').update(body).digest('hex')}`;
  assert.equal((await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature }, body })).status, 200);
  assert.equal((await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature }, body: '{}' })).status, 401);
});
test('non-admin cannot verify provider credentials, test-send, or change consent', async t => {
  const saved = process.env.JWT_SECRET; process.env.JWT_SECRET = 'route-test-secret';
  t.after(() => { if (saved === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = saved; });
  const app = express(); app.use(express.json());
  app.use('/delivery', require('../server/routes/delivery')); app.use('/contacts', require('../server/routes/contacts'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ role: 'user', id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET);
  for (const [method, path] of [['POST', '/delivery/test-whatsapp'], ['POST', '/delivery/verify-whatsapp'], ['PUT', '/contacts/507f1f77bcf86cd799439011/whatsapp-consent']]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 403);
  }
});
test('retry with only uncertain outcomes preserves terminal job state', async t => {
  t.mock.method(store, 'getJob', async () => ({ _id: 'job', status: 'failed' }));
  t.mock.method(store, 'requeueFailedMessages', async () => 0);
  t.mock.method(store, 'recountJobStats', async () => ({ failed: 1, pending: 0 }));
  let update;
  t.mock.method(store, 'updateJob', async (_, value) => { update = value; });
  let finalized = false;
  t.mock.method(queue, 'finalizeJob', async () => { finalized = true; });
  let body;
  await delivery.retryFailed({ params: { id: 'job' } }, { json: value => { body = value; }, status() { return this; } });
  assert.equal(update, undefined);
  assert.equal(finalized, true);
  assert.equal(body.data.requeued, 0);
});
