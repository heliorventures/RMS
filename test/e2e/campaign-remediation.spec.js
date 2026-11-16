const { test, expect } = require('./fixtures/rmsTest');
const data = require('./fixtures/sampleData');

async function open(rms) {
  await rms.page.goto('/pages/campaigns.html');
  await rms.page.getByRole('button', { name: 'Create Campaign', exact: true }).click();
  await rms.page.locator('#campName').fill('Targeted birthday greeting');
}

test('campaign content is required and empty audience never defaults to everybody', async ({ rms }) => {
  await open(rms);
  await rms.page.locator('#campSchedule').fill('2099-09-01T10:00');
  await rms.page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(rms.page.locator('#campaignForm').getByRole('alert')).toContainText('Campaign content is required');
  await rms.page.locator('#campContent').fill('Happy birthday {{Name}}');
  await rms.page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(rms.page.locator('#campaignForm').getByRole('alert')).toContainText('Select at least one contact, group or filter');
  expect(rms.api.requests.filter(r => r.pathname === '/api/delivery/jobs' && r.method === 'POST')).toHaveLength(0);
});

test('selected campaign recipients and filters are persisted and delivery points at saved campaign', async ({ rms }) => {
  rms.api.respond('POST', '/api/delivery/jobs', { success: true, data: { ...data.job, stats: { total: 2, skipped: 1 } } });
  await open(rms);
  await rms.page.locator('#campContent').fill('Happy birthday {{Name}}');
  await rms.page.locator('#campSchedule').fill('2099-09-01T10:00');
  await rms.page.locator('#campGroups').selectOption(data.ids.group);
  await rms.page.locator('#campCities').fill('Pune, Mumbai');
  await rms.page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(rms.page.locator('#campaignModal')).toBeHidden();
  const saved = rms.api.requests.find(r => r.pathname === '/api/campaigns' && r.method === 'POST');
  expect(saved.body.audience).toBe('selected');
  expect(saved.body.recipients.groups).toEqual([data.ids.group]);
  expect(saved.body.recipients.filters.cities).toEqual(['Pune', 'Mumbai']);
  const job = rms.api.requests.find(r => r.pathname === '/api/delivery/jobs' && r.method === 'POST');
  expect(job.body.campaignId).toBe(data.ids.campaign);
  expect(job.body.audience).not.toBe('all');
  await expect(rms.page.getByText(/Scheduled for/)).toBeVisible();
  await expect(rms.page.getByText(/1 skipped/)).toBeVisible();
});

test('campaign Schedule rejects missing or past dates and exposes honest delivery statistics', async ({ rms }) => {
  rms.api.respond('GET', '/api/campaigns', { success: true, data: [{ ...data.campaign, status: 'partial', stats: { sent: 1, delivered: 0, failed: 0, skipped: 1 } }] });
  await open(rms);
  await rms.page.locator('#campContent').fill('Hello {{Name}}');
  await rms.page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(rms.page.locator('#campaignForm').getByRole('alert')).toContainText('future schedule');
  await rms.page.locator('#campSchedule').fill('2020-09-01T10:00');
  await rms.page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(rms.page.locator('#campaignForm').getByRole('alert')).toContainText('future schedule');
  expect(rms.api.requests.filter(r => r.pathname === '/api/delivery/jobs' && r.method === 'POST')).toHaveLength(0);
  await rms.page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(rms.page.getByText(/SMTP acceptance/)).toBeVisible();
  await expect(rms.page.getByText('Not tracked', { exact: true })).toBeVisible();
  await expect(rms.page.getByRole('columnheader', { name: /^Skipped/ })).toBeVisible();
  await expect(rms.page.locator('#campaignsTable tbody tr').first().locator('td').nth(7)).toHaveText('1');
});

test('draft editing restores selected contacts, groups and filters', async ({ rms }) => {
  const draft = { ...data.campaign, status: 'draft', audience: 'selected', recipients: { contacts: [data.ids.contact], groups: [data.ids.group], filters: { cities: ['Pune'], sectors: ['Associates'] } } };
  rms.api.respond('GET', '/api/campaigns', { success: true, data: [draft] });
  rms.api.respond('GET', `/api/campaigns/${draft._id}`, { success: true, data: draft });
  await rms.page.goto('/pages/campaigns.html');
  await rms.page.getByRole('button', { name: 'Edit campaign', exact: true }).click();
  await expect(rms.page.locator('#campGroups')).toHaveValues([data.ids.group]);
  await expect(rms.page.locator('#campSelectedContacts')).toContainText('Asha Patil');
  await expect(rms.page.locator('#campCities')).toHaveValue('Pune');
  await expect(rms.page.locator('#campSectors')).toHaveValue('Associates');
});

test('recipient load failure keeps campaign scheduling disabled', async ({ rms }) => {
  rms.api.fail('GET', '/api/groups', 500, 'Groups unavailable');
  await open(rms);
  await expect(rms.page.locator('#campaignForm').getByRole('alert')).toContainText('Recipients could not be loaded');
  await expect(rms.page.getByRole('button', { name: 'Schedule', exact: true })).toBeDisabled();
  expect(rms.api.requests.filter(r => r.pathname === '/api/delivery/jobs' && r.method === 'POST')).toHaveLength(0);
});

test('older campaigns show unknown skipped totals instead of a fabricated zero', async ({ rms }) => {
  rms.api.respond('GET', '/api/campaigns', { success: true, data: [{ ...data.campaign, stats: { sent: 1, delivered: 0, failed: 0 } }] });
  await rms.page.goto('/pages/campaigns.html');
  await expect(rms.page.getByText('Not recorded', { exact: true })).toBeVisible();
});
