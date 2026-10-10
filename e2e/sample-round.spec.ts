import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { test, expect, overallProgress } from './helpers';

test('サンプルデータで試すと報告書を出力でき、トップに戻っても保存済みラウンドは増えない', async ({ page }) => {
  await page.goto('/');

  // No saved rounds yet, so the sample is offered prominently under the start form.
  await page.getByRole('button', { name: /サンプルデータで試す.*入力済みの例/ }).click();

  await expect(page.getByText('サンプルです（保存されません）')).toBeVisible();
  await expect(page.getByText('参加者: サンプル 太郎・【サンプル】3階東病棟')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toHaveCount(0);
  // Every item is already rated.
  await expect(overallProgress(page)).toHaveText(/^(\d+)\/\1$/);

  await page.getByRole('button', { name: 'レポート' }).click();
  await expect(page.getByRole('heading', { name: '【サンプル】感染対策ラウンド報告書' })).toBeVisible();
  await expect(page.getByText('（3枚）')).toBeVisible();

  const exportButton = page.getByRole('button', { name: 'Word出力' });
  await expect(exportButton).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);

  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const documentXml = await zip.file('word/document.xml')?.async('string');
  expect(documentXml).toContain('【サンプル】感染対策ラウンド報告書');
  expect(documentXml).toContain('サンプル 太郎');
  // The bundled sample photos are embedded (identical images may share one media file).
  expect(Object.keys(zip.files).some((p) => p.startsWith('word/media/'))).toBe(true);

  // Back on the start screen without the unsaved-changes dialog, and nothing was saved.
  await page.getByRole('button', { name: '戻る', exact: true }).click();
  await page.getByRole('button', { name: 'トップ画面に戻る' }).click();
  await expect(page.getByRole('heading', { name: 'トップ画面に戻りますか？' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ラウンド開始' })).toBeVisible();
  await expect(page.getByRole('button', { name: /保存済みラウンドを開く/ })).toHaveText(/^\s*保存済みラウンドを開く\s*$/);
  expect(await page.evaluate(() => localStorage.getItem('icn-round:saved-rounds'))).toBeNull();
  // The participant field is not pre-filled with the sample participant.
  await expect(page.getByPlaceholder('例: 山田 花子')).toHaveValue('');
  // Exporting the sample does not count as using the app, so the sample stays featured.
  await expect(page.getByRole('button', { name: /サンプルデータで試す.*入力済みの例/ })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('icn-round:round-used'))).toBeNull();
});
