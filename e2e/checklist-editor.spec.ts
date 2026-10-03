import { test, expect, overallProgress } from './helpers';

test('画面で作成したチェックリストが選択された状態でラウンドに使われる', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: '新しいチェックリストを追加する' }).click();
  await page.getByRole('button', { name: '画面で作成する' }).click();

  await page.getByRole('textbox', { name: 'チェックリストの名前' }).fill('医療安全ラウンド');
  await page.getByRole('textbox', { name: 'カテゴリ1の名前' }).fill('転倒予防');
  await page.getByRole('textbox', { name: 'カテゴリ1の項目1' }).fill('ベッド柵が上がっている');
  await page.getByRole('button', { name: 'カテゴリ1に項目を追加' }).click();
  await page.getByRole('textbox', { name: 'カテゴリ1の項目2' }).fill('履物が適切である');
  // Move the second item to the top to check that the order is saved.
  await page.getByRole('button', { name: 'カテゴリ1の項目2を上へ移動' }).click();
  await page.getByRole('button', { name: '保存して適用' }).click();

  // Back on the start screen, the new checklist is listed and selected.
  await expect(page.getByRole('heading', { name: 'チェックリストを作成' })).toBeHidden();
  await expect(page.getByText('医療安全ラウンド')).toBeVisible();
  await expect(page.getByText('1カテゴリ・2項目')).toBeVisible();

  await page.getByPlaceholder('例: 山田 花子').fill('山田 花子');
  await page.getByRole('button', { name: 'ラウンド開始' }).click();

  await expect(overallProgress(page)).toHaveText('0/2');
  await expect(page.getByText('転倒予防')).toBeVisible();
  const items = page.getByText(/^(ベッド柵が上がっている|履物が適切である)$/);
  await expect(items).toHaveText(['履物が適切である', 'ベッド柵が上がっている']);
});
