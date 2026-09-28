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
