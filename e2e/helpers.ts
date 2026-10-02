import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';

const appVersion = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as { version: string }
).version;

// Every test starts from the same quiet state:
// - the "what's new" dialog is suppressed (it makes the start screen inert),
// - the PWA install banner is dismissed,
// - the report export goes through the download path instead of navigator.share,
// - external font / analytics requests are aborted so tests never depend on the network.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager\.com/, (route) => route.abort());
    await page.addInitScript((version) => {
      localStorage.setItem('icn-round:last-seen-version', version);
      localStorage.setItem('pwa_banner_dismissed', '1');
      navigator.canShare = () => false;
    }, appVersion);
    await use(page);
  },
});

export { expect };

// 8x8 red PNG. Only used to drive the photo pipeline (createImageBitmap -> canvas).
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGO4o6aGFTEMLQkAF/tKAS/fz4YAAAAASUVORK5CYII=';

const samplePhoto = {
  name: 'sample.png',
  mimeType: 'image/png',
  buffer: Buffer.from(SAMPLE_PNG_BASE64, 'base64'),
};

/** Selects the sample photo on the add-photo screen. */
export async function pickGalleryPhoto(page: Page) {
  // The gallery picker is the file input without the camera's capture attribute.
  await page.locator('input[type="file"]:not([capture])').setInputFiles(samplePhoto);
}

/** Fills in the start screen and starts a round. */
export async function startRound(page: Page, name: string, wardName?: string) {
  await page.goto('/');
  await page.getByPlaceholder('例: 山田 花子').fill(name);
  if (wardName) await page.getByPlaceholder('例: 3階東病棟').fill(wardName);
  await page.getByRole('button', { name: 'ラウンド開始' }).click();
}

/** The overall progress badge ("rated/total") in the main screen header. */
export function overallProgress(page: Page) {
  return page.getByRole('status');
}

/** Rating button of the first item in the first category, which is the only one open at round start. */
export function firstItemRating(page: Page, rating: 'A' | 'B' | 'C') {
  return page.getByRole('button', { name: rating, exact: true }).first();
}
