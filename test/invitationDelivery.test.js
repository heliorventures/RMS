const test = require('node:test');
const assert = require('node:assert/strict');
const Event = require('../server/models/Event');
const controller = require('../server/controllers/deliveryController');
const store = require('../server/services/messageStore');
const createCrud = require('../server/controllers/crudFactory');

test('invitation channel, audience and uploaded files survive schema casting', () => {
  const event = new Event({ title: 'Meetup', channel: 'both', audience: 'selected',
    invitationImage: '/uploads/invitations/example.png', invitationPdf: '/uploads/invitations/example.pdf' });
  assert.equal(event.toObject().channel, 'both');
  assert.equal(event.toObject().audience, 'selected');
  assert.equal(event.invitationPdf, '/uploads/invitations/example.pdf');
});

test('a recipient without email is rejected before creating a delivery job', async t => {
  t.mock.method(store, 'getAllContacts', async () => [{ _id: 'contact-1', firstName: 'Example' }]);
  t.mock.method(store, 'getAllGroups', async () => []);
  const create = t.mock.method(store, 'createJob', async () => { throw new Error('Must not create a job'); });
  const res = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  await controller.createDeliveryJob({ body: { contactIds: ['contact-1'], channel: 'email', subject: 'Hello', body: 'Hello' } }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.message, /email/i);
  assert.equal(create.mock.callCount(), 0);
});

test('invitation validation rejects invalid maps URLs and impossible dates', async () => {
  for (const fields of [{ mapsLink: 'plain text' }, { mapsLink: 'javascript:alert(1)' }, { date: '+152133-05-08' }]) {
    const event = new Event({ title: 'Meetup', ...fields });
    assert.ok(event.validateSync(), JSON.stringify(fields));
  }
});

test('future invitations snapshot their attachment and retain a scheduled delivery', async t => {
  const fs = require('fs/promises');
  const file = '/uploads/invitations/example.pdf';
  t.mock.method(fs, 'access', async () => {});
  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000);
  t.mock.method(Event, 'findById', () => ({ lean: async () => ({ _id: 'event-1', channel: 'email', audience: 'selected',
    recipients: { contacts: ['contact-1'] }, scheduledAt, scheduleTimezone: 'Asia/Kolkata', invitationPdf: file }) }));
  const updateEvent = t.mock.method(Event, 'findByIdAndUpdate', async () => ({}));
  t.mock.method(store, 'getAllContacts', async () => [{ _id: 'contact-1', email: 'example@example.com' }]);
  t.mock.method(store, 'getAllGroups', async () => []);
  t.mock.method(store, 'createJob', async data => ({ ...data, _id: 'job-1' }));
  const insert = t.mock.method(store, 'createMessages', async rows => rows);
  t.mock.method(store, 'recountJobStats', async () => ({ total: 1, pending: 1, skipped: 0, failed: 0 }));
  t.mock.method(store, 'updateJob', async () => {});
  const res = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  await controller.createDeliveryJob({ body: { eventId: 'event-1', subject: 'Invitation', body: 'Please join us' } }, res);
  assert.equal(res.code, 201);
  const message = insert.mock.calls[0].arguments[0][0];
  assert.equal(message.status, 'scheduled');
  assert.equal(message.scheduledAt.toISOString(), scheduledAt.toISOString());
  assert.deepEqual(message.attachments, [file]);
  assert.equal(res.body.data.status, 'scheduled');
  assert.equal(updateEvent.mock.calls[0].arguments[1].status, 'scheduled');
  assert.equal(updateEvent.mock.calls[0].arguments[1].deliveryJobId, 'job-1');
});

test('stale selected recipients never fall back to all contacts', async t => {
  t.mock.method(store, 'getAllContacts', async () => [{ _id: 'unselected', email: 'other@example.com' }]);
  t.mock.method(store, 'getAllGroups', async () => []);
  const create = t.mock.method(store, 'createJob', async () => { throw new Error('No broadcast'); });
  const res = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  await controller.createDeliveryJob({ body: { contactIds: ['deleted-contact'], campaignId: 'campaign-1', subject: 'Hello', body: 'Hello' } }, res);
  assert.equal(res.code, 400);
  assert.equal(create.mock.callCount(), 0);
});

test('attachments cannot request arbitrary local files or remote URLs', () => {
  const { attachmentPath } = require('../server/utils/invitationAttachments');
  for (const path of ['../../.env', '/uploads/invitations/../../.env', 'https://example.com/file.pdf', 'C:\\secret.pdf']) assert.throws(() => attachmentPath(path), /Invalid invitation attachment/);
});

test('invitation uploads reject files whose bytes do not match their declared extension', () => {
  const { isValidInvitationFile } = require('../server/middleware/upload');
  assert.equal(isValidInvitationFile({ originalname: 'invite.pdf', buffer: Buffer.from('%PDF-1.7') }), true);
  assert.equal(isValidInvitationFile({ originalname: 'invite.png', buffer: Buffer.from('<script>alert(1)</script>') }), false);
});

test('event edits cannot overwrite delivery lifecycle fields', async t => {
  const update = t.mock.method(Event, 'findByIdAndUpdate', async (id, data) => ({ _id: id, ...data }));
  const res = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  await createCrud(Event, 'events').update({ params: { id: '507f1f77bcf86cd799439015' }, body: { title: 'Edited title', status: 'completed', deliveryStats: { email: { sent: 99 } } } }, res);
  const payload = update.mock.calls[0].arguments[1];
  assert.equal(payload.status, undefined);
  assert.equal(payload.deliveryStats, undefined);
  assert.equal(payload.title, 'Edited title');
});

test('final job outcome updates its invitation status', async t => {
  const EventModel = require('../server/models/Event');
  t.mock.method(store, 'recountJobStats', async () => ({ total: 1, skipped: 1, pending: 0, retrying: 0, failed: 0, sent: 0, delivered: 0 }));
  t.mock.method(store, 'getJob', async () => ({ _id: 'job-1', eventId: 'event-1', status: 'queued' }));
  t.mock.method(store, 'updateJob', async () => {});
  const update = t.mock.method(EventModel, 'findByIdAndUpdate', async () => ({}));
  await require('../server/services/deliveryQueue').finalizeJob('job-1');
  assert.equal(update.mock.calls[0].arguments[1].status, 'failed');
});

test('jobs with only skipped recipients finish failed, not completed', async t => {
  t.mock.method(store, 'recountJobStats', async () => ({ total: 1, skipped: 1, pending: 0, retrying: 0, failed: 0, sent: 0, delivered: 0 }));
  t.mock.method(store, 'getJob', async () => ({ _id: 'job-1', status: 'queued' }));
  const update = t.mock.method(store, 'updateJob', async () => {});
  await require('../server/services/deliveryQueue').finalizeJob('job-1');
  assert.equal(update.mock.calls[0].arguments[1].status, 'failed');
});
