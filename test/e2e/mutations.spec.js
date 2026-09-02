const { test, expect } = require('./fixtures/rmsTest');
const { data } = require('./fixtures/browserHarness');

test('contact creation submits deterministic form data', async ({ rms }) => {
  await rms.page.goto('/pages/contacts.html');
  await rms.page.getByRole('button', { name: 'Add Contact' }).click();
  expect(rms.api.pageErrors).toEqual([]);
  await expect(rms.page.locator('#contactModal')).toHaveClass(/show/);
  await rms.page.locator('#firstName').fill('Meera');
  await rms.page.locator('#lastName').fill('Shah');
  await rms.page.locator('#email').fill('meera@example.com');
  await rms.page.getByRole('button', { name: 'Save Contact' }).click();

  await expect.poll(() => rms.api.requests.filter(request => request.method === 'POST' && request.pathname === '/api/contacts').length).toBe(1);
  const request = rms.api.requests.find(item => item.method === 'POST' && item.pathname === '/api/contacts');
  expect(request.body.firstName).toBe('Meera');
  expect(request.body.lastName).toBe('Shah');
  expect(request.body.email).toBe('meera@example.com');
});

test('contact edit action loads persisted data into the editor', async ({ rms }) => {
  await rms.page.goto('/pages/contacts.html');
  const row = rms.page.locator('#contactsTable tbody tr').filter({ hasText: 'Asha Patil' });
  await expect(row).toBeVisible();
  await row.locator('button').first().click();

  await expect(rms.page.locator('#contactModal')).toHaveClass(/show/);
  await expect(rms.page.locator('#contactModalTitle')).toHaveText('Edit Contact');
  await expect(rms.page.locator('#firstName')).toHaveValue('Asha');
  await expect(rms.page.locator('#email')).toHaveValue('asha@example.com');
  expect(rms.api.requests.some(request => request.method === 'GET' && request.pathname === `/api/contacts/${data.ids.contact}`)).toBe(true);
});

test('failed contact deletion never reports success', async ({ rms }) => {
  test.fail(true, 'Known false-success defect scheduled for Frontend Task 2');
  rms.api.fail('DELETE', `/api/contacts/${data.ids.contact}`, 500, 'Delete failed');
  await rms.page.goto('/pages/contacts.html');

  const row = rms.page.locator('#contactsTable tbody tr').filter({ hasText: 'Asha Patil' });
  await expect(row).toBeVisible();
  await row.locator('button').nth(1).click();
  await rms.page.locator('#rmsConfirmBtn').click();

  await expect(rms.page.locator('.toast-rms')).not.toContainText('Contact deleted');
});

test('campaign scheduling creates a campaign and a delivery job', async ({ rms }) => {
  await rms.page.goto('/pages/campaigns.html');
  await rms.page.getByRole('button', { name: 'Create Campaign' }).click();
  expect(rms.api.pageErrors).toEqual([]);
  await expect(rms.page.locator('#campaignModal')).toHaveClass(/show/);
  await rms.page.locator('#campName').fill('October Greeting');
  await rms.page.locator('#campContent').fill('Hello {{Name}}');
  await rms.page.locator('#campSchedule').fill('2026-10-01T10:00');
  await rms.page.getByRole('button', { name: 'Schedule' }).click();

  await expect.poll(() => rms.api.requests.filter(request => request.method === 'POST' && request.pathname === '/api/campaigns').length).toBe(1);
  await expect.poll(() => rms.api.requests.filter(request => request.method === 'POST' && request.pathname === '/api/delivery/jobs').length).toBe(1);
});

test('delivery page renders its empty state', async ({ rms }) => {
  await rms.page.route('**/api/delivery/jobs?*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [], pagination: { page: 1, limit: 30, total: 0, pages: 0 } })
  }));

  await rms.page.goto('/pages/delivery.html');
  await expect(rms.page.getByText('No delivery jobs yet. Schedule a campaign to start.')).toBeVisible();
});

test('dashboard keeps a loading skeleton visible while data is pending', async ({ rms }) => {
  rms.api.delay('GET', '/api/dashboard/stats', 300);
  await rms.page.goto('/pages/dashboard.html');
  await expect(rms.page.locator('.skeleton').first()).toBeVisible();
  await expect(rms.page.getByText('Total Contacts')).toBeVisible();
});

test('dashboard renders an actionable error state when loading fails', async ({ rms }) => {
  test.fail(true, 'Known missing error-state defect scheduled for Frontend Tasks 2 and 3');
  rms.api.fail('GET', '/api/dashboard/stats', 500, 'Dashboard unavailable');
  await rms.page.goto('/pages/dashboard.html');
  await expect(rms.page.getByRole('alert')).toContainText('Dashboard unavailable');
});
