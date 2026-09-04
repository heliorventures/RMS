const { test, expect } = require('./fixtures/rmsTest');
const { data, preparePage } = require('./fixtures/browserHarness');

const collectSemanticIssues = page => page.evaluate(() => {
  const results = [];
  const describe = element => element.id ? `#${element.id}` : element.outerHTML.slice(0, 120);
  const applicationFields = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')]
    .filter(element => !element.closest('.dataTables_wrapper'));

  for (const field of applicationFields) {
    if (!field.id) results.push(`${describe(field)} has no id`);
    if (!field.name) results.push(`${describe(field)} has no name`);
    const labelled = Boolean(field.labels?.length || field.getAttribute('aria-label') || field.getAttribute('aria-labelledby'));
    if (!labelled) results.push(`${describe(field)} has no associated label`);
    const type = (field.getAttribute('type') || 'text').toLowerCase();
    if (field.tagName === 'INPUT' && ['text', 'email', 'password', 'search', 'tel', 'url'].includes(type) && !field.hasAttribute('autocomplete')) {
      results.push(`${describe(field)} has no autocomplete policy`);
    }
  }

  for (const button of document.querySelectorAll('button')) {
    const visibleText = button.textContent.trim();
    if (!visibleText && button.querySelector('i, svg') && !button.getAttribute('aria-label')) {
      results.push(`${describe(button)} icon-only button has no aria-label`);
    }
  }

  for (const dialog of document.querySelectorAll('.modal')) {
    const labelledBy = dialog.getAttribute('aria-labelledby');
    if (!labelledBy || !document.getElementById(labelledBy)) results.push(`${describe(dialog)} has no valid aria-labelledby`);
  }

  for (const table of document.querySelectorAll('table')) {
    if (!table.querySelector('caption')) results.push(`${describe(table)} has no caption`);
  }

  return results;
});

const pages = [
  '/pages/dashboard.html',
  '/pages/contacts.html',
  '/pages/groups.html',
  '/pages/birthdays.html',
  '/pages/anniversaries.html',
  '/pages/festivals.html',
  '/pages/invitations.html',
  '/pages/labels.html',
  '/pages/campaigns.html',
  '/pages/delivery.html',
  '/pages/templates.html',
  '/pages/reports.html',
  '/pages/settings.html',
  '/pages/profile.html',
  `/pages/contact-profile.html?id=${data.ids.contact}`
];

test('authenticated shell exposes skip navigation, current page, and named dropdown controls', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');

  const skipLink = rms.page.getByRole('link', { name: 'Skip to main content' });
  await expect(skipLink).toHaveAttribute('href', '#mainContent');
  await expect(rms.page.locator('main#mainContent')).toHaveCount(1);
  await expect(rms.page.locator('.sidebar-nav a[href="/pages/dashboard.html"]')).toHaveAttribute('aria-current', 'page');

  const notifications = rms.page.getByRole('button', { name: 'Notifications' });
  await expect(notifications).toHaveAttribute('aria-controls', 'notifDropdown');
  await notifications.click();
  await expect(notifications).toHaveAttribute('aria-expanded', 'true');

  const userMenu = rms.page.getByRole('button', { name: /account menu/i });
  await expect(userMenu).toHaveAttribute('aria-controls', 'userMenuDropdown');
});

for (const path of ['/index.html', '/pages/reset-password.html?token=test-token']) {
  test(`${path} exposes a main landmark and semantic form controls`, async ({ page }) => {
    await preparePage(page, { authenticated: false });
    await page.goto(path);
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#mainContent');
    await expect(page.locator('main#mainContent')).toHaveCount(1);
    const issues = await collectSemanticIssues(page);
    expect(issues, issues.join('\n')).toEqual([]);
  });
}

for (const path of pages) {
  test(`${path} exposes named controls, associated form labels, dialogs, and tables`, async ({ rms }) => {
    await rms.page.goto(path);
    await rms.page.locator('#pageBody').waitFor({ state: 'attached' });

    const issues = await collectSemanticIssues(rms.page);

    expect(issues, issues.join('\n')).toEqual([]);
  });
}
