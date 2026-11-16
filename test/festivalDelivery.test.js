const test = require('node:test');
const assert = require('node:assert/strict');
const Festival = require('../server/models/Festival');
const store = require('../server/services/messageStore');
const controller = require('../server/controllers/deliveryController');
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('retrying an already published festival returns its existing job without sending again', async t => {
  t.mock.method(Festival, 'findById', () => ({ lean: async () => ({ _id: 'festival-1', status: 'scheduled', deliveryJobId: 'existing' }) }));
  t.mock.method(store, 'getJob', async () => ({ _id: 'existing', festivalId: 'festival-1', publicationState: 'published', status: 'scheduled' }));
  const create = t.mock.method(store, 'createJob', async () => { throw new Error('Duplicate delivery'); });
  const res = response();
  await controller.createDeliveryJob({ body: { festivalId: 'festival-1' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.data._id, 'existing');
  assert.equal(create.mock.callCount(), 0);
});

test('a festival job uses the saved future schedule, channel and audience', async t => {
  const festival = { _id: 'festival-1', name: 'Celebration', message: 'Wishes {{Name}}', status: 'draft', channel: 'email', religion: 'Hindu', scheduledAt: new Date('2099-11-16T04:30:00Z'), scheduleTimezone: 'Asia/Kolkata', updatedAt: new Date(), recipients: { cities: ['Pune'] } };
  t.mock.method(Festival, 'findById', () => ({ lean: async () => festival }));
  const claim = t.mock.method(Festival, 'findOneAndUpdate', () => ({ lean: async () => festival }));
  t.mock.method(store, 'getAllContacts', async () => [{ _id: 'a', firstName: 'A', email: 'a@example.com', city: 'Pune', religion: 'Hindu' }, { _id: 'b', email: 'b@example.com', city: 'Delhi', religion: 'Hindu' }]);
  t.mock.method(store, 'getAllGroups', async () => []);
  const create = t.mock.method(store, 'createJob', async data => ({ ...data, _id: 'job-1' }));
  const rows = t.mock.method(store, 'createMessages', async () => {});
  t.mock.method(store, 'recountJobStats', async () => ({ total: 1, pending: 1, skipped: 0, failed: 0, sent: 0, delivered: 0 }));
  t.mock.method(store, 'publishJob', async (id, data) => ({ _id: id, ...data }));
  const res = response();
  await controller.createDeliveryJob({ body: { festivalId: 'festival-1', channel: 'both', audience: 'all' } }, res);
  assert.equal(res.code, 201);
  assert.equal(create.mock.calls[0].arguments[0].festivalId, 'festival-1');
  assert.equal(create.mock.calls[0].arguments[0].channel, 'email');
  assert.equal(rows.mock.calls[0].arguments[0][0].status, 'scheduled');
  assert.equal(rows.mock.calls[0].arguments[0].length, 1);
  assert.deepEqual(claim.mock.calls[0].arguments[0].$or, [{ status: { $ne: 'scheduled' } }, { deliveryJobId: null }]);
  assert.equal(claim.mock.calls[0].arguments[0].updatedAt, festival.updatedAt);
});

test('concurrent festival preparation cannot publish a second delivery', async t => {
  const { prepareFestival } = require('../server/services/festivalLifecycle');
  let claimed = false;
  t.mock.method(Festival, 'findOneAndUpdate', filter => ({ lean: async () => {
    assert.equal(filter.deliveryJobId, null);
    if (claimed) return null;
    claimed = true;
    return { _id: 'festival-1', status: 'draft' };
  } }));
  const festival = { _id: 'festival-1', status: 'draft' };
  await prepareFestival(festival, { _id: 'first' }, 'scheduled');
  await assert.rejects(prepareFestival(festival, { _id: 'second' }, 'scheduled'), /already queued/i);
});

test('festival completion only updates its own delivery and records sent count', async t => {
  const update = t.mock.method(Festival, 'findOneAndUpdate', async () => ({}));
  await require('../server/services/festivalLifecycle').syncFestivalStatus({ _id: 'job-1', festivalId: 'festival-1' }, 'completed', { sent: 2, delivered: 1 });
  assert.deepEqual(update.mock.calls[0].arguments[0], { _id: 'festival-1', deliveryJobId: 'job-1' });
  assert.equal(update.mock.calls[0].arguments[1].$set.status, 'sent');
  assert.equal(update.mock.calls[0].arguments[1].$set.sentCount, 3);
});

test('festival edits cannot change a live schedule or forge delivery status', async t => {
  const update = t.mock.method(Festival, 'findOneAndUpdate', async () => null);
  const res = response();
  await require('../server/controllers/festivalController').update({ params: { id: 'festival-1' }, body: { name: 'Edited', status: 'sent', deliveryJobId: null } }, res);
  assert.equal(res.code, 409);
  const [filter, payload] = update.mock.calls[0].arguments;
  assert.deepEqual(filter.$or, [{ status: { $ne: 'scheduled' } }, { deliveryJobId: null }]);
  assert.equal(payload.$set.deliveryJobId, undefined);
  assert.equal(payload.$set.status, 'draft');
});

test('festival retry locks editing before messages become eligible again', async t => {
  let locked = false;
  const job = { _id: 'job-1', festivalId: 'festival-1', status: 'partial', publicationState: 'published' };
  t.mock.method(store, 'getJob', async () => job);
  t.mock.method(Festival, 'findOneAndUpdate', () => {
    locked = true;
    return { lean: async () => ({ _id: 'festival-1', deliveryJobId: 'job-1', status: 'sent' }) };
  });
  t.mock.method(store, 'requeueFailedMessages', async () => { assert.equal(locked, true); return 1; });
  t.mock.method(store, 'recountJobStats', async () => ({ total: 2, pending: 1, sent: 1 }));
  t.mock.method(store, 'updateJob', async () => ({}));
  const res = response();
  await controller.retryFailed({ params: { id: 'job-1' } }, res);
  assert.equal(res.code, undefined);
  assert.equal(res.body.success, true);
});
