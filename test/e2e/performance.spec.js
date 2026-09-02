const { test, expect } = require('./fixtures/rmsTest');
const { data } = require('./fixtures/browserHarness');

test('delivery initial refresh stays within the recorded request budget', async ({ rms }) => {
  await rms.page.goto('/pages/delivery.html');
  await expect(rms.page.locator('#jobDetailCard')).toBeVisible();
  await rms.page.waitForTimeout(250);

  const deliveryRequests = rms.api.requests.filter(request => request.pathname.startsWith('/api/delivery/jobs'));
  expect(deliveryRequests.length).toBeLessThanOrEqual(6);
});

test('label deep links load contacts concurrently', async ({ rms }) => {
  test.fail(true, 'Known serial request waterfall scheduled for Frontend Task 7');
  const ids = [data.ids.contact, '507f1f77bcf86cd799439021', '507f1f77bcf86cd799439022'];
  for (const id of ids) rms.api.delay('GET', `/api/contacts/${id}`, 100);

  await rms.page.goto(`/pages/labels.html?ids=${ids.join(',')}`);
  await expect.poll(() => rms.api.requests.filter(request => request.pathname.startsWith('/api/contacts/')).length).toBe(3);

  expect(rms.api.maxConcurrentByPath.get('/api/contacts/:id') || 0).toBeGreaterThan(1);
});
