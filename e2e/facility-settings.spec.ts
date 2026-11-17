import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import type { Page } from '@playwright/test';
import { test, expect } from './helpers';

const TEMPLATE = readFileSync(new URL('../public/facility-settings-template.xlsx', import.meta.url));
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The template with the 部署 sheet's row 5 (4西) moved to a group that does not exist. */
async function templateWithUnknownGroup(): Promise<Buffer> {
  const zip = await JSZip.loadAsync(TEMPLATE);
  const path = 'xl/worksheets/sheet2.xml';
  const xml = (await zip.file(path)?.async('string')) ?? '';
  const target = '<c r="B5" t="inlineStr"><is><t>病棟</t></is></c>';
  if (!xml.includes(target)) throw new Error('template layout changed: B5 of the 部署 sheet not found');
  zip.file(path, xml.replace(target, '<c r="B5" t="inlineStr"><is><t>外来ウ</t></is></c>'));
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function pickFile(page: Page, name: string, buffer: Buffer) {
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: XLSX_MIME, buffer });
}

/** Checks the summary shows the template's settings. */
async function expectTemplateSummary(page: Page) {
  await expect(page.getByRole('heading', { name: '部署グループと部署（4 グループ・11 部署）' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'チェック項目（3 テーマ・10 項目）' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '参加者（5 名）' })).toBeVisible();
  await expect(page.getByText('病棟、外来B（透析室を除く）')).toBeVisible();
}

test('ひな形を読み込むと確認表が出て、再読み込みしても残る', async ({ page }) => {
  await page.goto('/facility.html');
  await expect(page.getByRole('heading', { name: '施設ラウンド' })).toBeVisible();
  // In development: kept out of search results until it gets an entry on the start screen.
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.getByText('まだ施設設定が保存されていません。')).toBeVisible();

  await pickFile(page, 'facility-settings-template.xlsx', TEMPLATE);
  await expectTemplateSummary(page);

  await page.reload();
  await expectTemplateSummary(page);
});

test('誤りのあるファイルは行番号つきの誤りを出し、保存済みの設定を変えない', async ({ page }) => {
  await page.goto('/facility.html');
  await pickFile(page, 'facility-settings-template.xlsx', TEMPLATE);
  await expectTemplateSummary(page);

  await pickFile(page, 'broken.xlsx', await templateWithUnknownGroup());
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('「部署」シートの 5 行目: グループ「外来ウ」が「グループ」シートにありません');
  await expect(alert).toContainText('保存している設定は変わっていません。');
  await expectTemplateSummary(page);

  await page.reload();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expectTemplateSummary(page);
});

test('ひな形のダウンロードのリンクから配布しているひな形を取得できる', async ({ page }) => {
  await page.goto('/facility.html');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'ひな形をダウンロード' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('facility-settings-template.xlsx');
  expect(readFileSync(await download.path()).equals(TEMPLATE)).toBe(true);
});

test('キーボードだけでファイルの選択を開ける', async ({ page }) => {
  await page.goto('/facility.html');
  const input = page.getByLabel('ファイルを選ぶ');
  // Tab from the top of the page until the file input has focus.
  for (let i = 0; i < 5 && !(await input.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(input).toBeFocused();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press('Enter')]);
  await chooser.setFiles({ name: 'facility-settings-template.xlsx', mimeType: XLSX_MIME, buffer: TEMPLATE });
  await expectTemplateSummary(page);
});
