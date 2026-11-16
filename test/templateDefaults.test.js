const test = require('node:test');
const assert = require('node:assert/strict');
const Template = require('../server/models/Template');
const createCrud = require('../server/controllers/crudFactory');

const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('startup reconciles duplicate defaults before installing a unique partial index', async t => {
  t.mock.method(Template, 'find', () => ({ sort: () => ({ lean: async () => [
    { _id: 'new', type: 'birthday' }, { _id: 'old', type: 'birthday' }, { _id: 'festival', type: 'festival' }
  ] }) }));
  const update = t.mock.method(Template, 'updateMany', async () => ({}));
  const index = t.mock.method(Template.collection, 'createIndex', async () => 'one_default_template_per_type');
  await require('../server/services/templateDefaults').initializeTemplateDefaults();
  assert.deepEqual(update.mock.calls[0].arguments[0]._id.$in, ['old']);
  assert.deepEqual(index.mock.calls[0].arguments, [{ type: 1 }, {
    name: 'one_default_template_per_type', unique: true, partialFilterExpression: { isDefault: true }
  }]);
});

test('setting a default template demotes the existing default of the same type', async t => {
  t.mock.method(Template, 'findOne', () => ({ lean: async () => ({ _id: 'old' }) }));
  const update = t.mock.method(Template, 'updateMany', async () => ({}));
  t.mock.method(Template, 'create', async data => ({ _id: 'new', ...data }));
  const res = response();
  await createCrud(Template, 'templates').create({ body: { name: 'Birthday', body: 'Hello', type: 'birthday', isDefault: true } }, res);
  assert.equal(res.code, 201);
  assert.equal(update.mock.callCount(), 1);
  assert.equal(update.mock.calls[0].arguments[0].type, 'birthday');
  assert.equal(update.mock.calls[0].arguments[1].$set.isDefault, false);
});

test('failed template creation restores the previous default', async t => {
  t.mock.method(Template, 'findOne', () => ({ lean: async () => ({ _id: 'old' }) }));
  t.mock.method(Template, 'updateMany', async () => ({}));
  t.mock.method(Template, 'create', async () => { throw new Error('write unavailable'); });
  const restore = t.mock.method(Template, 'updateOne', async () => ({}));
  const res = response();
  await createCrud(Template, 'templates').create({ body: { name: 'New', type: 'birthday', body: 'Hello', isDefault: true } }, res);
  assert.equal(res.code, 500);
  assert.equal(restore.mock.callCount(), 1);
  assert.deepEqual(restore.mock.calls[0].arguments[0], { _id: 'old', isDefault: false });
  assert.equal(restore.mock.calls[0].arguments[1].$set.isDefault, true);
});

test('invalid default template input cannot demote a valid default', async t => {
  const update = t.mock.method(Template, 'updateMany', async () => ({}));
  const create = t.mock.method(Template, 'create', async () => ({}));
  const res = response();
  await createCrud(Template, 'templates').create({ body: { name: 'Invalid', type: 'birthday', isDefault: true } }, res);
  assert.equal(res.code, 400);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(create.mock.callCount(), 0);
});

test('template updates cannot bypass default enforcement with Mongo update operators', async t => {
  const update = t.mock.method(Template, 'findByIdAndUpdate', async () => ({}));
  const res = response();
  await createCrud(Template, 'templates').update({ params: { id: '507f1f77bcf86cd799439013' }, body: { $set: { isDefault: true } } }, res);
  assert.equal(res.code, 400);
  assert.equal(update.mock.callCount(), 0);
});
