const { test, expect } = require('@playwright/test');
const { preparePage } = require('./fixtures/browserHarness');

async function openApiPage(page) {
  await preparePage(page, { authenticated: false });
  await page.goto('/index.html');
}

async function captureApiError(page, endpoint, options) {
  return page.evaluate(async ({ apiEndpoint, apiOptions }) => {
    try {
      await window.RMS.api.get(apiEndpoint, apiOptions);
      return null;
    } catch (error) {
      return {
        name: error.name,
        status: error.status,
        code: error.code,
        message: error.message,
        requestId: error.requestId
      };
    }
  }, { apiEndpoint: endpoint, apiOptions: options });
}

for (const status of [400, 403, 409, 500]) {
  test(`HTTP ${status} rejects with a typed ApiError`, async ({ page }) => {
    await openApiPage(page);
    await page.route(`**/api/error-${status}`, route => route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'x-request-id': `request-${status}` },
      body: JSON.stringify({
        success: false,
        code: `ERROR_${status}`,
        message: `Failure ${status}`
      })
    }));

    const error = await captureApiError(page, `/error-${status}`);

    expect(error).toEqual({
      name: 'ApiError',
      status,
      code: `ERROR_${status}`,
      message: `Failure ${status}`,
      requestId: `request-${status}`
    });
  });
}

test('HTTP 401 from login rejects with ApiError without redirecting', async ({ page }) => {
  await openApiPage(page);
  await page.route('**/api/auth/login', route => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' })
  }));

  const error = await page.evaluate(async () => {
    try {
      await window.RMS.api.post('/auth/login', { email: 'admin@example.com', password: 'wrong' });
      return null;
    } catch (caught) {
      return { name: caught.name, status: caught.status, code: caught.code, message: caught.message };
    }
  });

  expect(error).toEqual({ name: 'ApiError', status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
  await expect(page).toHaveURL(/\/index\.html$/);
});

test('invalid JSON rejects with an INVALID_RESPONSE ApiError', async ({ page }) => {
  await openApiPage(page);
  await page.route('**/api/invalid-json', route => route.fulfill({
    status: 502,
    contentType: 'text/html',
    body: '<html>upstream error</html>'
  }));

  const error = await captureApiError(page, '/invalid-json');

  expect(error).toEqual({
    name: 'ApiError',
    status: 502,
    code: 'INVALID_RESPONSE',
    message: 'Server returned an invalid response. Please try again.',
    requestId: null
  });
});

test('request timeout rejects with a TIMEOUT ApiError', async ({ page }) => {
  await openApiPage(page);
  await page.route('**/api/slow-request', async route => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  const error = await captureApiError(page, '/slow-request', { timeout: 30 });

  expect(error).toEqual({
    name: 'ApiError',
    status: 0,
    code: 'TIMEOUT',
    message: 'Request timed out. Please try again.',
    requestId: null
  });
});

test('network failure rejects with a NETWORK_ERROR ApiError', async ({ page }) => {
  await openApiPage(page);
  await page.route('**/api/network-error', route => route.abort('connectionrefused'));

  const error = await captureApiError(page, '/network-error');

  expect(error).toEqual({
    name: 'ApiError',
    status: 0,
    code: 'NETWORK_ERROR',
    message: 'Server is unavailable. Check your connection and try again.',
    requestId: null
  });
});

test('forgot-password failure stays inline and does not report reset-link success', async ({ page }) => {
  await openApiPage(page);
  await page.route('**/api/auth/forgot-password', route => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, message: 'Password service unavailable' })
  }));

  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.locator('#forgotEmail').fill('admin@example.com');
  await page.getByRole('button', { name: 'Send Reset Link' }).click();

  await expect(page.locator('#forgotModal').getByRole('alert')).toContainText('Password service unavailable');
  await expect(page.getByText('Reset link sent if account exists', { exact: true })).toHaveCount(0);
  await expect(page.locator('#forgotModal')).toHaveClass(/show/);
});
