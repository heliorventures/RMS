const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('filter refresh preserves all selected cities including saved legacy values', () => {
  class Option { constructor(text, value) { this.text = text; this.value = value; this.selected = false; } }
  const context = { module: { exports: {} }, Option };
  vm.runInNewContext(fs.readFileSync('public/assets/js/contactData.js', 'utf8'), context);
  const select = {
    multiple: true, options: [],
    get selectedOptions() { return this.options.filter(option => option.selected); },
    get value() { return this.selectedOptions[0]?.value || ''; },
    set value(value) { this.options.forEach(option => { option.selected = option.value === value; }); },
    replaceChildren() { this.options = []; },
    add(option) { this.options.push(option); }
  };
  for (const city of ['Pune', 'Mumbai', 'Legacy']) { const option = new Option(city, city); option.selected = true; select.add(option); }
  context.module.exports.populateFilter(select, ['Pune', 'Mumbai', 'Delhi']);
  assert.deepEqual(select.selectedOptions.map(option => option.value), ['Pune', 'Mumbai', 'Legacy']);
});
