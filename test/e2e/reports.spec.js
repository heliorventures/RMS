const { test, expect } = require('./fixtures/rmsTest');

test('reports page renders deterministic API totals', async ({ rms }) => {
  await rms.page.goto('/pages/reports.html');
  await rms.page.getByRole('tab', { name: 'Campaign' }).click();
  await expect(rms.page.getByText('Total Campaigns: 1')).toBeVisible();
  await rms.page.getByRole('tab', { name: 'Delivery' }).click();
  await expect(rms.page.locator('#deliveryTable tbody')).toContainText('September Greeting');
});

test('dashboard chart uses exact API message totals', async ({ rms }) => {
  test.fail(true, 'Known fabricated chart defect scheduled for Frontend Task 3');
  await rms.page.goto('/pages/dashboard.html');
  await expect.poll(async () => rms.page.evaluate(() => window.__chartConfigs?.length || 0)).toBeGreaterThan(0);

  const chart = await rms.page.evaluate(() => window.__chartConfigs.find(config => config.type === 'line'));
  expect(chart.data.datasets[0].data).toEqual([12]);
});
