const { test, expect } = require('./fixtures/rmsTest');
const { data } = require('./fixtures/browserHarness');

test('delivery initial refresh stays within the recorded request budget', async ({ rms }) => {
  await rms.page.goto('/pages/delivery.html');
  await expect(rms.page.locator('#jobDetailCard')).toBeVisible();
  await rms.page.waitForTimeout(250);

  const deliveryRequests = rms.api.requests.filter(request => request.pathname.startsWith('/api/delivery/jobs'));
  expect(deliveryRequests.length).toBeLessThanOrEqual(6);
});

test('label deep links resolve all requested contacts through one bulk request', async ({ rms }) => {
  const ids = [data.ids.contact, '507f1f77bcf86cd799439021', '507f1f77bcf86cd799439022'];

  await rms.page.goto(`/pages/labels.html?ids=${ids.join(',')}`);
  await expect.poll(() => rms.api.requests.filter(request => request.pathname === '/api/contacts/bulk-lookup').length).toBe(1);
  expect(rms.api.requests.filter(request => /^\/api\/contacts\/[0-9a-f]{24}$/.test(request.pathname))).toEqual([]);
});

test('request coordinator discards an aborted stale result', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  const results = await rms.page.evaluate(async () => {
    const first = window.RMS.requests.run('e2e:stale', async ({ signal }) => new Promise(resolve => {
      signal.addEventListener('abort', () => resolve('stale'), { once: true });
    }));
    const second = window.RMS.requests.run('e2e:stale', async () => 'current');
    return Promise.all([first, second]);
  });

  expect(results).toEqual([undefined, 'current']);
});

test('delivery selection does not refetch its detail after the initial load', async ({ rms }) => {
  await rms.page.goto('/pages/delivery.html');
  await expect(rms.page.locator('#jobDetailCard')).toBeVisible();

  const detailRequests = rms.api.requests.filter(request => request.pathname === `/api/delivery/jobs/${data.ids.job}`);
  expect(detailRequests).toHaveLength(1);
});

test('delivery polling pauses while hidden and performs one refresh when visible', async ({ rms }) => {
  await rms.page.goto('/pages/delivery.html');
  await expect(rms.page.locator('#jobDetailCard')).toBeVisible();

  await rms.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const detailPath = `/api/delivery/jobs/${data.ids.job}`;
  const hiddenRequestCount = rms.api.requests.filter(request => request.pathname === detailPath).length;
  await rms.page.waitForTimeout(5200);
  expect(rms.api.requests.filter(request => request.pathname === detailPath)).toHaveLength(hiddenRequestCount);

  await rms.page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => rms.api.requests.filter(request => request.pathname === detailPath).length).toBe(hiddenRequestCount + 1);
});
