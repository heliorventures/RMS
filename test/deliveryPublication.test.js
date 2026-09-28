const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../server/services/messageStore');
const controller = require('../server/controllers/deliveryController');
const Event = require('../server/models/Event');
const createCrud = require('../server/controllers/crudFactory');

function response() { return { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }

test('event update operators and dotted keys never reach MongoDB', async t => {
  const update = t.mock.method(Event, 'findByIdAndUpdate', async () => ({}));
  for (const body of [{ $set: { status: 'completed' } }, { $unset: { deliveryJobId: 1 } }, { 'deliveryStats.email.sent': 99 }]) {
    const res = response();
    await createCrud(Event, 'events').update({ params: { id: 'event-1' }, body }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(update.mock.callCount(), 0);
});

function fixture(t) {
  let job;
  const messages = [];
  t.mock.method(store, 'getAllContacts', async () => [{ _id: 'contact-1', email: 'a@example.com' }]);
  t.mock.method(store, 'getAllGroups', async () => []);
  t.mock.method(store, 'createJob', async data => (job = { ...data, _id: 'job-1' }));
  t.mock.method(store, 'getJob', async () => job);
  t.mock.method(store, 'updateJob', async (id, data) => Object.assign(job, data));
  t.mock.method(store, 'createMessages', async rows => { messages.push(...rows); });
  t.mock.method(store, 'recountJobStats', async () => ({ total: messages.length, pending: messages.length, skipped: 0, failed: 0, sent: 0, delivered: 0 }));
  return { job: () => job, messages, req: { body: { contactIds: ['contact-1'], subject: 'Hello', body: 'Hello' } } };
}

test('an insertion failure never publishes the partially inserted job', async t => {
  const f = fixture(t);
  const publish = t.mock.method(store, 'publishJob', async () => { throw new Error('Must not publish'); });
  const abort = t.mock.method(store, 'abortJobPreparation', async () => { f.job().publicationState = 'aborted'; });
  t.mock.method(store, 'createMessages', async rows => {
    f.messages.push(rows[0]);
    assert.equal(f.job().publicationState, 'preparing');
    throw new Error('insertion failed');
  });
  const res = response();
  await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 500);
  assert.equal(publish.mock.callCount(), 0);
  assert.equal(abort.mock.callCount(), 1);
  assert.equal(f.job().publicationState, 'aborted');
});

test('worker completion after publication cannot be overwritten by the request', async t => {
  const f = fixture(t);
  t.mock.method(store, 'publishJob', async (id, updates) => {
    assert.equal(f.messages.length, 1);
    Object.assign(f.job(), updates, { publicationState: 'published' });
    const published = { ...f.job() };
    f.job().status = 'completed';
    return published;
  });
  const res = response();
  await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 201);
  assert.equal(f.job().status, 'completed');
});

test('a lost publication acknowledgement does not abort a committed delivery', async t => {
  const f = fixture(t);
  t.mock.method(store, 'publishJob', async (id, updates) => {
    Object.assign(f.job(), updates, { publicationState: 'published' });
    throw new Error('acknowledgement lost');
  });
  t.mock.method(store, 'abortJobPreparation', async () => {
    assert.equal(f.job().publicationState, 'published');
    return null;
  });
  const res = response();
  await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 201);
  assert.equal(f.job().publicationState, 'published');
});

test('an older delivery cannot replace a newer invitation job', async t => {
  const event = { _id: 'event-1', deliveryJobId: 'new-job', status: 'scheduled' };
  t.mock.method(Event, 'findOneAndUpdate', async (filter, update) => {
    if (filter._id !== event._id || filter.deliveryJobId !== event.deliveryJobId) return null;
    Object.assign(event, update.$set);
    return event;
  });
  const { syncEventStatus } = require('../server/services/invitationLifecycle');
  await syncEventStatus({ _id: 'old-job', eventId: event._id }, 'completed');
  assert.equal(event.deliveryJobId, 'new-job');
  assert.equal(event.status, 'scheduled');
  await syncEventStatus({ _id: 'new-job', eventId: event._id }, 'processing');
  assert.equal(event.status, 'processing');
});

test('worker candidate query excludes unpublished jobs before applying batch limit', async t => {
  const Message = require('../server/models/Message');
  const aggregate = t.mock.method(Message, 'aggregate', async () => []);
  await store.getPendingMessages(25);
  const pipeline = aggregate.mock.calls[0].arguments[0];
  const gate = pipeline.findIndex(stage => stage.$match?.['deliveryJob.publicationState']);
  assert.ok(gate > 0);
  assert.ok(gate < pipeline.findIndex(stage => stage.$limit));
  assert.deepEqual(pipeline[gate].$match['deliveryJob.publicationState'], { $nin: ['preparing', 'aborted'] });
  assert.deepEqual(pipeline[gate].$match['deliveryJob.0'], { $exists: true });
});

test('confirmed publication failure restores campaign state through its owning job', async t => {
  const f = fixture(t);
  f.req.body.campaignId = 'campaign-1';
  const previous = { status: 'draft', stats: { total: 0 } };
  t.mock.method(store, 'prepareCampaign', async () => previous);
  t.mock.method(store, 'publishJob', async () => { throw new Error('publication failed'); });
  t.mock.method(store, 'abortJobPreparation', async () => ({ ...f.job(), publicationState: 'aborted' }));
  const restore = t.mock.method(store, 'restoreCampaignPreparation', async () => previous);
  const res = response();
  await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 500);
  assert.equal(restore.mock.callCount(), 1);
  assert.equal(restore.mock.calls[0].arguments[0]._id, 'job-1');
  assert.equal(restore.mock.calls[0].arguments[1], previous);
});

test('campaign rollback cannot overwrite a newer campaign delivery', async t => {
  const Campaign = require('../server/models/Campaign');
  const current = { _id: 'campaign-1', deliveryJobId: 'new-job', status: 'running' };
  t.mock.method(Campaign, 'findOneAndUpdate', (filter, updates) => ({ lean: async () => {
    if (filter.deliveryJobId !== current.deliveryJobId) return null;
    Object.assign(current, updates.$set);
    return current;
  } }));
  await store.restoreCampaignPreparation({ _id: 'old-job', campaignId: current._id }, { status: 'draft' });
  assert.equal(current.status, 'running');
  assert.equal(current.deliveryJobId, 'new-job');
});

test('overlapping campaign preparations cannot snapshot an unfinished or aborted owner', async t => {
  const Campaign = require('../server/models/Campaign');
  const DeliveryJob = require('../server/models/DeliveryJob');
  t.mock.method(Campaign, 'findById', () => ({ lean: async () => ({ _id: 'campaign-1', deliveryJobId: 'job-A', status: 'running' }) }));
  let publicationState = 'preparing';
  t.mock.method(DeliveryJob, 'findById', () => ({ lean: async () => ({ _id: 'job-A', publicationState }) }));
  const write = t.mock.method(Campaign, 'findOneAndUpdate', () => { throw new Error('Must not snapshot A'); });
  await assert.rejects(store.prepareCampaign('campaign-1', 'job-B', { status: 'running' }), { status: 409 });
  publicationState = 'aborted';
  await assert.rejects(store.prepareCampaign('campaign-1', 'job-B', { status: 'running' }), { status: 409 });
  assert.equal(write.mock.callCount(), 0);
});
