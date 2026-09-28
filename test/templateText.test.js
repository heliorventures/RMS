const test = require('node:test');
const assert = require('node:assert/strict');
const render = require('../public/assets/js/templateText');

test('optional address placeholders do not leave separators or blank lines', () => {
  assert.equal(render('{{Name}}\n{{Company}}\n{{City}}, {{State}} {{Pincode}}', { Name: 'Example', City: 'Pune' }), 'Example\nPune');
  assert.equal(render('{{City}}, {{State}}', { State: 'Maharashtra' }), 'Maharashtra');
  assert.equal(render('{{City}}, {{State}}', {}), '');
});

test('punctuation and spacing in populated prose are preserved', () => {
  assert.equal(render('Dear {{Name}},\nHappy birthday!\nOffice: {{City}}, {{State}}', { Name: 'Example', City: 'Pune', State: 'Maharashtra' }), 'Dear Example,\nHappy birthday!\nOffice: Pune, Maharashtra');
});
