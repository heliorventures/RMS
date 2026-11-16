const { test, expect } = require('./fixtures/rmsTest');
const data = require('./fixtures/sampleData');
test.use({ video: 'off', trace: 'off' });

test('new contact session clears validation state from the previous attempt', async ({ rms }) => {
  await rms.page.goto('/pages/contacts.html');
  await rms.page.getByRole('button', { name: 'Add Contact', exact: true }).click();
  await rms.page.getByRole('button', { name: 'Save Contact', exact: true }).click();
  await expect(rms.page.locator('#contactForm').getByRole('alert')).toBeVisible();
  await rms.page.locator('#contactModal').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(rms.page.locator('#contactModal')).toBeHidden();
  await rms.page.getByRole('button', { name: 'Add Contact', exact: true }).click();
  await expect(rms.page.locator('#contactForm').getByRole('alert')).toHaveCount(0);
  await expect(rms.page.locator('#firstName')).not.toHaveAttribute('aria-invalid', 'true');
});

test('contact filters include persisted values outside the configured creation choices', async ({ rms }) => {
  rms.api.respond('GET', '/api/contacts/filter-options', { success: true, data: { city: ['Pune', 'Chennai'], sector: ['Government', 'Education'], religion: ['Hindu'] } });
  await rms.page.goto('/pages/contacts.html?city=Chennai&sector=Education');
  await expect(rms.page.locator('#filterCity')).toHaveValue('Chennai');
  await expect(rms.page.locator('#filterSector')).toHaveValue('Education');
  expect(await rms.page.locator('#city option').allTextContents()).not.toContain('Chennai');
});

test('contact CSV export downloads phone prefixes through the authenticated API', async ({ rms }) => {
  let authorization;
  const csv = 'First Name,Last Name,Mobile\nAsha,Patil,+919876543210\n';
  await rms.page.route('**/api/exports/export-job/download', route => {
    authorization = route.request().headers().authorization;
    return route.fulfill({ status: 200, contentType: 'text/csv', body: csv });
  });
  await rms.page.goto('/pages/contacts.html');
  const downloadPromise = rms.page.waitForEvent('download');
  await rms.page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(authorization).toBe('Bearer e2e-token');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe(csv);
});

test('real label PDF raster contains text and all outer borders across every preset and layout', async ({ rms }) => {
  test.setTimeout(120000);
  await rms.page.goto(`/pages/contact-profile.html?id=${data.ids.contact}`);
  await rms.page.getByRole('link', { name: 'Print Label', exact: true }).click();
  await expect(rms.page.locator('#selectedCount')).toHaveText('1 selected');
  await rms.page.addScriptTag({ url: '/assets/vendor/html2pdf/html2pdf.bundle.min.js' });
  await rms.page.evaluate(() => {
    const original = window.html2pdf;
    window.__labelRasters = [];
    original.Worker.prototype.save = function () {
        return this.toCanvas().get('canvas').then(canvas => {
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let ink = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 150 && pixels[i + 1] < 150 && pixels[i + 2] < 150 && pixels[i + 3]) ink++;
          const columnInk = [];
          for (let x = 0; x < Math.min(8, canvas.width); x++) {
            let count = 0;
            for (let y = 0; y < canvas.height; y++) {
              const i = (y * canvas.width + x) * 4;
              if (pixels[i] < 240 && pixels[i + 1] < 240 && pixels[i + 2] < 240 && pixels[i + 3]) count++;
            }
            columnInk.push(count);
          }
          window.__labelRasters.push({ width: canvas.width, height: canvas.height, ink, columnInk });
        }).toPdf().get('pdf').then(pdf => { window.__labelPdfBytes = pdf.output('arraybuffer').byteLength; });
    };
  });
  for (const preset of ['envelope', 'giftMedium', 'giftLarge', 'sticker', 'custom']) {
    await rms.page.locator('#sizePreset').selectOption(preset);
    for (const layout of ['stacked', 'side', 'toOnly', 'fromOnly']) {
      await rms.page.locator('#labelLayout').selectOption(layout);
      const before = await rms.page.evaluate(() => window.__labelRasters.length);
      await rms.page.locator('#downloadPdfBtn').click();
      await expect.poll(() => rms.page.evaluate(() => window.__labelRasters.length), { timeout: 30000 }).toBe(before + 1);
      const raster = await rms.page.evaluate(() => window.__labelRasters.at(-1));
      expect(raster.ink, `${preset}/${layout} text ink`).toBeGreaterThan(100);
      expect(Math.max(...raster.columnInk), `${preset}/${layout} left border`).toBeGreaterThan(50);
      await expect.poll(() => rms.page.evaluate(() => window.__labelPdfBytes || 0)).toBeGreaterThan(1000);
    }
  }
});

test('downloaded label HTML keeps all four borders and address text', async ({ rms }) => {
  await rms.page.goto(`/pages/labels.html?ids=${data.ids.contact}`);
  await expect(rms.page.locator('#selectedCount')).toHaveText('1 selected');
  await rms.page.locator('#labelLayout').selectOption('side');
  const downloadPromise = rms.page.waitForEvent('download');
  await rms.page.locator('#downloadHtmlBtn').click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  await rms.page.setContent(Buffer.concat(chunks).toString());
  await expect(rms.page.locator('.print-label')).toContainText('Asha Patil');
  const borders = await rms.page.locator('.print-label').evaluate(label => {
    const style = getComputedStyle(label);
    return ['Top', 'Right', 'Bottom', 'Left'].map(side => ({ width: parseFloat(style[`border${side}Width`]), style: style[`border${side}Style`] }));
  });
  for (const border of borders) expect(border).toEqual({ width: 1, style: 'solid' });
  const screenshot = await rms.page.locator('.print-label').screenshot();
  const leftEdgePixels = await rms.page.evaluate(async dataUrl => {
    const image = new Image(); image.src = dataUrl; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, 1, canvas.height).data;
    let ink = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 240 && pixels[i + 1] < 240 && pixels[i + 2] < 240) ink++;
    return ink;
  }, `data:image/png;base64,${screenshot.toString('base64')}`);
  expect(leftEdgePixels).toBeGreaterThan(50);
});
