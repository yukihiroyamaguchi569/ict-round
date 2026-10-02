import { test, expect, startRound, overallProgress, firstItemRating } from './helpers';

test('保存したラウンドはトップに戻ってリロードした後も開き直せる', async ({ page }) => {
  await startRound(page, '山田 花子', '3階東病棟');

  await firstItemRating(page, 'A').click();
  await page.getByRole('button', { name: '総評', exact: true }).click();
  await page.getByRole('textbox').fill('・保存テスト用の総評です。');

  // The "保存済み" feedback disappears after 2 seconds, so the save is checked by the count after reload instead.
  await page.getByRole('button', { name: '保存', exact: true }).click();

  // Saved, so going home does not ask about unsaved changes.
  await page.getByRole('button', { name: 'トップ画面に戻る' }).click();
  await expect(page.getByRole('button', { name: 'ラウンド開始' })).toBeVisible();

  // Round data lives in React state only; a reload proves it was persisted to localStorage.
  await page.reload();
  const openSaved = page.getByRole('button', { name: /保存済みラウンドを開く/ });
  await expect(openSaved).toContainText('1');
  await openSaved.click();

  await expect(page.getByText('山田 花子 / 3階東病棟')).toBeVisible();
  await page.getByRole('button', { name: '開く' }).click();

  // Rating and evaluation are restored.
  await expect(overallProgress(page)).toHaveText(/^1\/\d+$/);
  await page.getByRole('button', { name: '総評', exact: true }).click();
  await expect(page.getByRole('textbox')).toHaveValue('・保存テスト用の総評です。');
});
