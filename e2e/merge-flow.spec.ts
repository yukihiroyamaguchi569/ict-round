import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import type { Page } from '@playwright/test';
import { test, expect, startRound, firstItemRating } from './helpers';

const INSPECTOR = '山田 花子';
const WARD_1 = '3階東病棟';
const WARD_2 = '5階西病棟';
const MERGED_DOCX_NAME = /^ICTround_merged_\d{4}-\d{2}-\d{2}\.docx$/;

/** Rates the first item, opens the report and returns the exported .docx (with the round data embedded). */
async function exportRatedRound(page: Page, rating: 'A' | 'C') {
  await firstItemRating(page, rating).click();
  await page.getByRole('button', { name: 'レポート' }).click();
  const exportButton = page.getByRole('button', { name: 'Word出力' });
  await expect(exportButton).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  return readFileSync(await download.path());
}

test('2 病棟の報告書を統合ページで読み込むと、両病棟の入った 1 本の docx を出力できる', async ({ page }) => {
  await startRound(page, INSPECTOR, WARD_1);
  const docx1 = await exportRatedRound(page, 'A');

  // Back to the start screen through the UI; the round is unsaved, so the leave dialog appears.
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.getByRole('button', { name: 'トップ画面に戻る' }).click();
  await page.getByRole('button', { name: '保存せずに戻る' }).click();
  await expect(page.getByRole('button', { name: 'ラウンド開始' })).toBeVisible();

  await page.getByPlaceholder('例: 山田 花子').fill(INSPECTOR);
  await page.getByPlaceholder('例: 3階東病棟').fill(WARD_2);
  await page.getByRole('button', { name: 'ラウンド開始' }).click();
  await expect(page.getByText(`参加者: ${INSPECTOR}・${WARD_2}`)).toBeVisible();
  const docx2 = await exportRatedRound(page, 'C');

  await page.goto('/merge.html');
  await expect(page.getByRole('heading', { name: 'ラウンド報告書の統合' })).toBeVisible();
  const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await page.locator('input[type="file"]').setInputFiles([
    { name: 'ward1.docx', mimeType, buffer: docx1 },
    { name: 'ward2.docx', mimeType, buffer: docx2 },
  ]);

  await expect(page.getByRole('heading', { name: /読み込んだ報告書（2件）/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: WARD_1 })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: WARD_2 })).toBeVisible();

  const exportButton = page.getByRole('button', { name: 'Word出力' });
  await expect(exportButton).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  expect(download.suggestedFilename()).toMatch(MERGED_DOCX_NAME);

  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const documentXml = await zip.file('word/document.xml')?.async('string');
  expect(documentXml).toBeDefined();
  expect(documentXml).toContain(WARD_1);
  expect(documentXml).toContain(WARD_2);
});

test('開始画面のリンクから統合ページが新しいタブで開く', async ({ page, context }) => {
  // The fixture blocks external requests on its own page only; the new tab needs the same.
  await context.route(/fonts\.(googleapis|gstatic)\.com|googletagmanager\.com/, (route) => route.abort());
  await page.goto('/');

  const [mergePage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('link', { name: '開く', exact: true }).click(),
  ]);

  await expect(mergePage).toHaveURL(/\/merge\.html$/);
  await expect(mergePage.getByRole('heading', { name: 'ラウンド報告書の統合' })).toBeVisible();
});
