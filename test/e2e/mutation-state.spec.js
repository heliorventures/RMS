const { test, expect } = require('./fixtures/rmsTest');

test('runMutation prevents duplicate submission and restores button state', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  await rms.page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="mutationButton">Save</button><div id="mutationStatus"></div>');
    window.__mutationCalls = 0;
    window.__releaseMutation = null;
    const button = document.getElementById('mutationButton');
    const operation = () => {
      window.__mutationCalls += 1;
      return new Promise(resolve => { window.__releaseMutation = () => resolve({ success: true }); });
    };
    const run = () => window.RMS.mutations.runMutation(button, operation, {
      pending: 'Saving…',
      success: 'Saved successfully',
      statusTarget: '#mutationStatus'
    });
    button.addEventListener('click', run);
    button.click();
    button.click();
  });

  await expect(rms.page.locator('#mutationButton')).toBeDisabled();
  await expect(rms.page.locator('#mutationButton')).toHaveText('Saving…');
  expect(await rms.page.evaluate(() => window.__mutationCalls)).toBe(1);

  await rms.page.evaluate(() => window.__releaseMutation());
  await expect(rms.page.locator('#mutationButton')).toBeEnabled();
  await expect(rms.page.locator('#mutationButton')).toHaveText('Save');
  await expect(rms.page.locator('#mutationStatus')).toHaveAttribute('role', 'status');
  await expect(rms.page.locator('#mutationStatus')).toHaveAttribute('aria-live', 'polite');
  await expect(rms.page.locator('#mutationStatus')).toHaveText('Saved successfully');
});

test('runMutation renders a failed request inline and never reports success', async ({ rms }) => {
  rms.api.fail('POST', '/api/test-mutation', 500, 'Persistence failed');
  await rms.page.goto('/pages/dashboard.html');
  await rms.page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="failureButton">Save</button><div id="failureStatus"></div>');
    const button = document.getElementById('failureButton');
    button.addEventListener('click', () => window.RMS.mutations.runMutation(
      button,
      () => window.RMS.api.post('/test-mutation', {}),
      { pending: 'Saving…', success: 'Saved successfully', statusTarget: '#failureStatus' }
    ));
  });

  await rms.page.evaluate(() => document.getElementById('failureButton').click());

  await expect(rms.page.locator('#failureStatus')).toHaveAttribute('role', 'alert');
  await expect(rms.page.locator('#failureStatus')).toHaveText('Persistence failed');
  await expect(rms.page.locator('#failureButton')).toBeEnabled();
  await expect(rms.page.getByText('Saved successfully', { exact: true })).toHaveCount(0);
});
