import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { test, expect, startRound, pickGalleryPhoto, overallProgress, firstItemRating } from './helpers';

const INSPECTOR = '山田 花子';
const WARD = '3階東病棟';
const EVALUATION = '・手指衛生の遵守状況は良好でした。';
const PHOTO_COMMENT = 'シンク周りの水はね';
// Current name is ICTround_YYYY-MM-DD.docx; a short random suffix (_xxxx) is also accepted.
const DOCX_NAME = /^ICTround_\d{4}-\d{2}-\d{2}(_[0-9A-Za-z]{1,4})?\.docx$/;

test('開始から評価・写真・総評を経て Word 出力した docx に入力内容が入る', async ({ page }) => {
  await startRound(page, INSPECTOR, WARD);
  await expect(page.getByText(`参加者: ${INSPECTOR}・${WARD}`)).toBeVisible();

  // Rate the first item.
  await expect(overallProgress(page)).toHaveText(/^0\/\d+$/);
  await firstItemRating(page, 'A').click();
  await expect(overallProgress(page)).toHaveText(/^1\/\d+$/);

  // Add one general photo with a comment.
  await page.getByRole('button', { name: '写真', exact: true }).click();
  await expect(page.getByText('写真はまだありません')).toBeVisible();
  await page.getByRole('button', { name: '写真を追加' }).click();
  await pickGalleryPhoto(page);
  const submit = page.getByRole('button', { name: '追加する' });
  await expect(submit).toBeEnabled();
  await page.getByLabel('コメント').fill(PHOTO_COMMENT);
  await submit.click();
  await expect(page.getByText('汎用写真')).toBeVisible();
  await expect(page.getByText(PHOTO_COMMENT)).toBeVisible();

  // Write the overall evaluation.
  await page.getByRole('button', { name: '総評', exact: true }).click();
  await page.getByRole('textbox').fill(EVALUATION);

  // The preview reflects the input.
  await page.getByRole('button', { name: 'レポート' }).click();
  await expect(page.getByRole('heading', { name: '感染対策ラウンド報告書' })).toBeVisible();
  await expect(page.getByText(/^1\/\d+項目$/)).toBeVisible();
  await expect(page.getByText('（1枚）')).toBeVisible();
  await expect(page.getByText(EVALUATION)).toBeVisible();

  // Export: the button turns from "準備中…" to "Word出力" once the docx is built.
  const exportButton = page.getByRole('button', { name: 'Word出力' });
  await expect(exportButton).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  expect(download.suggestedFilename()).toMatch(DOCX_NAME);

  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const documentXml = await zip.file('word/document.xml')?.async('string');
  expect(documentXml).toBeDefined();
  expect(documentXml).toContain(INSPECTOR);
  expect(documentXml).toContain(WARD);
  expect(documentXml).toContain(EVALUATION);
  expect(documentXml).toContain(PHOTO_COMMENT);
  // The photo itself is embedded as media.
  expect(Object.keys(zip.files).some((p) => p.startsWith('word/media/'))).toBe(true);
});

test('同じ評価をもう一度押すと未評価に戻る', async ({ page }) => {
  await startRound(page, INSPECTOR);

  await firstItemRating(page, 'A').click();
  await expect(overallProgress(page)).toHaveText(/^1\/\d+$/);

  // Switching to another rating keeps the item rated.
  await firstItemRating(page, 'B').click();
  await expect(overallProgress(page)).toHaveText(/^1\/\d+$/);

  await firstItemRating(page, 'B').click();
  await expect(overallProgress(page)).toHaveText(/^0\/\d+$/);
});
