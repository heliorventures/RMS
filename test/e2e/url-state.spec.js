const { test, expect } = require('./fixtures/rmsTest');

test('contacts restores a copied search and filter URL', async ({ rms }) => {
  await rms.page.goto('/pages/contacts.html?q=Asha&city=Pune&page=1');
  await expect(rms.page.locator('#filterCity')).toHaveValue('Pune');
  await expect(rms.page.locator('#contactsTable_filter input')).toHaveValue('Asha');
});

test('birthday calendar restores month and tab through browser history', async ({ rms }) => {
  await rms.page.goto('/pages/birthdays.html?tab=calendar&month=2026-09');
  await expect(rms.page.getByRole('tab', { name: 'Calendar' })).toHaveAttribute('aria-selected', 'true');
  await expect(rms.page.locator('#calMonth')).toContainText('September 2026');

  await rms.page.getByRole('button', { name: 'Next month' }).click();
  await expect(rms.page).toHaveURL(/month=2026-10/);
  await rms.page.goBack();
  await expect(rms.page.locator('#calMonth')).toContainText('September 2026');
});

test('report tab selection is URL-backed and restored by Back', async ({ rms }) => {
  await rms.page.goto('/pages/reports.html');
  await rms.page.getByRole('tab', { name: 'Delivery' }).click();
  await expect(rms.page).toHaveURL(/tab=delivery/);
  await rms.page.goBack();
  await expect(rms.page.getByRole('tab', { name: 'Contacts' })).toHaveAttribute('aria-selected', 'true');
});
