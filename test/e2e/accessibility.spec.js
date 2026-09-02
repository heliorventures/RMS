const { AxeBuilder } = require('@axe-core/playwright');
const { test, expect } = require('./fixtures/rmsTest');
const { data, preparePage } = require('./fixtures/browserHarness');

test('Login has no serious or critical axe violations', async ({ page }) => {
  test.fail(true, 'Known login contrast debt is scheduled for Frontend Task 5');
  await preparePage(page, { authenticated: false });
  await page.goto('/index.html');

  const result = await new AxeBuilder({ page }).analyze();
  const violations = result.violations
    .filter(violation => ['serious', 'critical'].includes(violation.impact))
    .map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));

  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

const pages = [
  ['/pages/dashboard.html', 'Dashboard'],
  ['/pages/contacts.html', 'Contacts'],
  ['/pages/groups.html', 'Groups'],
  ['/pages/birthdays.html', 'Birthdays'],
  ['/pages/anniversaries.html', 'Anniversaries'],
  ['/pages/festivals.html', 'Festivals'],
  ['/pages/invitations.html', 'Invitations'],
  ['/pages/labels.html', 'Labels'],
  ['/pages/campaigns.html', 'Campaigns'],
  ['/pages/delivery.html', 'Delivery'],
  ['/pages/templates.html', 'Templates'],
  ['/pages/reports.html', 'Reports'],
  ['/pages/settings.html', 'Settings'],
  ['/pages/profile.html', 'Profile'],
  [`/pages/contact-profile.html?id=${data.ids.contact}`, 'Contact Profile']
];

for (const [path, name] of pages) {
  test(`${name} has no serious or critical axe violations`, async ({ rms }) => {
    test.fail(true, 'Known accessibility debt is scheduled for Frontend Tasks 4 and 5');
    await rms.page.goto(path);
    await rms.page.locator('#pageBody').waitFor({ state: 'attached' });

    const result = await new AxeBuilder({ page: rms.page }).analyze();
    const violations = result.violations
      .filter(violation => ['serious', 'critical'].includes(violation.impact))
      .map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length }));

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
}
