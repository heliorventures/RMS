const test = require('node:test');
const assert = require('node:assert/strict');
const Campaign = require('../server/models/Campaign');
const controller = require('../server/controllers/campaignController');
function response() { return { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }

test('campaign create validates schedule before persistence and protects lifecycle fields', async t => {
  const create = t.mock.method(Campaign, 'create', async data => ({ ...data, _id: 'campaign-1' }));
  for (const scheduledAt of ['2026-02-31T10:00:00Z', '0001-09-01T10:00:00Z', '2026-09-01T10:00']) {
    const res = response();
    await controller.create({ body: { name: 'Invalid', scheduledAt, scheduleTimezone: 'UTC' } }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(create.mock.callCount(), 0);
  const res = response();
  await controller.create({ body: { name: 'Draft', type: 'email', status: 'completed', stats: { delivered: 99 }, deliveryJobId: 'forged', scheduledAt: '2099-09-01T10:00:00Z', scheduleTimezone: 'UTC', audience: 'selected' } }, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.status, 'draft');
  assert.equal(res.body.data.stats, undefined);
  assert.equal(res.body.data.deliveryJobId, undefined);
  assert.ok(res.body.data.scheduledAt instanceof Date);
});

test('campaign edits atomically target drafts and reject MongoDB update operators', async t => {
  const update = t.mock.method(Campaign, 'findOneAndUpdate', async () => null);
  const res = response();
  await controller.update({ params: { id: 'campaign-1' }, body: { name: 'Edited', status: 'draft' } }, res);
  assert.equal(res.code, 409);
  assert.deepEqual(update.mock.calls[0].arguments[0], { _id: 'campaign-1', status: 'draft' });
  assert.deepEqual(update.mock.calls[0].arguments[1], { $set: { name: 'Edited' } });
  for (const body of [{ $set: { status: 'completed' } }, { 'stats.delivered': 99 }]) {
    const invalid = response(); await controller.update({ params: { id: 'campaign-1' }, body }, invalid);
    assert.equal(invalid.code, 400);
  }
  assert.equal(update.mock.callCount(), 1);
});
