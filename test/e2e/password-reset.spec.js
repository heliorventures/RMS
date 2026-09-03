const { test, expect } = require('@playwright/test');
const { preparePage } = require('./fixtures/browserHarness');

test('forgot-password response uses enumeration-safe copy', async ({ page }) => {
  await preparePage(page, { authenticated: false });
  await page.goto('/index.html');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.locator('#forgotEmail').fill('unknown@example.com');
  await page.getByRole('button', { name: 'Send Reset Link' }).click();

  await expect(page.getByText('If an account exists and email delivery succeeds, a reset link will arrive shortly.')).toBeVisible();
});

test('reset page submits token and new password through the real API flow', async ({ page }) => {
  const api = await preparePage(page, { authenticated: false });
  await page.goto('/pages/reset-password.html?token=test-reset-token');
  await page.getByLabel('New password').fill('a-secure-password-123');
  await page.getByLabel('Confirm password').fill('a-secure-password-123');
  await page.getByRole('button', { name: 'Reset Password' }).click();

  await expect(page.getByRole('status')).toContainText('Password reset successfully');
  const request = api.requests.find(item => item.method === 'POST' && item.pathname === '/api/auth/reset-password');
  expect(request.body).toEqual({ token: 'test-reset-token', newPassword: 'a-secure-password-123' });
});
