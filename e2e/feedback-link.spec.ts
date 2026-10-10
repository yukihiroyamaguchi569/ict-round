import { test, expect } from './helpers';

// The narrowest phone width the start screen is designed for
test.use({ viewport: { width: 360, height: 740 } });

for (const [state, roundUsed] of [
  ['sample featured under the form', false],
  ['sample among the bottom links', true],
] as const) {
  test(`bottom links wrap within 360px with the ${state}`, async ({ page }) => {
    if (roundUsed) await page.addInitScript(() => localStorage.setItem('icn-round:round-used', '1'));
    await page.goto('./');

    const feedback = page.getByRole('link', { name: 'ご意見・ご要望' });
    await expect(feedback).toBeVisible();
    await expect(page.getByRole('button', { name: 'サンプルデータで試す' })).toBeVisible();

    // No horizontal scrolling of the page
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Every link of the row sits inside the screen, each on a single line
    const row = feedback.locator('..');
    for (const item of await row.locator(':scope > *').all()) {
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
      expect(box.height).toBeLessThan(24);
    }
  });
}
