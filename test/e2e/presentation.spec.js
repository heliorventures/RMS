const { AxeBuilder } = require('@axe-core/playwright');
const { test, expect } = require('./fixtures/rmsTest');
const { preparePage } = require('./fixtures/browserHarness');

const widths = [320, 375, 768, 1024, 1440];
const responsivePages = ['/pages/dashboard.html', '/pages/contacts.html', '/pages/groups.html', '/pages/labels.html'];

for (const width of widths) {
  for (const path of responsivePages) {
    test(`${path} has no document-level horizontal overflow at ${width}px`, async ({ rms }) => {
      await rms.page.setViewportSize({ width, height: 900 });
      await rms.page.goto(path);
      await rms.page.locator('#pageBody').waitFor({ state: 'attached' });

      const layout = await rms.page.evaluate(() => ({
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        overflowing: [...document.body.querySelectorAll('*')]
          .map(element => ({
            tag: element.tagName,
            id: element.id,
            className: typeof element.className === 'string' ? element.className : '',
            right: Math.ceil(element.getBoundingClientRect().right),
            width: Math.ceil(element.getBoundingClientRect().width)
          }))
          .filter(element => element.right > window.innerWidth + 1)
          .slice(0, 10)
      }));

      expect(layout.documentWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
      expect(layout.bodyWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
    });
  }
}

test('shared controls transition only explicit compositor-safe properties', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  const transitionProperties = await rms.page.locator('body, .sidebar, .sidebar-nav .nav-link, .header-btn, .stat-card, .quick-action').evaluateAll(elements =>
    elements.map(element => ({ selector: element.className || element.tagName, property: getComputedStyle(element).transitionProperty }))
  );

  expect(transitionProperties.filter(({ property }) => property === 'all'), JSON.stringify(transitionProperties)).toEqual([]);
});

test('reduced-motion preference disables nonessential interface motion', async ({ rms }) => {
  await rms.page.emulateMedia({ reducedMotion: 'reduce' });
  await rms.page.goto('/pages/dashboard.html');

  const motion = await rms.page.locator('body, .sidebar, .stat-card').evaluateAll(elements =>
    elements.map(element => ({
      selector: element.className || element.tagName,
      animationDuration: getComputedStyle(element).animationDuration,
      transitionDuration: getComputedStyle(element).transitionDuration
    }))
  );

  expect(motion.every(({ animationDuration, transitionDuration }) => animationDuration === '0.01s' && transitionDuration === '0.01s'), JSON.stringify(motion)).toBe(true);
});

test('keyboard focus uses the shared high-contrast focus-visible ring in both themes', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  const control = rms.page.getByRole('button', { name: 'Toggle theme' });
  const styles = await rms.page.evaluate(async () => {
    const control = document.querySelector('[aria-label="Toggle theme"]');
    const values = [];
    for (const theme of ['light', 'dark']) {
      document.documentElement.setAttribute('data-theme', theme);
      control.focus();
      const style = getComputedStyle(control);
      values.push({ theme, outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineOffset: style.outlineOffset });
    }
    return values;
  });

  expect(styles).toEqual([
    { theme: 'light', outlineStyle: 'solid', outlineWidth: '3px', outlineOffset: '3px' },
    { theme: 'dark', outlineStyle: 'solid', outlineWidth: '3px', outlineOffset: '3px' }
  ]);
});

test('header controls meet the 44px minimum touch target', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  const targets = await rms.page.locator('.header-btn, .user-menu').evaluateAll(elements =>
    elements.map(element => ({ name: element.getAttribute('aria-label') || element.className, rect: element.getBoundingClientRect().toJSON() }))
  );

  const visibleTargets = targets.filter(({ rect }) => rect.width > 0 && rect.height > 0);
  expect(visibleTargets.every(({ rect }) => rect.width >= 44 && rect.height >= 44), JSON.stringify(visibleTargets)).toBe(true);
});

test('label variable chips meet the 44px minimum touch target', async ({ rms }) => {
  await rms.page.goto('/pages/labels.html');
  const targets = await rms.page.locator('.label-format-panel .var-chip').evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().toJSON())
  );

  expect(targets.every(rect => rect.width >= 44 && rect.height >= 44), JSON.stringify(targets)).toBe(true);
});

test('the application uses touch-action manipulation', async ({ rms }) => {
  await rms.page.goto('/pages/dashboard.html');
  await expect(rms.page.locator('html')).toHaveCSS('touch-action', 'manipulation');
});

test('login has no color-contrast violations', async ({ page }) => {
  await preparePage(page, { authenticated: false });
  await page.goto('/index.html');

  const result = await new AxeBuilder({ page }).analyze();
  const contrastViolations = result.violations
    .filter(violation => violation.id === 'color-contrast')
    .map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => node.target) }));

  expect(contrastViolations, JSON.stringify(contrastViolations, null, 2)).toEqual([]);
});
