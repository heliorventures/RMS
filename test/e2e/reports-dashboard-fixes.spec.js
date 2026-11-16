const { test, expect } = require('./fixtures/rmsTest');
const { AxeBuilder } = require('@axe-core/playwright');
const data = require('./fixtures/sampleData');

test('dashboard contact growth reflects API growth and has no invented first-month percentage', async ({ rms }) => {
  rms.api.respond('GET', '/api/dashboard/stats', { success: true, data: { ...data.dashboard, stats: { ...data.dashboard.stats, contactGrowth: { addedThisMonth: 5, baseline: 20, percent: 25 } } } });
  await rms.page.goto('/pages/dashboard.html');
  await expect(rms.page.locator('.stat-card').filter({ hasText: 'Total Contacts' })).toContainText('+25% this month');
  rms.api.respond('GET', '/api/dashboard/stats', { success: true, data: { ...data.dashboard, stats: { ...data.dashboard.stats, contactGrowth: { addedThisMonth: 5, baseline: 0, percent: null } } } });
  await rms.page.reload();
  await expect(rms.page.locator('.stat-card').filter({ hasText: 'Total Contacts' })).toContainText('5 added this month');
});

for (const theme of ['light', 'dark']) test(`report tabs remain readable and operable in ${theme} theme`, async ({ rms }) => {
  await rms.page.goto('/pages/reports.html');
  await rms.page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
  for (const name of ['Contacts', 'Birthday', 'Campaign', 'Delivery']) {
    await rms.page.getByRole('tab', { name, exact: true }).click();
    const result = await new AxeBuilder({ page: rms.page }).include('.nav-tabs').withRules(['color-contrast']).analyze();
    expect(result.violations).toEqual([]);
  }
});

test('dashboard graphs distinguish all supported channels with readable legend colors', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  await expect(rms.page.locator('#messagesChart')).toBeVisible();
  const messages = await rms.page.evaluate(() => Chart.getChart('messagesChart').data.datasets.map(row => ({ label: row.label, data: row.data, borderColor: row.borderColor, backgroundColor: row.backgroundColor })));
  expect(messages.map(row => row.label)).toEqual(['Email', 'WhatsApp', 'SMS']);
  expect(messages.map(row => row.data)).toEqual([[12], [4], [0]]);
  expect(new Set(messages.map(row => row.borderColor)).size).toBe(3);
  expect(messages.every(row => row.backgroundColor === row.borderColor)).toBe(true);
});

test('report bars distinguish contact categories', async ({ rms }) => {
  rms.api.respond('GET', '/api/reports/contacts', { success: true, data: { ...data.contact, byCity: { Pune: 2, Mumbai: 3 }, bySector: {}, byReligion: {} } });
  await rms.page.goto('/pages/reports.html');
  await expect(rms.page.locator('#cityChart')).toBeVisible();
  const colors = await rms.page.evaluate(() => Chart.getChart('cityChart').data.datasets[0].backgroundColor);
  expect(Array.isArray(colors)).toBe(true);
  expect(new Set(colors).size).toBe(2);
});
