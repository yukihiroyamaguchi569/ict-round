import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import type { Download, Page } from '@playwright/test';
import { test, expect, openFacilitySettings, pickGalleryPhoto, quietPage } from './helpers';

const TEMPLATE = 'public/facility-settings-template.xlsx';

test('ひな形を読み込み、ラウンドを始めるとそのまま入力の画面に入り、ホームの一覧に出て、再読み込みしても残り、削除で消える', async ({ page }) => {
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

  // Starting enters the round's department list at once.
  await expect(page.getByRole('heading', { name: '部署の一覧' })).toBeFocused();
  await expect(page.getByText(/^2026\/11\/20 14:30 手指衛生（記入済み 0 \/ \d+）$/)).toBeVisible();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();

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

test('部署のコメントと総評、参加者を入れると、ホームに戻って再読み込みしても残る', async ({ page }) => {
  await page.goto('/facility.html');
  await openFacilitySettings(page);
  await page.locator('input[type="file"]').setInputFiles(TEMPLATE);
  await expect(page.getByRole('heading', { name: '部署グループと部署（4 グループ・11 部署）' })).toBeVisible();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();

  await page.getByRole('button', { name: 'ラウンドを始める' }).click();
  await page.getByLabel('日時').fill('2026-11-20T14:30');
  await page.getByRole('radio', { name: /環境整備/ }).check();
  await page.getByRole('button', { name: '始める', exact: true }).click();

  await page.getByRole('button', { name: /^3東/ }).click();
  await page.getByLabel('この部署のコメント').fill('床が汚れている\n清掃の手順を確認する');
  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();

  await page.getByRole('button', { name: '全体（総評と参加者）' }).click();
  await page.getByLabel('総評').fill('全体に良好');
  const members = page.getByRole('group', { name: '参加者' }).getByRole('checkbox');
  await members.first().check();
  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await expect(page.getByRole('button', { name: '全体（総評と参加者）' })).toContainText('総評 記入済み・参加者 1 人');

  // Going home saves the text still waiting for the typing pause.
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();
  await expect(page.getByRole('region', { name: 'この端末のラウンド' })).toBeVisible();
  await page.reload();

  await page.getByRole('button', { name: '2026/11/20 14:30 環境整備 を開く' }).click();
  await expect(page.getByRole('button', { name: '全体（総評と参加者）' })).toContainText('総評 記入済み・参加者 1 人');
  await page.getByRole('button', { name: /^3東/ }).click();
  await expect(page.getByLabel('この部署のコメント')).toHaveValue('床が汚れている\n清掃の手順を確認する');
  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await page.getByRole('button', { name: '全体（総評と参加者）' }).click();
  await expect(page.getByLabel('総評')).toHaveValue('全体に良好');
  await expect(members.first()).toBeChecked();
});

test('× の項目に写真を付けると、再読み込みして開き直しても残り、削除で消える', async ({ page }) => {
  await page.goto('/facility.html');
  await openFacilitySettings(page);
  await page.locator('input[type="file"]').setInputFiles(TEMPLATE);
  await expect(page.getByRole('heading', { name: '部署グループと部署（4 グループ・11 部署）' })).toBeVisible();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();

  await page.getByRole('button', { name: 'ラウンドを始める' }).click();
  await page.getByLabel('日時').fill('2026-11-20T14:30');
  await page.getByRole('radio', { name: /環境整備/ }).check();
  await page.getByRole('button', { name: '始める', exact: true }).click();
  await page.getByRole('button', { name: /^3東/ }).click();

  const marks = page.getByRole('group', { name: /高頻度接触面/ });
  await marks.getByRole('button', { name: '×' }).click();
  await page.getByRole('button', { name: '写真を追加' }).click();
  await expect(page.getByText(/^3東：高頻度接触面/)).toBeVisible();
  await pickGalleryPhoto(page);
  await page.getByLabel('コメント').fill('ドアノブに汚れ');
  await page.getByRole('button', { name: '追加する' }).click();

  const photos = page.getByRole('list', { name: /高頻度接触面.* の写真/ });
  await expect(photos.getByText('ドアノブに汚れ')).toBeVisible();
  await expect(photos.locator('img')).toHaveAttribute('src', /^data:image\//);
  await expect(marks.getByRole('button', { name: '○' })).toBeDisabled();

  // Home lists a round as it was last saved, so going there waits for the save before reloading.
  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();
  await expect(page.getByRole('region', { name: 'この端末のラウンド' })).toBeVisible();
  await page.reload();

  await page.getByRole('button', { name: '2026/11/20 14:30 環境整備 を開く' }).click();
  await page.getByRole('button', { name: /^3東/ }).click();
  await expect(photos.getByText('ドアノブに汚れ')).toBeVisible();
  await expect(photos.locator('img')).toHaveAttribute('src', /^data:image\//);

  await photos.getByRole('button', { name: '写真 1 を削除' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '削除する' }).click();
  await expect(photos).toHaveCount(0);
  await expect(marks.getByRole('button', { name: '○' })).toBeEnabled();

  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();
  await expect(page.getByRole('region', { name: 'この端末のラウンド' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '2026/11/20 14:30 環境整備 を開く' }).click();
  await page.getByRole('button', { name: /^3東/ }).click();
  await expect(marks.getByRole('button', { name: '×' })).toHaveAttribute('aria-pressed', 'true');
  await expect(photos).toHaveCount(0);
});

test('○× を付けて帳票の画面から Word 出力すると、遵守率とラウンドの記録が入ったファイルが保存される', async ({ page }) => {
  await page.goto('/facility.html');
  await openFacilitySettings(page);
  await page.locator('input[type="file"]').setInputFiles(TEMPLATE);
  await expect(page.getByRole('heading', { name: '部署グループと部署（4 グループ・11 部署）' })).toBeVisible();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();

  await page.getByRole('button', { name: 'ラウンドを始める' }).click();
  await page.getByLabel('日時').fill('2026-11-20T14:30');
  await page.getByRole('radio', { name: /環境整備/ }).check();
  await page.getByRole('button', { name: '始める', exact: true }).click();

  await page.getByRole('button', { name: /^3東/ }).click();
  await page.getByRole('group', { name: '汚物処理室の床やシンクに汚れがない' }).getByRole('button', { name: '○' }).click();
  await page.getByRole('group', { name: /ユーティリティ/ }).getByRole('button', { name: '○' }).click();
  await page.getByRole('group', { name: /高頻度接触面/ }).getByRole('button', { name: '×' }).click();
  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();

  await page.getByRole('button', { name: '帳票（遵守率と Word 出力）' }).click();
  await expect(page.getByRole('heading', { name: '帳票' })).toBeFocused();
  const ward = page.getByRole('region', { name: '病棟' });
  await expect(ward.getByRole('listitem').filter({ hasText: '3東' })).toContainText('遵守率 67%');
  await expect(ward.getByRole('listitem').filter({ hasText: '3西' })).toContainText('遵守率 －');

  const exportButton = page.getByRole('button', { name: 'Word出力' });
  await expect(exportButton).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  expect(download.suggestedFilename()).toMatch(/^ICTround_facility_2026-11-20_[a-z0-9]{4}\.docx$/);

  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const documentXml = await zip.file('word/document.xml')?.async('string');
  expect(documentXml).toContain('環境整備');
  expect(documentXml).toContain('67%');
  const customXml = await Promise.all(
    Object.keys(zip.files).filter((p) => /^customXml\/item\d+\.xml$/.test(p)).map((p) => zip.file(p)?.async('string'))
  );
  expect(customXml.some((text) => text?.includes('meguru-facility-round'))).toBe(true);

  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await expect(page.getByRole('heading', { name: '部署の一覧' })).toBeFocused();
});

/** Reads the template settings and starts a 環境整備 round at the same time on this device. */
async function startEnvironmentRound(page: Page, selectGroup?: string) {
  await openFacilitySettings(page);
  await page.locator('input[type="file"]').setInputFiles(TEMPLATE);
  await expect(page.getByRole('heading', { name: '部署グループと部署（4 グループ・11 部署）' })).toBeVisible();
  await page.getByRole('button', { name: 'ホームへ戻る' }).click();
  await page.getByRole('button', { name: 'ラウンドを始める' }).click();
  await page.getByLabel('日時').fill('2026-11-20T14:30');
  await page.getByRole('radio', { name: /環境整備/ }).check();
  if (selectGroup) await page.getByRole('checkbox', { name: new RegExp(selectGroup) }).check();
  await page.getByRole('button', { name: '始める', exact: true }).click();
}

/** Exports the report from the report screen and returns the download. */
async function exportReport(page: Page): Promise<Download> {
  const exportButton = page.getByRole('button', { name: 'Word出力' });
  await expect(exportButton).toBeEnabled();
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()]);
  return download;
}

async function countNgCells(download: Download): Promise<number> {
  const zip = await JSZip.loadAsync(readFileSync(await download.path()));
  const documentXml = (await zip.file('word/document.xml')?.async('string')) ?? '';
  return documentXml.split('>×<').length - 1;
}

test('ほかの端末で書き出した帳票を取り込むと、部署・食い違い・写真が合わさり、結果の一覧と帳票に出る', async ({ page, browser }) => {
  const touch = /高頻度接触面/;
  // Device B: visits 外来B too, marks 3東 the other way with a photo, and 透析室.
  const contextB = await browser.newContext({ serviceWorkers: 'block' });
  const pageB = await contextB.newPage();
  await quietPage(pageB);
  await startEnvironmentRound(pageB, '外来B');
  await pageB.getByRole('button', { name: /^3東/ }).click();
  await pageB.getByRole('group', { name: touch }).getByRole('button', { name: '×' }).click();
  await pageB.getByRole('button', { name: '写真を追加' }).click();
  await pickGalleryPhoto(pageB);
  await pageB.getByLabel('コメント').fill('ドアノブに汚れ');
  await pageB.getByRole('button', { name: '追加する' }).click();
  await expect(pageB.getByText('ドアノブに汚れ')).toBeVisible();
  await pageB.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await pageB.getByRole('button', { name: /^透析室/ }).click();
  await pageB.getByRole('group', { name: touch }).getByRole('button', { name: '○' }).click();
  await pageB.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await pageB.getByRole('button', { name: '帳票（遵守率と Word 出力）' }).click();
  // Copied out first: a download's file goes away with its context.
  const fromB = test.info().outputPath('from-b.docx');
  await (await exportReport(pageB)).saveAs(fromB);
  await contextB.close();

  // Device A: the ward only, 3東 marked ○.
  await startEnvironmentRound(page);
  await page.getByRole('button', { name: /^3東/ }).click();
  await page.getByRole('group', { name: touch }).getByRole('button', { name: '○' }).click();
  await page.getByRole('group', { name: '汚物処理室の床やシンクに汚れがない' }).getByRole('button', { name: '○' }).click();
  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await page.getByRole('button', { name: '帳票（遵守率と Word 出力）' }).click();
  const before = await countNgCells(await exportReport(page));

  await page.getByLabel('Word のファイルを選ぶ').setInputFiles(fromB);
  const result = page.getByRole('status', { name: '取り込みの結果' });
  await expect(result).toContainText('取り込みました');
  await expect(result).toContainText('足した部署: 透析室、内視鏡室');
  await expect(result).toContainText('食い違ったため × にしたマス: 3東：高頻度接触面');
  await expect(result).toContainText('足した写真: 1 枚');
  await expect(result.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByRole('region', { name: '外来B' }).getByRole('listitem').filter({ hasText: '透析室' })).toContainText('遵守率 100%');

  const after = await countNgCells(await exportReport(page));
  expect(after).toBe(before + 1);

  await page.getByRole('button', { name: '部署の一覧へ戻る' }).click();
  await page.getByRole('button', { name: /^3東/ }).click();
  await expect(page.getByRole('group', { name: touch }).getByRole('button', { name: '×' })).toHaveAttribute('aria-pressed', 'true');
  const photos = page.getByRole('list', { name: /高頻度接触面.* の写真/ });
  await expect(photos.getByText('ドアノブに汚れ')).toBeVisible();
  await expect(photos.locator('img')).toHaveAttribute('src', /^data:image\//);
});
