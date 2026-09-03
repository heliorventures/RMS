const { test, expect } = require('./fixtures/rmsTest');

test('reports page renders deterministic API totals', async ({ rms }) => {
  await rms.page.goto('/pages/reports.html');
  await rms.page.getByRole('tab', { name: 'Campaign' }).click();
  await expect(rms.page.getByText('Total Campaigns: 1')).toBeVisible();
  await rms.page.getByRole('tab', { name: 'Delivery' }).click();
  await expect(rms.page.locator('#deliveryTable tbody')).toContainText('September Greeting');
});

test('dashboard chart uses exact API message totals', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  await expect.poll(async () => rms.page.evaluate(() => window.__chartConfigs?.length || 0)).toBeGreaterThan(0);

  const chart = await rms.page.evaluate(() => window.__chartConfigs.find(config => config.type === 'line'));
  expect(chart.data.labels).toEqual(['2026-09']);
  expect(chart.data.datasets[0].data).toEqual([12]);
  expect(chart.data.datasets[1].data).toEqual([4]);
});

test('reports page renders an actionable API error and has no fake PDF export', async ({ rms }) => {
  rms.api.fail('GET', '/api/reports/contacts', 500, 'Report service unavailable');
  await rms.page.goto('/pages/reports.html');

  await expect(rms.page.getByRole('alert')).toContainText('Report service unavailable');
  await expect(rms.page.getByRole('button', { name: /Export PDF/i })).toHaveCount(0);
});
