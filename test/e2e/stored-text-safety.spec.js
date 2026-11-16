const { test, expect } = require('./fixtures/rmsTest');
const data = require('./fixtures/sampleData');
const markup = '<img src=x onerror="window.__storedMarkupExecuted=true">';

test('template names, subjects, bodies and variables remain plain text', async ({ rms }) => {
  rms.api.respond('GET', '/api/templates', { success: true, data: [{ ...data.template, name: markup, subject: markup, body: markup, variables: [markup] }] });
  await rms.page.goto('/pages/templates.html');
  await expect(rms.page.locator('#templateGrid')).toContainText(markup);
  await expect(rms.page.locator('#templateGrid img')).toHaveCount(0);
  expect(await rms.page.evaluate(() => window.__storedMarkupExecuted)).toBeUndefined();
});

test('festival names and messages remain plain text', async ({ rms }) => {
  rms.api.respond('GET', '/api/festivals', { success: true, data: [{ ...data.festival, name: markup, message: markup }] });
  await rms.page.goto('/pages/festivals.html');
  await expect(rms.page.locator('#festivalGrid')).toContainText(markup);
  await expect(rms.page.locator('#festivalGrid img')).toHaveCount(0);
  expect(await rms.page.evaluate(() => window.__storedMarkupExecuted)).toBeUndefined();
});

test('dashboard contact names and communication snippets remain plain text', async ({ rms }) => {
  const contact = { ...data.contact, firstName: markup };
  rms.api.respond('GET', '/api/dashboard/stats', { success: true, data: { ...data.dashboard, recentContacts: [contact], todayBirthdaysList: [contact], recentActivities: [{ type: 'email', contactName: markup, message: markup, sentAt: '2026-11-16T04:30:00Z' }] } });
  await rms.page.goto('/pages/dashboard.html');
  await expect(rms.page.locator('#pageBody')).toContainText(markup);
  await expect(rms.page.locator('#pageBody img')).toHaveCount(0);
  expect(await rms.page.evaluate(() => window.__storedMarkupExecuted)).toBeUndefined();
});

test('label recipient chips and search results remain plain text', async ({ rms }) => {
  const contact = { ...data.contact, firstName: markup, company: markup };
  rms.api.respond('POST', '/api/contacts/bulk-lookup', { success: true, data: [contact] });
  rms.api.respond('GET', '/api/contacts', { success: true, data: [contact] });
  await rms.page.goto(`/pages/labels.html?ids=${data.ids.contact}`);
  await expect(rms.page.locator('#selectedChips')).toContainText(markup);
  await expect(rms.page.locator('#selectedChips img')).toHaveCount(0);
  await rms.page.locator('#contactSearch').fill('Asha');
  await expect(rms.page.locator('#searchResults')).toContainText(markup);
  await expect(rms.page.locator('#searchResults img')).toHaveCount(0);
  expect(await rms.page.evaluate(() => window.__storedMarkupExecuted)).toBeUndefined();
});
