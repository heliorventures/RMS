const { test, expect } = require('./fixtures/rmsTest');

test('settings shows write-only provider credentials and omits blank secrets from updates', async ({ rms }) => {
  await rms.page.goto('/pages/settings.html');
  await rms.page.getByRole('tab', { name: 'SMTP' }).click();
  await expect(rms.page.locator('#smtpCredentialState')).toContainText('Credential configured');
  await expect(rms.page.locator('#smtpPass')).toHaveAttribute('placeholder', 'Leave blank to keep the stored credential');
  await rms.page.getByRole('button', { name: 'Save SMTP' }).click();

  await rms.page.getByRole('tab', { name: 'WhatsApp' }).click();
  await expect(rms.page.locator('#whatsappCredentialState')).toContainText('Credential configured');
  await expect(rms.page.locator('#waKey')).toHaveAttribute('placeholder', 'Leave blank to keep the stored credential');
  await rms.page.getByRole('button', { name: 'Save WhatsApp' }).click();

  const updates = rms.api.requests.filter(request => request.method === 'PUT' && request.pathname === '/api/settings');
  expect(updates[0].body.smtp).not.toHaveProperty('password');
  expect(updates[1].body.whatsapp).not.toHaveProperty('apiKey');
});
