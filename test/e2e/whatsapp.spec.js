const { test, expect } = require('./fixtures/rmsTest');
const { ids, template } = require('./fixtures/sampleData');

test('template editor saves Meta mapping and ordered body parameters', async ({ rms }) => {
  await rms.page.goto('/pages/templates.html');
  await rms.page.getByRole('button', { name: 'New Template' }).click();
  await rms.page.locator('#tmplName').fill('WhatsApp birthday');
  await rms.page.locator('#tmplBody').fill('Birthday greeting');
  await rms.page.getByText('WhatsApp / Meta template mapping', { exact: true }).click();
  await rms.page.locator('#tmplWaName').fill('birthday_greeting');
  await rms.page.locator('#tmplWaLanguage').fill('en_US');
  await rms.page.locator('#tmplWaParams').fill('{{Name}}\nRMS');
  await rms.page.getByRole('button', { name: 'Save Template', exact: true }).click();
  await expect.poll(() => rms.api.requests.find(r => r.method === 'POST' && r.pathname === '/api/templates')?.body.whatsapp).toEqual({ name: 'birthday_greeting', language: 'en_US', bodyParameters: ['{{Name}}', 'RMS'] });
});
test('settings test picker queues selected mapping without claiming delivery', async ({ rms }) => {
  rms.api.respond('GET', '/api/templates', { success: true, data: [{ ...template, whatsapp: { name: 'hello_world', language: 'en_US', bodyParameters: [] } }] });
  rms.api.respond('POST', '/api/delivery/test-whatsapp', { success: true, data: { _id: ids.job } });
  await rms.page.goto('/pages/settings.html');
  await rms.page.getByRole('tab', { name: 'WhatsApp' }).click();
  await rms.page.locator('#waTestNumber').fill('+919876543210');
  await rms.page.getByRole('button', { name: 'Choose template and queue test' }).click();
  await expect(rms.page.getByRole('dialog', { name: 'Choose WhatsApp template' })).toBeVisible();
  await rms.page.getByRole('button', { name: 'Use template' }).click();
  await expect.poll(() => rms.api.requests.find(r => r.pathname === '/api/delivery/test-whatsapp')?.body.templateId).toBe(ids.template);
  await expect(rms.page.getByText('Test queued. Follow its status in Delivery; queueing does not confirm delivery.')).toBeVisible();
});
test('contact profile records permission with explicit source and phone snapshot', async ({ rms }) => {
  const endpoint = `/api/contacts/${ids.contact}/whatsapp-consent`;
  rms.api.respond('GET', endpoint, { success: true, data: { phone: '919876543210', status: 'unknown' } });
  rms.api.respond('PUT', endpoint, { success: true, data: { phone: '919876543210', status: 'granted' } });
  await rms.page.goto(`/pages/contact-profile.html?id=${ids.contact}`);
  await expect(rms.page.locator('#waConsentState')).toContainText('unknown');
  await rms.page.locator('#waConsentSource').fill('Signup form ref 123');
  await rms.page.getByRole('button', { name: 'Record permission', exact: true }).click();
  await expect.poll(() => rms.api.requests.find(r => r.method === 'PUT' && r.pathname === endpoint)?.body).toEqual({ phone: '919876543210', status: 'granted', source: 'Signup form ref 123' });
});

test('campaign template picker works inside its modal and cancelling creates no campaign', async ({ rms }) => {
  rms.api.respond('GET', '/api/templates', { success: true, data: [{ ...template, whatsapp: { name: 'hello_world', language: 'en_US' } }] });
  await rms.page.goto('/pages/campaigns.html');
  await rms.page.getByRole('button', { name: 'Create Campaign', exact: true }).click();
  await rms.page.locator('#campName').fill('WhatsApp campaign');
  await rms.page.locator('#campChannel').selectOption('whatsapp');
  await rms.page.getByRole('button', { name: 'Schedule', exact: true }).click();
  const picker = rms.page.getByRole('dialog', { name: 'Choose WhatsApp template', exact: true });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(picker).not.toBeVisible();
  expect(rms.api.requests.filter(r => r.method === 'POST' && r.pathname === '/api/campaigns')).toHaveLength(0);
  await rms.page.getByRole('button', { name: 'Schedule', exact: true }).click();
  await picker.getByRole('button', { name: 'Use template' }).click();
  await expect.poll(() => rms.api.requests.find(r => r.method === 'POST' && r.pathname === '/api/delivery/jobs')?.body.templateId).toBe(ids.template);
});
