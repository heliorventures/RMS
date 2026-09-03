const { test, expect } = require('./fixtures/rmsTest');

test('campaign scheduling sends a UTC instant and IANA timezone to persistence and delivery', async ({ rms }) => {
  await rms.page.goto('/pages/campaigns.html');
  await rms.page.getByRole('button', { name: 'Create Campaign' }).click();
  await rms.page.locator('#campName').fill('Timezone Campaign');
  await rms.page.locator('#campSchedule').fill('2026-10-01T10:00');
  await rms.page.getByRole('button', { name: 'Schedule' }).click();

  const campaignRequest = rms.api.requests.find(request => request.method === 'POST' && request.pathname === '/api/campaigns');
  const deliveryRequest = rms.api.requests.find(request => request.method === 'POST' && request.pathname === '/api/delivery/jobs');
  expect(campaignRequest.body.scheduledAt).toMatch(/Z$/);
  expect(campaignRequest.body.scheduleTimezone).toBeTruthy();
  expect(deliveryRequest.body.scheduledAt).toBe(campaignRequest.body.scheduledAt);
  expect(deliveryRequest.body.scheduleTimezone).toBe(campaignRequest.body.scheduleTimezone);
  await expect(rms.page.getByText(/Scheduled for/)).toBeVisible();
});

for (const scenario of [
  { page: '/pages/birthdays.html', open: 'Send Wishes', schedule: '#wishSchedule', submit: 'Send Now' },
  { page: '/pages/anniversaries.html', open: 'Send Wishes', schedule: '#wishSchedule', submit: 'Send' },
  { page: '/pages/invitations.html', open: 'Create Event', schedule: '#eventSchedule', submit: 'Send', fill: ['#eventTitle', 'Timezone Invitation'] },
  { page: '/pages/festivals.html', open: 'Add Festival', schedule: '#festSchedule', submit: 'Send', fill: ['#festName', 'Timezone Festival'] }
]) {
  test(`${scenario.page} includes the normalized schedule in its delivery request`, async ({ rms }) => {
    await rms.page.goto(scenario.page);
    await rms.page.getByRole('button', { name: scenario.open }).click();
    if (scenario.fill) await rms.page.locator(scenario.fill[0]).fill(scenario.fill[1]);
    await rms.page.locator(scenario.schedule).fill('2026-10-01T10:00');
    await rms.page.getByRole('button', { name: scenario.submit, exact: true }).click();

    const deliveryRequest = rms.api.requests.find(request => request.method === 'POST' && request.pathname === '/api/delivery/jobs');
    expect(deliveryRequest.body.scheduledAt).toMatch(/Z$/);
    expect(deliveryRequest.body.scheduleTimezone).toBeTruthy();
    await expect(rms.page.getByText(/Scheduled for/)).toBeVisible();
  });
}

test('campaign SMS remains disabled when capability metadata says no provider exists', async ({ rms }) => {
  await rms.page.goto('/pages/campaigns.html');
  await rms.page.getByRole('button', { name: 'Create Campaign' }).click();

  await expect(rms.page.locator('#campType option[value="sms"]')).toBeDisabled();
  await expect(rms.page.locator('#campaignForm')).toContainText('SMS provider is not configured');
});
