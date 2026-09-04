const { test, expect } = require('./fixtures/rmsTest');
const { data } = require('./fixtures/browserHarness');

const pages = [
  ['/pages/dashboard.html', 'Dashboard'],
  ['/pages/contacts.html', 'Contact Management'],
  ['/pages/groups.html', 'Group Management'],
  ['/pages/birthdays.html', 'Birthday Module'],
  ['/pages/anniversaries.html', 'Anniversary Module'],
  ['/pages/festivals.html', 'Festival Module'],
  ['/pages/invitations.html', 'Invitation Module'],
  ['/pages/labels.html', 'Label Printing'],
  ['/pages/campaigns.html', 'Campaign Management'],
  ['/pages/delivery.html', 'Delivery Tracking'],
  ['/pages/templates.html', 'Template Management'],
  ['/pages/reports.html', 'Reports & Analytics'],
  ['/pages/settings.html', 'Settings'],
  ['/pages/profile.html', 'User Profile'],
  [`/pages/contact-profile.html?id=${data.ids.contact}`, 'Contact Profile']
];

for (const [path, heading] of pages) {
  test(`${heading} page loads through its real entry script`, async ({ rms }) => {
    await rms.page.goto(path);
    await expect(rms.page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  });
}

const keyboardTargets = [
  ['/pages/dashboard.html', '.user-menu', 'user menu'],
  ['/pages/groups.html', '.group-card-main', 'group card'],
  ['/pages/labels.html', '.var-chip', 'label variable chip']
];

for (const [path, selector, name] of keyboardTargets) {
  test(`${name} can be reached with the keyboard`, async ({ rms }) => {
    await rms.page.goto(path);
    const target = rms.page.locator(selector).first();
    await expect(target).toBeVisible();

    let reached = false;
    for (let index = 0; index < 60; index += 1) {
      await rms.page.keyboard.press('Tab');
      reached = await target.evaluate(element => document.activeElement === element);
      if (reached) break;
    }
    expect(reached).toBe(true);
  });
}

test('notification menu opens and its items are reachable with the keyboard', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  const trigger = rms.page.getByRole('button', { name: 'Notifications' });
  await trigger.focus();
  await rms.page.keyboard.press('Enter');

  const target = rms.page.locator('.notif-item').first();
  await expect(target).toBeVisible();
  await rms.page.keyboard.press('Tab');
  await expect(target).toBeFocused();
});

test('calendar tab and event date are reachable with the keyboard', async ({ rms }) => {
  await rms.page.goto('/pages/birthdays.html');
  const tab = rms.page.getByRole('tab', { name: 'Calendar' });
  await tab.focus();
  await rms.page.keyboard.press('Enter');
  await expect(tab).toHaveAttribute('aria-selected', 'true');

  const target = rms.page.locator('.calendar-day.has-event').first();
  await expect(target).toBeVisible();
  let reached = false;
  for (let index = 0; index < 50; index += 1) {
    await rms.page.keyboard.press('Tab');
    reached = await target.evaluate(element => document.activeElement === element);
    if (reached) break;
  }
  expect(reached).toBe(true);
});

test('group card opens with Enter, closes with Escape, and returns focus', async ({ rms }) => {
  await rms.page.goto('/pages/groups.html');
  const trigger = rms.page.locator('.group-card-main').first();
  await trigger.focus();
  await rms.page.keyboard.press('Enter');
  const modal = rms.page.locator('#membersModal');
  await expect(modal).toHaveClass(/show/);
  await expect(rms.page.locator('#modalMemberSearch')).toBeFocused();
  await rms.page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/show/);
  await expect(trigger).toBeFocused();
});

test('label variable chip inserts its value with Space', async ({ rms }) => {
  await rms.page.goto('/pages/labels.html');
  const chip = rms.page.locator('.var-chip').first();
  const field = rms.page.locator('#toFormat');
  const before = await field.inputValue();
  await chip.focus();
  await rms.page.keyboard.press('Space');
  await expect(field).not.toHaveValue(before);
});

test('contact table actions can be reached with the keyboard', async ({ rms }) => {
  await rms.page.goto('/pages/contacts.html');
  const target = rms.page.locator('#contactsTable tbody button').first();
  await expect(target).toBeVisible();

  let reached = false;
  for (let index = 0; index < 80; index += 1) {
    await rms.page.keyboard.press('Tab');
    reached = await target.evaluate(element => document.activeElement === element);
    if (reached) break;
  }
  expect(reached).toBe(true);
});

test('contact modal supports keyboard open, Escape close, and focus return', async ({ rms }) => {
  await rms.page.goto('/pages/contacts.html');
  const trigger = rms.page.getByRole('button', { name: 'Add Contact' });
  await trigger.focus();
  await rms.page.keyboard.press('Enter');
  const modal = rms.page.locator('#contactModal');
  await expect(modal).toHaveClass(/show/);
  await expect(rms.page.locator('#firstName')).toBeFocused();

  await rms.page.keyboard.press('Shift+Tab');
  expect(await modal.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await rms.page.getByText('First Name *', { exact: true }).click();
  await expect(rms.page.locator('#firstName')).toBeFocused();

  await rms.page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/show/);
  await expect(trigger).toBeFocused();
});

test('contact profile edit action opens the requested contact after navigation', async ({ rms }) => {
  await rms.page.goto('/pages/contact-profile.html?id=507f1f77bcf86cd799439011');
  await rms.page.getByRole('link', { name: 'Edit' }).click();

  await expect(rms.page).toHaveURL(/\/pages\/contacts\.html\?edit=507f1f77bcf86cd799439011$/);
  await expect(rms.page.locator('#contactModal')).toHaveClass(/show/);
  await expect(rms.page.locator('#firstName')).toHaveValue('Asha');
});

test('campaign report action navigates to delivery filtered by campaign', async ({ rms }) => {
  await rms.page.goto('/pages/campaigns.html');
  await rms.page.getByRole('link', { name: 'View delivery report' }).click();

  await expect(rms.page).toHaveURL(/\/pages\/delivery\.html\?campaignId=507f1f77bcf86cd799439014$/);
  await expect.poll(() => rms.api.requests.some(request => request.method === 'GET' && request.pathname === '/api/delivery/jobs' && request.search.includes('campaignId=507f1f77bcf86cd799439014'))).toBe(true);
});
