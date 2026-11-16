const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSchedule } = require('../server/time/schedule');
const controller = require('../server/controllers/deliveryController');
const Campaign = require('../server/models/Campaign');
const store = require('../server/services/messageStore');
const prepareCampaign = store.prepareCampaign;
const { finalizeJob } = require('../server/services/deliveryQueue');
function response() { return { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }

function fixture(t, overrides = {}) {
  const campaign = { _id: 'campaign-1', name: 'Birthday', type: 'birthday', channel: 'email', content: 'Best wishes {{Name}}', status: 'draft', audience: 'all', scheduledAt: new Date('2099-09-01T04:30:00Z'), scheduleTimezone: 'Asia/Kolkata', ...overrides };
  const messages = [];
  t.mock.method(Campaign, 'findById', () => ({ lean: async () => campaign }));
  t.mock.method(store, 'getAllContacts', async () => [{ _id: 'a', firstName: 'A', email: 'a@example.com', dob: '1990-09-01T00:00:00Z', city: 'Pune' }, { _id: 'b', email: 'b@example.com', dob: '1991-09-02T00:00:00Z', city: 'Pune' }, { _id: 'c', dob: '1992-09-01T00:00:00Z', city: 'Mumbai' }]);
  t.mock.method(store, 'getAllGroups', async () => [{ _id: 'group-1', members: ['a', 'b', 'c'] }]);
  const create = t.mock.method(store, 'createJob', async data => ({ ...data, _id: 'job-1' }));
  t.mock.method(store, 'createMessages', async rows => messages.push(...rows));
  t.mock.method(store, 'recountJobStats', async () => ({ total: messages.length, pending: messages.filter(m => m.status === 'scheduled' || m.status === 'pending').length, skipped: messages.filter(m => m.status === 'skipped').length, sent: 0, delivered: 0, failed: 0 }));
  const prepare = t.mock.method(store, 'prepareCampaign', async () => campaign);
  t.mock.method(store, 'publishJob', async (id, data) => data);
  return { campaign, messages, create, prepare, req: { body: { type: 'campaign', campaignId: campaign._id, audience: 'all', subject: 'Override', body: 'Override' } } };
}

test('campaign delivery derives schedule and birthday audience from the saved campaign', async t => {
  const f = fixture(t);
  const res = response();
  await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.status, 'scheduled');
  assert.equal(f.create.mock.calls[0].arguments[0].scheduledAt.toISOString(), '2099-09-01T04:30:00.000Z');
  assert.deepEqual(f.messages.map(m => m.contactId), ['a', 'c']);
  assert.equal(f.messages[0].body, 'Best wishes A');
  assert.equal(f.messages[1].status, 'skipped');
  assert.match(f.messages[1].failureReason, /email/i);
  assert.equal(f.prepare.mock.calls[0].arguments[2].stats.skipped, 1);
});

test('selected campaign group and filters intersect instead of silently widening the audience', async t => {
  const f = fixture(t, { type: 'email', audience: 'selected', recipients: { contacts: [], groups: ['group-1'], filters: { cities: ['Pune'] } } });
  const res = response(); await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 201);
  assert.deepEqual(f.messages.map(m => m.contactId), ['a', 'b']);
});

for (const [name, fields, error] of [
  ['empty audience', { audience: 'selected', recipients: {} }, /Select at least one contact, group or filter/i],
  ['blank content', { content: '  ' }, /content is required/i],
  ['missing schedule', { scheduledAt: null }, /future schedule/i],
  ['past schedule', { scheduledAt: new Date('2020-09-01T10:00:00Z') }, /future schedule/i]
]) test(`campaign rejects ${name} before creating any job`, async t => {
  const f = fixture(t, fields); const res = response();
  await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 400); assert.match(res.body.message, error); assert.equal(f.create.mock.callCount(), 0);
});

test('schedule rejects years outside the supported four digit business range', () => {
  assert.throws(() => normalizeSchedule({ scheduledAt: '0001-09-01T10:00:00Z', scheduleTimezone: 'UTC' }), /year/i);
});

test('completed campaign exposes skipped rows without inventing email delivery receipts', async t => {
  t.mock.method(store, 'recountJobStats', async () => ({ total: 2, sent: 1, delivered: 0, failed: 0, skipped: 1, pending: 0, retrying: 0 }));
  t.mock.method(store, 'getJob', async () => ({ _id: 'job-1', campaignId: 'campaign-1', status: 'processing' }));
  t.mock.method(store, 'updateJob', async () => {});
  const update = t.mock.method(store, 'updateCampaign', async () => {});
  await finalizeJob('job-1');
  assert.equal(update.mock.calls[0].arguments[1].status, 'partial');
  assert.deepEqual(update.mock.calls[0].arguments[1].stats, { total: 2, sent: 1, delivered: 0, failed: 0, skipped: 1 });
});

test('campaign filter values must be lists before any delivery write', async t => {
  const f = fixture(t, { type: 'email', recipients: { filters: { cities: 'Pune' } } });
  const res = response(); await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 400);
  assert.match(res.body.message, /filter.*list/i);
  assert.equal(f.create.mock.callCount(), 0);
});

test('birthday audience uses the saved timezone day at the UTC date boundary', async t => {
  const f = fixture(t, { scheduledAt: new Date('2099-08-31T20:00:00Z') });
  const res = response(); await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 201);
  assert.deepEqual(f.messages.map(m => m.contactId), ['a', 'c']);
});

test('a published campaign delivery cannot be admitted a second time', async t => {
  const current = { _id: 'campaign-1', status: 'scheduled', deliveryJobId: 'published-job' };
  t.mock.method(Campaign, 'findById', () => ({ lean: async () => current }));
  t.mock.method(store, 'getJob', async () => ({ _id: 'published-job', publicationState: 'published' }));
  const Job = require('../server/models/DeliveryJob');
  t.mock.method(Job, 'findById', () => ({ lean: async () => ({ _id: 'published-job', publicationState: 'published' }) }));
  const write = t.mock.method(Campaign, 'findOneAndUpdate', () => ({ lean: async () => ({ ...current }) }));
  await assert.rejects(store.prepareCampaign(current._id, 'duplicate-job', { status: 'scheduled' }), { status: 409 });
  assert.equal(write.mock.callCount(), 0);
});

test('campaign admission atomically rejects a competing publication after its initial draft read', async t => {
  const current = { _id: 'campaign-1', status: 'draft', deliveryJobId: null };
  t.mock.method(Campaign, 'findById', () => ({ lean: async () => ({ ...current }) }));
  t.mock.method(Campaign, 'findOneAndUpdate', (filter, update) => ({ lean: async () => {
    // A competing request has now published its job, after this request's read.
    Object.assign(current, { status: 'scheduled', deliveryJobId: 'published-job' });
    if (filter.status !== current.status || String(filter.deliveryJobId || '') !== String(current.deliveryJobId || '')) return null;
    const previous = { ...current }; Object.assign(current, update.$set); return previous;
  } }));
  await assert.rejects(store.prepareCampaign(current._id, 'duplicate-job', { status: 'scheduled' }), { status: 409 });
  assert.equal(current.deliveryJobId, 'published-job');
});

test('a second request with a stale initial draft read aborts instead of publishing another campaign job', async t => {
  const f = fixture(t, { type: 'email' });
  let reads = 0;
  t.mock.method(Campaign, 'findById', () => ({ lean: async () => ++reads === 1 ? { ...f.campaign } : { ...f.campaign, status: 'scheduled', deliveryJobId: 'published-job' } }));
  t.mock.method(store, 'prepareCampaign', prepareCampaign);
  t.mock.method(require('../server/models/DeliveryJob'), 'findById', () => ({ lean: async () => ({ _id: 'published-job', publicationState: 'published' }) }));
  t.mock.method(Campaign, 'findOneAndUpdate', () => ({ lean: async () => ({ ...f.campaign, status: 'scheduled', deliveryJobId: 'published-job' }) }));
  const abort = t.mock.method(store, 'abortJobPreparation', async () => ({ _id: 'job-1', publicationState: 'aborted' }));
  const publish = t.mock.method(store, 'publishJob', async () => ({}));
  const res = response(); await controller.createDeliveryJob(f.req, res);
  assert.equal(res.code, 409);
  assert.equal(publish.mock.callCount(), 0);
  assert.equal(abort.mock.callCount(), 1);
});
