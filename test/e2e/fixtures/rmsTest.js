const { test: base, expect } = require('@playwright/test');
const { preparePage } = require('./browserHarness');

const test = base.extend({
  rms: async ({ page }, use) => {
    const api = await preparePage(page);
    await use({ page, api });
  }
});

module.exports = { test, expect };
