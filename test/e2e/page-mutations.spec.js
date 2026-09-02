const { test, expect } = require('./fixtures/rmsTest');

async function expectFailureWithoutSuccess(page, scope, errorMessage, successMessage) {
  await expect(scope.getByRole('alert')).toContainText(errorMessage);
  await expect(page.getByText(successMessage, { exact: true })).toHaveCount(0);
}

test('profile save failure remains inline and does not report success', async ({ rms }) => {
  rms.api.fail('PUT', '/api/auth/profile', 500, 'Profile persistence failed');
  await rms.page.goto('/pages/profile.html');
  await rms.page.getByRole('button', { name: 'Update Profile' }).click();

  await expectFailureWithoutSuccess(rms.page, rms.page.locator('#profileForm'), 'Profile persistence failed', 'Profile updated');
});

test('template save failure remains inline and keeps the editor open', async ({ rms }) => {
  rms.api.fail('POST', '/api/templates', 500, 'Template persistence failed');
  await rms.page.goto('/pages/templates.html');
  await rms.page.getByRole('button', { name: 'New Template' }).click();
  await rms.page.locator('#tmplName').fill('Failure Test Template');
  await rms.page.locator('#tmplBody').fill('Hello {{Name}}');
  await rms.page.getByRole('button', { name: 'Save Template' }).click();

  await expectFailureWithoutSuccess(rms.page, rms.page.locator('#templateForm'), 'Template persistence failed', 'Template saved');
  await expect(rms.page.locator('#templateModal')).toHaveClass(/show/);
});

test('campaign save failure remains inline and keeps the editor open', async ({ rms }) => {
  rms.api.fail('POST', '/api/campaigns', 500, 'Campaign persistence failed');
  await rms.page.goto('/pages/campaigns.html');
  await rms.page.getByRole('button', { name: 'Create Campaign' }).click();
  await rms.page.locator('#campName').fill('Failure Test Campaign');
  await rms.page.getByRole('button', { name: 'Save Draft' }).click();

  await expectFailureWithoutSuccess(rms.page, rms.page.locator('#campaignForm'), 'Campaign persistence failed', 'Campaign saved as draft');
  await expect(rms.page.locator('#campaignModal')).toHaveClass(/show/);
});

test('group save failure remains inline and keeps the editor open', async ({ rms }) => {
  rms.api.fail('POST', '/api/groups', 500, 'Group persistence failed');
  await rms.page.goto('/pages/groups.html');
  await rms.page.getByRole('button', { name: 'Create Group' }).click();
  await rms.page.locator('#groupName').fill('Failure Test Group');
  await rms.page.locator('#groupType').selectOption('dynamic');
  await rms.page.locator('#ruleValue').fill('Pune');
  await rms.page.getByRole('button', { name: 'Save Group' }).click();

  await expectFailureWithoutSuccess(rms.page, rms.page.locator('#groupForm'), 'Group persistence failed', 'Group created');
  await expect(rms.page.locator('#groupModal')).toHaveClass(/show/);
});

test('settings save failure remains inline and does not report success', async ({ rms }) => {
  rms.api.fail('PUT', '/api/settings', 500, 'Settings persistence failed');
  await rms.page.goto('/pages/settings.html');
  await rms.page.getByRole('button', { name: 'Save Company Details' }).click();

  await expectFailureWithoutSuccess(rms.page, rms.page.locator('#companyForm'), 'Settings persistence failed', 'Settings saved successfully');
});

test('SMTP test does not contact the provider when saving settings fails', async ({ rms }) => {
  rms.api.fail('PUT', '/api/settings', 500, 'SMTP settings were not saved');
  await rms.page.goto('/pages/settings.html');
  await rms.page.getByRole('tab', { name: 'SMTP' }).click();
  await rms.page.getByRole('button', { name: 'Test Connection' }).click();

  await expect(rms.page.getByRole('alert')).toContainText('SMTP settings were not saved');
  expect(rms.api.requests.filter(request => request.method === 'POST' && request.pathname === '/api/delivery/test-email')).toHaveLength(0);
  await expect(rms.page.getByText('Test email sent successfully', { exact: true })).toHaveCount(0);
});

test('invitation save failure remains inline and keeps the editor open', async ({ rms }) => {
  rms.api.fail('POST', '/api/events', 500, 'Invitation persistence failed');
  await rms.page.goto('/pages/invitations.html');
  await rms.page.getByRole('button', { name: 'Create Event' }).click();
  await rms.page.locator('#eventTitle').fill('Failure Test Invitation');
  await rms.page.getByRole('button', { name: 'Save', exact: true }).click();

  await expectFailureWithoutSuccess(rms.page, rms.page.locator('#eventForm'), 'Invitation persistence failed', 'Invitation created');
  await expect(rms.page.locator('#eventModal')).toHaveClass(/show/);
});

test('festival save failure remains inline and keeps the editor open', async ({ rms }) => {
  rms.api.fail('POST', '/api/festivals', 500, 'Festival persistence failed');
  await rms.page.goto('/pages/festivals.html');
  await rms.page.getByRole('button', { name: 'Add Festival' }).click();
  await rms.page.locator('#festName').fill('Failure Test Festival');
  await rms.page.locator('#festDate').fill('2026-11-08');
  await rms.page.getByRole('button', { name: 'Save', exact: true }).click();

  await expectFailureWithoutSuccess(rms.page, rms.page.locator('#festivalForm'), 'Festival persistence failed', 'Festival created');
  await expect(rms.page.locator('#festivalModal')).toHaveClass(/show/);
});

test('invitation send reports when delivery queued but status persistence failed', async ({ rms }) => {
  rms.api.fail('PUT', '/api/events/507f1f77bcf86cd799439015', 500, 'Invitation status persistence failed');
  await rms.page.goto('/pages/invitations.html');
  await rms.page.getByRole('button', { name: 'Create Event' }).click();
  await rms.page.locator('#eventTitle').fill('Partial Invitation');
  await rms.page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(rms.page.locator('#eventForm').getByRole('alert')).toContainText('Delivery was queued, but invitation status could not be updated');
  expect(rms.api.requests.filter(request => request.method === 'POST' && request.pathname === '/api/delivery/jobs')).toHaveLength(1);
  await expect(rms.page.getByText('Invitation queued for delivery', { exact: true })).toHaveCount(0);
  await expect(rms.page.locator('#eventModal')).toHaveClass(/show/);
});

test('festival send reports when delivery queued but status persistence failed', async ({ rms }) => {
  rms.api.fail('PUT', '/api/festivals/507f1f77bcf86cd799439016', 500, 'Festival status persistence failed');
  await rms.page.goto('/pages/festivals.html');
  await rms.page.getByRole('button', { name: 'Add Festival' }).click();
  await rms.page.locator('#festName').fill('Partial Festival');
  await rms.page.getByRole('button', { name: 'Send', exact: true }).click();

  await expect(rms.page.locator('#festivalForm').getByRole('alert')).toContainText('Delivery was queued, but festival status could not be updated');
  expect(rms.api.requests.filter(request => request.method === 'POST' && request.pathname === '/api/delivery/jobs')).toHaveLength(1);
  await expect(rms.page.getByText('Festival message queued for delivery', { exact: true })).toHaveCount(0);
  await expect(rms.page.locator('#festivalModal')).toHaveClass(/show/);
});

test('birthday provider failure reports an error and never reports queued', async ({ rms }) => {
  rms.api.fail('POST', '/api/delivery/jobs', 500, 'Email provider unavailable');
  await rms.page.goto('/pages/birthdays.html');
  await rms.page.getByRole('button', { name: 'Email', exact: true }).first().click();

  await expect(rms.page.getByRole('alert')).toContainText('Email provider unavailable');
  await expect(rms.page.getByText(/Queued \d+ message/)).toHaveCount(0);
});

test('label format failure reports an error and never reports saved', async ({ rms }) => {
  rms.api.fail('PUT', '/api/settings', 500, 'Label format persistence failed');
  await rms.page.goto('/pages/labels.html');
  await rms.page.getByRole('button', { name: 'Save Format' }).click();

  await expect(rms.page.getByRole('alert')).toContainText('Label format persistence failed');
  await expect(rms.page.getByText('Label format saved', { exact: true })).toHaveCount(0);
});

test('user save failure remains inline and keeps the editor open', async ({ rms }) => {
  rms.api.fail('POST', '/api/settings/users', 500, 'User persistence failed');
  await rms.page.goto('/pages/settings.html');
  await rms.page.getByRole('tab', { name: 'Users' }).click();
  await rms.page.getByRole('button', { name: 'Add User' }).click();
  await rms.page.locator('#userName').fill('Failure Test User');
  await rms.page.locator('#userEmail').fill('failure@example.com');
  await rms.page.locator('#userPassword').fill('password123');
  await rms.page.getByRole('button', { name: 'Save User' }).click();

  await expectFailureWithoutSuccess(rms.page, rms.page.locator('#userForm'), 'User persistence failed', 'User created');
  await expect(rms.page.locator('#userModal')).toHaveClass(/show/);
});

test('delivery retry failure stays in the job panel and never reports requeued', async ({ rms }) => {
  rms.api.fail('POST', '/api/delivery/jobs/507f1f77bcf86cd799439017/retry-failed', 500, 'Retry service unavailable');
  await rms.page.goto('/pages/delivery.html');
  await expect(rms.page.locator('#jobDetailCard')).toBeVisible();
  await rms.page.locator('#retryBtn').evaluate(button => { button.disabled = false; });
  await rms.page.getByRole('button', { name: 'Retry Failed' }).click();

  await expect(rms.page.locator('#jobDetailCard').getByRole('alert')).toContainText('Retry service unavailable');
  await expect(rms.page.getByText(/messages requeued/)).toHaveCount(0);
});

test('bulk import failure stays in the upload modal and never reports imported', async ({ rms }) => {
  rms.api.fail('POST', '/api/contacts/bulk-import', 500, 'Bulk import unavailable');
  await rms.page.goto('/pages/contacts.html');
  await rms.page.getByRole('button', { name: 'Bulk Upload' }).click();
  await rms.page.locator('#bulkCsvFile').setInputFiles({
    name: 'contacts.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('firstName,lastName,email\nMeera,Shah,meera@example.com')
  });
  await rms.page.getByRole('button', { name: 'Upload Contacts' }).click();

  await expect(rms.page.locator('#bulkUploadModal').getByRole('alert')).toContainText('Bulk import unavailable');
  await expect(rms.page.getByText(/Successfully imported/)).toHaveCount(0);
});
