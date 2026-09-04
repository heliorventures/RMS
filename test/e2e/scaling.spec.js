const { test, expect } = require('./fixtures/rmsTest');
const { data } = require('./fixtures/browserHarness');

test('label deep links resolve requested contacts with one bulk lookup', async ({ rms }) => {
  await rms.page.goto(`/pages/labels.html?ids=${data.ids.contact},507f1f77bcf86cd799439012`);
  await rms.page.locator('#pageBody').waitFor({ state: 'attached' });

  await expect.poll(() => rms.api.requests.filter(request => request.pathname === '/api/contacts/bulk-lookup').length).toBe(1);
  expect(rms.api.requests.filter(request => /^\/api\/contacts\/[0-9a-f]{24}$/.test(request.pathname))).toEqual([]);
});

test('Group member editing uses bounded search instead of a 500-contact client cache', async ({ rms }) => {
  await rms.page.goto('/pages/groups.html');
  await rms.page.locator('#pageBody').waitFor({ state: 'attached' });
  await rms.page.getByRole('button', { name: 'Create Group' }).click();

  expect(rms.api.requests.filter(request => request.pathname === '/api/contacts' && request.search.includes('limit=500'))).toEqual([]);
});

test('birthday calendar loads month aggregates rather than a contact cache', async ({ rms }) => {
  await rms.page.goto('/pages/birthdays.html');
  await rms.page.locator('#pageBody').waitFor({ state: 'attached' });
  await rms.page.getByRole('tab', { name: 'Calendar' }).click();

  await expect.poll(() => rms.api.requests.filter(request => request.pathname === '/api/contacts/birthdays/calendar').length).toBe(1);
  expect(rms.api.requests.filter(request => request.pathname === '/api/contacts' && request.search.includes('limit=500'))).toEqual([]);
});

test('delivery message logs request an explicit bounded page', async ({ rms }) => {
  await rms.page.goto('/pages/delivery.html');
  await rms.page.locator('#messagesBody').waitFor({ state: 'attached' });

  await expect.poll(() => rms.api.requests.filter(request => request.pathname.endsWith('/messages')).length).toBe(1);
  const request = rms.api.requests.find(entry => entry.pathname.endsWith('/messages'));
  expect(request.search).toContain('page=1');
  expect(request.search).toContain('limit=100');
});

test('a 501-member group renders one bounded member page', async ({ rms }) => {
  const members = Array.from({ length: 100 }, (_, index) => ({
    ...data.contact,
    _id: String(index + 100).padStart(24, '0'),
    firstName: `Member ${index + 1}`
  }));
  rms.api.respond('GET', `/api/groups/${data.ids.group}`, {
    success: true,
    data: { group: { ...data.group, memberCount: 501 }, members, pagination: { page: 1, limit: 100, total: 501, pages: 6 } }
  });

  await rms.page.goto('/pages/groups.html');
  await rms.page.getByRole('button', { name: /Pune Associates/ }).click();
  await expect(rms.page.locator('#membersTableBody tr')).toHaveCount(100);
  await expect(rms.page.locator('#groupMembersPager')).toBeVisible();
  expect(rms.api.requests.filter(request => request.pathname === `/api/groups/${data.ids.group}`)[0].search).toContain('limit=100');
});

test('a 50,000-contact response keeps the contacts table bounded to one page', async ({ rms }) => {
  const contacts = Array.from({ length: 100 }, (_, index) => ({
    ...data.contact,
    _id: String(index + 1000).padStart(24, '0'),
    firstName: `Contact ${index + 1}`
  }));
  rms.api.respond('GET', '/api/contacts', {
    success: true,
    data: contacts,
    pagination: { page: 1, limit: 100, total: 50000, pages: 500 }
  });

  await rms.page.goto('/pages/contacts.html');
  await expect(rms.page.locator('#contactsTable tbody tr')).toHaveCount(100);
  await expect(rms.page.locator('#contactTotalBadge')).toContainText('50,000 Contacts');
  const contactRequests = rms.api.requests.filter(request => request.pathname === '/api/contacts');
  expect(contactRequests.every(request => Number(new URLSearchParams(request.search).get('limit')) <= 100)).toBe(true);
});

test('contact export starts a server-side export job instead of fetching all contacts', async ({ rms }) => {
  await rms.page.goto('/pages/contacts.html');
  await rms.page.getByRole('button', { name: 'Export' }).click();

  await expect.poll(() => rms.api.requests.filter(request => request.pathname === '/api/exports/contacts').length).toBe(1);
  expect(rms.api.requests.some(request => request.pathname === '/api/contacts' && request.search.includes('limit=50000'))).toBe(false);
});
