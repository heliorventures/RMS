const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareContacts, parseCSV } = require('../server/utils/contactImport');

test('Excel date and dropdown variants survive import without losing phone prefixes', () => {
  const { valid, errors } = prepareContacts([{
    firstName: 'Example', lastName: 'Contact', gender: 'female', status: 'Vip',
    city: 'pune', sector: 'government', religion: 'hindu',
    dob: '15-03-1985', anniversary: '20/06/2010', mobile: '919876543210'
  }]);
  assert.deepEqual(errors, []);
  assert.equal(valid[0].dob, '1985-03-15T00:00:00.000Z');
  assert.equal(valid[0].anniversary, '2010-06-20T00:00:00.000Z');
  assert.equal(valid[0].mobile, '+919876543210');
  assert.equal(valid[0].status, 'VIP');
  assert.equal(valid[0].gender, 'Female');
  assert.equal(valid[0].city, 'Pune');
});

test('invalid import values produce row and field errors instead of silent skips', () => {
  for (const fields of [{ dob: '31-02-2020' }, { status: 'unknown' }, { gender: 'unknown' },
    { email: 'testmail' }, { mobile: 'testmobile' }, { dob: '152133-05-08' }]) {
    const result = prepareContacts([{ firstName: 'Example', lastName: 'Contact', ...fields }]);
    assert.equal(result.valid.length, 0);
    assert.equal(result.errors[0].row, 2);
    assert.ok(result.errors[0].message.length);
  }
});

test('CSV supports quoted multiline notes and excludes empty rows', () => {
  const rows = parseCSV('First Name,Last Name,Notes\r\nExample,Contact,"Line one\nLine two"\r\n,,\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].notes, 'Line one\nLine two');
  assert.deepEqual(parseCSV('First Name,Last Name\n,\n'), []);
});

test('invalid configured city, sector and religion are rejected with their row numbers', () => {
  for (const field of ['city', 'sector', 'religion']) {
    const result = prepareContacts([{ firstName: 'Example', lastName: 'Contact', [field]: 'Not a configured value' }]);
    assert.equal(result.valid.length, 0, field);
    assert.equal(result.errors[0].row, 2);
    assert.match(result.errors[0].message, new RegExp(field));
  }
});

test('phone imports retain explicit international prefixes and reject spreadsheet formulas', () => {
  for (const phone of ['+91 98765 43210', '00919876543210', "'919876543210", '919876543210']) {
    const result = prepareContacts(parseCSV(`First Name,Last Name,Mobile\nExample,Contact,${phone}\n`));
    assert.deepEqual(result.errors, []);
    assert.equal(result.valid[0].mobile, '+919876543210');
  }
  const formula = prepareContacts([{ firstName: 'Example', lastName: 'Contact', mobile: '=919876543210' }]);
  assert.equal(formula.valid.length, 0);
});

test('downloaded CSV template keeps phone examples as spreadsheet text before import', () => {
  const template = require('node:fs').readFileSync(require('node:path').join(__dirname, '../public/assets/templates/contacts-import-template.csv'), 'utf8');
  const rows = parseCSV(template);
  for (const row of rows) {
    assert.match(row.mobile, /^'\+/, 'Phone examples must not be Excel numeric formulas');
    assert.match(row.whatsapp, /^'\+/);
  }
  const result = prepareContacts(rows);
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid[0].mobile, '+919876543210');
  const rounded = prepareContacts([{ firstName: 'Example', lastName: 'Contact', mobile: '9.19877E+11' }]);
  assert.equal(rounded.valid.length, 0, 'Rounded spreadsheet notation cannot establish the original digits');
});
