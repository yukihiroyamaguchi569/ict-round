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

test('開いたラウンドで部署ごとに ○× を付けると、再読み込みしてホームから開き直しても残る', async ({ page }) => {
  await page.goto('/facility.html');
  await openFacilitySettings(page);
  await page.locator('input[type="file"]').setInputFiles(TEMPLATE);
  await expect(page.getByRole('heading', { name: '部署グループと部署（4 グループ・11 部署）' })).toBeVisible();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();

  await page.getByRole('button', { name: 'ラウンドを始める' }).click();
  await page.getByLabel('日時').fill('2026-11-20T14:30');
  await page.getByRole('radio', { name: /環境整備/ }).check();
  await page.getByRole('checkbox', { name: /外来B/ }).check();
  await page.getByRole('button', { name: '始める', exact: true }).click();
  await page.getByRole('button', { name: '2026/11/20 14:30 環境整備 を開く' }).click();

  // 汚物処理室の項目は 病棟・外来B が対象で、透析室 だけ対象外。
  const soiled = '汚物処理室の床やシンクに汚れがない';
  await page.getByRole('button', { name: /^透析室/ }).click();
  await expect(page.getByRole('heading', { name: '透析室' })).toBeVisible();
  await expect(page.getByRole('group')).toHaveCount(1);
  await expect(page.getByText(soiled)).toHaveCount(0);
  await page.getByRole('button', { name: '次の部署: 内視鏡室' }).click();
  await expect(page.getByRole('group', { name: soiled })).toBeVisible();
  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();

  await page.getByRole('button', { name: /^3東/ }).click();
  await page.getByRole('group', { name: soiled }).getByRole('button', { name: '○' }).click();
  await page.getByRole('group', { name: /高頻度接触面/ }).getByRole('button', { name: '×' }).click();
  await expect(page.getByText('記入済み 2 / 3')).toBeVisible();

  // Home lists a round as it was last saved, so this waits for both saves before reloading.
  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();
  const list = page.getByRole('region', { name: 'この端末のラウンド' });
  await expect(list.getByText('記入済み 2 / 18')).toBeVisible();

  await page.reload();
  await expect(list.getByText('記入済み 2 / 18')).toBeVisible();
  await list.getByRole('button', { name: '2026/11/20 14:30 環境整備 を開く' }).click();
  await expect(page.getByRole('button', { name: /^3東/ })).toContainText('記入済み 2 / 3');
  await page.getByRole('button', { name: /^3東/ }).click();
  await expect(page.getByRole('group', { name: soiled }).getByRole('button', { name: '○' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: /高頻度接触面/ }).getByRole('button', { name: '×' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: /ユーティリティ/ })).toContainText('確認なし');
});
