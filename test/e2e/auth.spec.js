const { test, expect } = require('@playwright/test');
const { preparePage } = require('./fixtures/browserHarness');

test('user can log in and log out through the real UI flow', async ({ page }) => {
  await preparePage(page, { authenticated: false });
  await page.goto('/index.html');

  await page.getByLabel('Email address').fill('admin@example.com');
  await page.getByLabel('Password').fill('correct-password');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/pages\/dashboard\.html$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.evaluate(() => window.RMS.auth.logout());
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('401 response clears the session and returns to login', async ({ page }) => {
  const api = await preparePage(page);
  api.fail('GET', '/api/dashboard/stats', 401, 'Session expired');

  await page.goto('/pages/dashboard.html');

  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
