const test = require('node:test');
const assert = require('node:assert/strict');
const Contact = require('../server/models/Contact');
const controller = require('../server/controllers/contactController');

test('filter options combine configured choices with every persisted distinct value', async t => {
  t.mock.method(Contact, 'distinct', async field => ({ city: ['Chennai', '', null, 'Pune'], sector: ['Education'], religion: ['Buddhist'] })[field]);
  let body;
  await controller.getFilterOptions({}, { json(value) { body = value; }, status() { return this; } });
  assert.equal(body.success, true);
  assert.ok(body.data.city.includes('Pune'));
  assert.ok(body.data.city.includes('Chennai'));
  assert.ok(body.data.sector.includes('Education'));
  assert.ok(body.data.religion.includes('Buddhist'));
  assert.equal(body.data.city.filter(value => value === 'Pune').length, 1);
  assert.ok(body.data.city.every(value => typeof value === 'string' && value));
});
