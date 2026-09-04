const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'public', 'dist');

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

test('asset build produces hashed local application and vendor assets with LF encoding', () => {
  execFileSync(process.execPath, ['scripts/build-assets.mjs'], { cwd: root, stdio: 'pipe' });
  const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8'));

  for (const asset of [
    '/assets/js/pages/contacts.js',
    '/assets/vendor/bootstrap/bootstrap.min.css',
    '/assets/vendor/bootstrap-icons/bootstrap-icons.min.css',
    '/assets/vendor/chart/chart.umd.js',
    '/assets/vendor/datatables/dataTables.bootstrap5.min.js',
    '/assets/vendor/html2pdf/html2pdf.bundle.min.js'
  ]) {
    assert.match(manifest[asset], /^\/dist\/.+\.[a-f0-9]{12}\./);
    assert.ok(existsSync(path.join(root, 'public', manifest[asset])));
  }

  for (const file of filesUnder(dist)) {
    const bytes = readFileSync(file);
    assert.notDeepEqual(bytes.subarray(0, 3), Buffer.from([0xef, 0xbb, 0xbf]));
    if (/\.(?:css|csv|html|js|json|svg|txt)$/.test(file)) {
      assert.equal(bytes.includes(0x0d), false, `${path.relative(root, file)} must use LF`);
    }
  }
});

test('source text has no mojibake signatures and date formatting is fixed to en-IN/Asia Kolkata', () => {
  const textFiles = [
    ...filesUnder(path.join(root, 'public', 'assets')),
    ...filesUnder(path.join(root, 'public', 'pages')),
    path.join(root, 'public', 'index.html')
  ].filter((file) => /\.(?:css|html|js)$/.test(file));

  for (const file of textFiles) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /(?:Ã.|Â.|â[\u0080-\u00bf])/u, path.relative(root, file));
  }

  const context = { window: { RMS: {} }, Intl, Date };
  vm.runInNewContext(readFileSync(path.join(root, 'public', 'assets', 'js', 'utils.js'), 'utf8'), context);
  assert.equal(context.window.RMS.utils.locale, 'en-IN');
  assert.equal(context.window.RMS.utils.timeZone, 'Asia/Kolkata');
  assert.match(context.window.RMS.utils.formatDate('2026-09-04T00:00:00.000Z'), /04 Sept 2026/);
});
