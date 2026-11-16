const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function apiFor(response) {
  const effects = { clicks: 0, fetches: [], loggedOut: false };
  const link = { click() { effects.clicks++; }, remove() {} };
  const window = { RMS: { auth: { headers: () => ({ Authorization: 'Bearer download-token' }), logout: () => { effects.loggedOut = true; } } } };
  const context = vm.createContext({
    window, Blob, FormData, AbortController, setTimeout, clearTimeout,
    document: { createElement: () => link, body: { appendChild() {} } },
    URL: { createObjectURL: blob => { effects.blob = blob; return 'blob:download'; }, revokeObjectURL() {} },
    fetch: async (url, options) => { effects.fetches.push({ url, options }); return response; }
  });
  vm.runInContext(fs.readFileSync('public/assets/js/api.js', 'utf8'), context);
  return { api: window.RMS.api, effects, link };
}

test('export downloads use bearer authentication and preserve CSV bytes', async () => {
  const { api, effects, link } = apiFor(new Response('\uFEFFFirst Name,City\r\nAsha,Pune\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8' } }));
  await api.download('/exports/job/download', 'contacts.csv');
  assert.equal(effects.fetches[0].url, '/api/exports/job/download');
  assert.equal(effects.fetches[0].options.headers.Authorization, 'Bearer download-token');
  assert.equal(effects.clicks, 1);
  assert.equal(link.download, 'contacts.csv');
  assert.deepEqual(Buffer.from(await effects.blob.arrayBuffer()), Buffer.from('\uFEFFFirst Name,City\r\nAsha,Pune\r\n'));
});

test('a rejected export reports the API failure instead of saving JSON as CSV', async () => {
  const { api, effects } = apiFor(new Response(JSON.stringify({ success: false, message: 'Export expired' }), { status: 404, headers: { 'content-type': 'application/json' } }));
  await assert.rejects(() => api.download('/exports/job/download', 'contacts.csv'), /Export expired/);
  assert.equal(effects.clicks, 0);
});

test('an expired session aborts export and logs out without creating a corrupt download', async () => {
  const { api, effects } = apiFor(new Response(JSON.stringify({ message: 'Session expired' }), { status: 401 }));
  await assert.rejects(() => api.download('/exports/job/download', 'contacts.csv'), /Session expired/);
  assert.equal(effects.clicks, 0);
  assert.equal(effects.loggedOut, true);
});

test('an unexpected JSON success response is never saved under a CSV extension', async () => {
  const { api, effects } = apiFor(new Response('{"success":true}', { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(() => api.download('/exports/job/download', 'contacts.csv'), /download|CSV|response/i);
  assert.equal(effects.clicks, 0);
});
