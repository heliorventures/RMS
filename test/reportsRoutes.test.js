const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const Contact = require('../server/models/Contact');
const Campaign = require('../server/models/Campaign');
const Message = require('../server/models/Message');
process.env.JWT_SECRET = 'test-only-report-route-secret-at-least-32-characters';
const router = require('../server/routes/misc');

test('report URLs used by the UI reach authenticated report handlers', async t => {
  for (const model of [Contact, Campaign, Message]) {
    t.mock.method(model, 'countDocuments', async () => 2);
    t.mock.method(model, 'aggregate', async () => []);
  }
  t.mock.method(Message, 'find', () => {
    const query = { sort: () => query, skip: () => query, limit: () => query, lean: async () => [] };
    return query;
  });
  const app = express(); app.use('/api', router);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const token = jwt.sign({ id: '507f1f77bcf86cd799439011', role: 'user' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  for (const report of ['contacts', 'birthdays', 'campaigns', 'delivery']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reports/${report}`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200, report);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.data.total, 'number');
  }
});
