const test = require('node:test');
const assert = require('node:assert/strict');
const { renderMapping } = require('../server/services/whatsappTemplates');
test('renders positional values from a contact without mutating the saved template', () => {
  const mapping = { name: 'greeting', language: 'en_US', bodyParameters: ['{{Name}}', '{{City}}'] };
  assert.deepEqual(renderMapping(mapping, { firstName: 'Asha', lastName: 'Patil', city: 'Pune' }).bodyParameters, ['Asha Patil', 'Pune']);
  assert.equal(mapping.bodyParameters[0], '{{Name}}');
});
test('rejects unresolved or missing WhatsApp parameter data instead of sending incomplete text', () => {
  const mapping = { name: 'greeting', language: 'en_US', bodyParameters: ['Event: {{EventTitle}}'] };
  assert.throws(() => renderMapping(mapping, {}), /unsupported|Unsupported/);
  assert.throws(() => renderMapping({ ...mapping, bodyParameters: ['{{City}}'] }, {}), /nonempty/);
});
