const { test, expect } = require('./fixtures/rmsTest');
const data = require('./fixtures/sampleData');

test('festival email sends without asking for a WhatsApp mapping', async ({ rms }) => {
  await rms.page.goto('/pages/festivals.html');
  await rms.page.getByRole('button', { name: 'Add Festival' }).click();
  await rms.page.locator('#festName').fill('Email celebration');
  await rms.page.locator('#festDate').fill('2099-11-16');
  await rms.page.locator('#festMessage').fill('Warm wishes {{Name}}');
  await rms.page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => rms.api.requests.filter(r => r.method === 'POST' && r.pathname === '/api/delivery/jobs').length).toBe(1);
  const request = rms.api.requests.find(r => r.method === 'POST' && r.pathname === '/api/delivery/jobs');
  expect(request.body.channel).toBe('email');
  await expect(rms.page.locator('dialog')).toHaveCount(0);
});

for (const status of ['draft', 'scheduled']) {
  test(`saving a ${status} festival with a future time creates a scheduled delivery`, async ({ rms }) => {
    await rms.page.goto('/pages/festivals.html');
    await rms.page.getByRole('button', { name: 'Add Festival' }).click();
    await rms.page.locator('#festName').fill('Future celebration');
    await rms.page.locator('#festDate').fill('2099-11-16');
    await rms.page.locator('#festMessage').fill('Warm wishes');
    await rms.page.locator('#festStatus').selectOption(status);
    await rms.page.locator('#festSchedule').fill('2099-11-16T10:00');
    await rms.page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => rms.api.requests.filter(r => r.method === 'POST' && r.pathname === '/api/delivery/jobs').length).toBe(1);
    const request = rms.api.requests.find(r => r.method === 'POST' && r.pathname === '/api/delivery/jobs');
    expect(request.body.scheduledAt).toMatch(/^2099-11-16T.*Z$/);
    expect(request.body.channel).toBe('email');
  });
}

test('festival filters contain all canonical and saved city and sector choices', async ({ rms }) => {
  rms.api.respond('GET', '/api/contacts/filter-options', { success: true, data: { city: ['Hyderabad', 'Nashik'], sector: ['Supplier', 'Flat Holder'], religion: ['Hindu'] } });
  await rms.page.goto('/pages/festivals.html');
  await rms.page.getByRole('button', { name: 'Add Festival' }).click();
  await expect(rms.page.locator('#festCity option')).toContainText(['Hyderabad', 'Nashik']);
  await expect(rms.page.locator('#festSector option')).toContainText(['Supplier', 'Flat Holder']);
});

test('invitation groups have an explicit action to clear selection', async ({ rms }) => {
  await rms.page.goto('/pages/invitations.html');
  await rms.page.getByRole('button', { name: 'Create Event', exact: true }).click();
  await expect(rms.page.locator('#eventGroups option')).toHaveCount(1);
  await rms.page.locator('#eventGroups').selectOption(data.ids.group);
  await rms.page.getByRole('button', { name: 'Clear selected groups', exact: true }).click();
  await expect(rms.page.locator('#eventGroups')).toHaveValues([]);
});
