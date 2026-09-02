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
  ['/pages/dashboard.html', '.notif-item', 'notification item'],
  ['/pages/groups.html', '.group-card', 'group card'],
  ['/pages/birthdays.html', '.calendar-day.has-event', 'calendar day'],
  ['/pages/labels.html', '.var-chip', 'label variable chip']
];

for (const [path, selector, name] of keyboardTargets) {
  test(`${name} can be reached with the keyboard`, async ({ rms }) => {
    test.fail(true, 'Known accessibility defect scheduled for Frontend Task 4');
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
  await expect(modal).toBeFocused();

  await rms.page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/show/);
  await expect(trigger).toBeFocused();
});
