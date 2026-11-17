import { test, expect, openFacilitySettings } from './helpers';

const TEMPLATE = 'public/facility-settings-template.xlsx';

test('ひな形を読み込み、ラウンドを始めると一覧に出て、再読み込みしても残り、削除で消える', async ({ page }) => {
  await page.goto('/facility.html');
  await expect(page.getByRole('button', { name: 'ラウンドを始める' })).toBeDisabled();
  await expect(page.getByText('先に施設設定を読み込んでください。')).toBeVisible();

  await openFacilitySettings(page);
  await page.locator('input[type="file"]').setInputFiles(TEMPLATE);
  await expect(page.getByRole('heading', { name: '部署グループと部署（4 グループ・11 部署）' })).toBeVisible();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();

  await expect(page.getByText('まだラウンドはありません。')).toBeVisible();
  await page.getByRole('button', { name: 'ラウンドを始める' }).click();
  await page.getByLabel('日時').fill('2026-11-20T14:30');
  await page.getByRole('radio', { name: /手指衛生/ }).check();
  await page.getByRole('checkbox', { name: /外来A/ }).check();
  await page.getByRole('button', { name: '始める', exact: true }).click();

  const list = page.getByRole('region', { name: 'この端末のラウンド' });
  await expect(list.getByText('2026/11/20 14:30')).toBeVisible();
  await expect(list.getByText('手指衛生')).toBeVisible();
  await expect(list.getByText(/記入済み 0 \/ \d+/)).toBeVisible();

  await page.reload();
  await expect(list.getByText('2026/11/20 14:30')).toBeVisible();

  await list.getByRole('button', { name: '2026/11/20 14:30 手指衛生 を削除' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '削除する' }).click();
  await expect(page.getByText('まだラウンドはありません。')).toBeVisible();

  await page.reload();
  await expect(page.getByText('まだラウンドはありません。')).toBeVisible();
});
