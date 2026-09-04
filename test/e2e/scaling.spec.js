const { test, expect } = require('./fixtures/rmsTest');
const { data } = require('./fixtures/browserHarness');

test('label deep links resolve requested contacts with one bulk lookup', async ({ rms }) => {
  await rms.page.goto(`/pages/labels.html?ids=${data.ids.contact},507f1f77bcf86cd799439012`);
  await rms.page.locator('#pageBody').waitFor({ state: 'attached' });

  await expect.poll(() => rms.api.requests.filter(request => request.pathname === '/api/contacts/bulk-lookup').length).toBe(1);
  expect(rms.api.requests.filter(request => /^\/api\/contacts\/[0-9a-f]{24}$/.test(request.pathname))).toEqual([]);
});

test('Groups and Birthdays never fetch a 500-contact client cache', async ({ rms }) => {
  await rms.page.goto('/pages/groups.html');
  await rms.page.locator('#pageBody').waitFor({ state: 'attached' });
  await rms.page.goto('/pages/birthdays.html');
  await rms.page.locator('#pageBody').waitFor({ state: 'attached' });

  expect(rms.api.requests.filter(request => request.pathname === '/api/contacts' && request.search.includes('limit=500'))).toEqual([]);
});

test('contact export starts a server-side export job instead of fetching all contacts', async ({ rms }) => {
  await rms.page.goto('/pages/contacts.html');
  await rms.page.getByRole('button', { name: 'Export' }).click();

  await expect.poll(() => rms.api.requests.filter(request => request.pathname === '/api/exports/contacts').length).toBe(1);
  expect(rms.api.requests.some(request => request.pathname === '/api/contacts' && request.search.includes('limit=50000'))).toBe(false);
});
