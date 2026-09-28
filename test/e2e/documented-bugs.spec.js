const { test, expect } = require('./fixtures/rmsTest');
const data = require('./fixtures/sampleData');

test('dashboard shortcuts open the creation forms', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  await rms.page.getByRole('link', { name: 'Add Contact', exact: true }).click();
  await expect(rms.page.locator('#contactModal')).toBeVisible();
  await rms.page.goto('/pages/dashboard.html');
  await rms.page.getByRole('link', { name: 'New Campaign', exact: true }).click();
  await expect(rms.page.locator('#campaignModal')).toBeVisible();
});

test('empty bulk upload has no success progress and its file clears on reopening', async ({ rms }) => {
  await rms.page.goto('/pages/contacts.html');
  await rms.page.getByRole('button', { name: 'Bulk Upload', exact: true }).click();
  await rms.page.locator('#bulkCsvFile').setInputFiles({ name: 'empty.csv', mimeType: 'text/csv', buffer: Buffer.from('First Name,Last Name\n,\n') });
  await rms.page.getByRole('button', { name: 'Upload Contacts', exact: true }).click();
  await expect(rms.page.locator('#bulkUploadResult')).toContainText('No valid contacts');
  await expect(rms.page.locator('#bulkUploadProgress')).toBeHidden();
  expect(rms.api.requests.filter(r => r.pathname === '/api/contacts/bulk-import')).toHaveLength(0);
  await rms.page.locator('#bulkUploadModal [data-bs-dismiss="modal"]').first().click();
  await expect(rms.page.locator('#bulkUploadModal')).toBeHidden();
  await rms.page.getByRole('button', { name: 'Bulk Upload', exact: true }).click();
  await expect(rms.page.locator('#bulkCsvFile')).toHaveValue('');
});

test('bulk import preserves raw dates for server validation and reports rejected rows', async ({ rms }) => {
  rms.api.respond('POST', '/api/contacts/bulk-import', { success: true, data: { inserted: 1, skipped: 1, errors: [{ row: 3, message: 'Invalid email address' }] } });
  await rms.page.goto('/pages/contacts.html');
  await rms.page.getByRole('button', { name: 'Bulk Upload', exact: true }).click();
  await rms.page.locator('#bulkCsvFile').setInputFiles({ name: 'mixed.csv', mimeType: 'text/csv', buffer: Buffer.from('First Name,Last Name,Date of Birth,Email\nGood,Contact,15-03-1985,good@example.com\nBad,Contact,31-02-2020,bad\n') });
  await rms.page.getByRole('button', { name: 'Upload Contacts', exact: true }).click();
  await expect(rms.page.locator('#bulkUploadResult')).toContainText('1 rejected');
  await expect(rms.page.locator('#bulkUploadResult')).toContainText('Row 3: Invalid email address');
  const request = rms.api.requests.find(r => r.pathname === '/api/contacts/bulk-import');
  expect(request.body.contacts[0].dob).toBe('15-03-1985');
  expect(request.body.contacts).toHaveLength(2);
});

test('invitation never silently selects the entire contact list', async ({ rms }) => {
  await rms.page.goto('/pages/invitations.html');
  await rms.page.getByRole('button', { name: 'Create Event', exact: true }).click();
  await rms.page.locator('#eventTitle').fill('Selected audience only');
  await rms.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(rms.page.locator('#eventForm').getByRole('alert')).toContainText('Select at least one contact or group');
  expect(rms.api.requests.filter(r => r.pathname === '/api/delivery/jobs' && r.method === 'POST')).toHaveLength(0);
});

test('new invitation clears old recipients and cannot submit while recipient loading fails', async ({ rms }) => {
  rms.api.respond('GET', '/api/events', { success: true, data: [{ ...data.event, recipients: { groups: [data.ids.group], contacts: [] } }] });
  await rms.page.goto('/pages/invitations.html');
  await rms.page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(rms.page.locator('#eventGroups')).toHaveValues([data.ids.group]);
  await rms.page.locator('#eventModal').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(rms.page.locator('#eventModal')).toBeHidden();
  rms.api.delay('GET', '/api/groups', 250);
  rms.api.fail('GET', '/api/groups', 500, 'Groups unavailable');
  await rms.page.getByRole('button', { name: 'Create Event', exact: true }).click();
  await expect(rms.page.locator('#eventGroups')).toHaveValues([]);
  await expect(rms.page.locator('#eventModal').getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
  await expect(rms.page.locator('#eventForm').getByRole('alert')).toContainText('Recipients could not be loaded');
  expect(rms.api.requests.filter(r => r.pathname === '/api/delivery/jobs' && r.method === 'POST')).toHaveLength(0);
});

test('draft campaigns open for editing and retain their identity when saved', async ({ rms }) => {
  const draft = { ...data.campaign, status: 'draft' };
  rms.api.respond('GET', '/api/campaigns', { success: true, data: [draft] });
  rms.api.respond('GET', `/api/campaigns/${draft._id}`, { success: true, data: draft });
  rms.api.respond('PUT', `/api/campaigns/${draft._id}`, { success: true, data: draft });
  await rms.page.goto('/pages/campaigns.html');
  await rms.page.getByRole('button', { name: 'Edit campaign', exact: true }).click();
  await expect(rms.page.locator('#campName')).toHaveValue(draft.name);
  await rms.page.locator('#campName').fill('Updated draft');
  await rms.page.getByRole('button', { name: 'Save Draft', exact: true }).click();
  await expect(rms.page.locator('#campaignModal')).toBeHidden();
  expect(rms.api.requests.filter(r => r.method === 'POST' && r.pathname === '/api/campaigns')).toHaveLength(0);
  expect(rms.api.requests.find(r => r.method === 'PUT' && r.pathname === `/api/campaigns/${draft._id}`).body.name).toBe('Updated draft');
});

test('contact profile offers a real email composer and a creation timeline', async ({ rms }) => {
  rms.api.respond('GET', `/api/contacts/${data.ids.contact}`, { success: true, data: { ...data.contact, timeline: [], createdAt: '2026-09-01T00:00:00Z' } });
  await rms.page.goto(`/pages/contact-profile.html?id=${data.ids.contact}`);
  await rms.page.getByRole('tab', { name: 'Timeline', exact: true }).click();
  await expect(rms.page.locator('#timeline')).toContainText('Contact profile created');
  await rms.page.getByRole('button', { name: 'Email', exact: true }).click();
  await expect(rms.page.locator('#contactMessageModal')).toBeVisible();
  expect(rms.api.requests.filter(r => r.pathname === '/api/delivery/jobs' && r.method === 'POST')).toHaveLength(0);
});

test('contact profile renders stored communication as text', async ({ rms }) => {
  rms.api.respond('GET', '/api/communication', { success: true, data: [{
    contactId: data.ids.contact,
    type: 'email',
    subject: '<img src=x onerror=alert(1)>',
    message: '<script>alert(1)</script>',
    status: 'sent',
    sentAt: '2026-09-01T00:00:00Z'
  }] });
  await rms.page.goto(`/pages/contact-profile.html?id=${data.ids.contact}`);
  await rms.page.getByRole('tab', { name: 'Communication', exact: true }).click();
  await expect(rms.page.locator('#communication')).toContainText('<script>alert(1)</script>');
  await expect(rms.page.locator('#communication script, #communication img')).toHaveCount(0);
});
