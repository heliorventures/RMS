const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

test('chart categories each receive their own visible color beyond the initial palette', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync('public/assets/js/utils.js', 'utf8'), context);
  const colors = context.window.RMS.utils.chartColors(15);
  assert.equal(colors.length, 15);
  assert.equal(new Set(colors).size, 15);
  assert.deepEqual(Array.from(context.window.RMS.utils.chartColors(0)), []);
});
