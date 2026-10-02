import { test, expect, startRound, samplePhoto, overallProgress, firstItemRating } from './helpers';

test('参加者名が空または空白だけならラウンドを開始できない', async ({ page }) => {
  await page.goto('/');
  const nameInput = page.getByPlaceholder('例: 山田 花子');
  const start = page.getByRole('button', { name: 'ラウンド開始' });

  await expect(start).toBeDisabled();

  await nameInput.fill('   ');
  await expect(start).toBeDisabled();
  // The submit handler's own guard is covered by the component test (fireEvent.submit, PR #98).

  await nameInput.fill('山田 花子');
  await expect(start).toBeEnabled();
});

test('写真を選ぶまで追加できず、選んでも追加せずに戻れば写真は増えない', async ({ page }) => {
  await startRound(page, '山田 花子');
  await page.getByRole('button', { name: '写真', exact: true }).click();
  await page.getByRole('button', { name: '写真を追加' }).click();

  const submit = page.getByRole('button', { name: '追加する' });
  await expect(submit).toBeDisabled();

  // Pick a photo and a comment, so the form is ready to add, then leave without adding.
  await page.locator('input[type="file"]').nth(1).setInputFiles(samplePhoto);
  await page.getByLabel('コメント').fill('追加しなかったコメント');
  await expect(submit).toBeEnabled();

  // Back label depends on the theme (default theme says 戻る).
  await page.getByRole('button', { name: /^(戻る|もどる)$/ }).click();
  await expect(page.getByText('写真はまだありません')).toBeVisible();
  await expect(page.getByText('追加しなかったコメント')).toHaveCount(0);
});

test('未保存の変更があるとトップに戻る前に確認され、キャンセルすればラウンドが残る', async ({ page }) => {
  await startRound(page, '山田 花子');
  await firstItemRating(page, 'A').click();

  await page.getByRole('button', { name: 'トップ画面に戻る' }).click();
  await expect(page.getByRole('heading', { name: 'トップ画面に戻りますか？' })).toBeVisible();

  await page.getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.getByRole('heading', { name: 'トップ画面に戻りますか？' })).toHaveCount(0);
  await expect(overallProgress(page)).toHaveText(/^1\/\d+$/);
});
