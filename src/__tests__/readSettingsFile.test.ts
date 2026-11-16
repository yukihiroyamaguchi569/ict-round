import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Sheet } from 'read-excel-file/browser';
import { readSettingsFile } from '../facility/readSettingsFile';

// The template test uses the real reader; other tests feed sheets directly.
const readXlsxFileMock = vi.hoisted(() => vi.fn<(input: ArrayBuffer) => Promise<Sheet[]>>());
vi.mock('read-excel-file/browser', () => ({ default: readXlsxFileMock }));
const { default: actualReadXlsxFile } =
  await vi.importActual<typeof import('read-excel-file/browser')>('read-excel-file/browser');

beforeEach(() => {
  // Reset drops any queued mockResolvedValueOnce so it cannot leak into the next test.
  readXlsxFileMock.mockReset();
  readXlsxFileMock.mockImplementation((input) => actualReadXlsxFile(input));
});

/** Fake ID generator returning id-1, id-2, ... */
function sequentialIds(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

const TEMPLATE_PATH = fileURLToPath(new URL('../../public/facility-settings-template.xlsx', import.meta.url));

function templateFile(name = 'facility-settings-template.xlsx'): File {
  return new File([readFileSync(TEMPLATE_PATH)], name);
}

/** A file that passes the extension and ZIP signature checks; its sheets come from the mock. */
function zipFile(name = 'settings.xlsx'): File {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])], name);
}

function validSheets(): Sheet[] {
  return [
    { sheet: 'グループ', data: [['グループ名', '回り方'], ['病棟', '毎回']] },
    { sheet: '部署', data: [['部署名', 'グループ'], ['3東', '病棟']] },
    { sheet: '項目', data: [['テーマ', '項目', '対象グループ', '対象外の部署'], ['手指衛生', '項目1', null, null]] },
    { sheet: '参加者', data: [['氏名', '職種'], ['看護 花子', '看護師']] },
  ];
}

async function expectFileError(file: File, message: RegExp) {
  const result = await readSettingsFile(file, sequentialIds());
  // toEqual also fails when the error carries a sheet name.
  expect(result).toEqual({ ok: false, errors: [{ message: expect.stringMatching(message) }] });
}

describe('readSettingsFile', () => {
  it('配布するひな形を読んで設定にできる', async () => {
    const result = await readSettingsFile(templateFile(), sequentialIds());
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    const { groups, departments, themes, members } = result.settings;
    expect(groups).toHaveLength(4);
    expect(departments).toHaveLength(11);
    expect(themes).toHaveLength(3);
    expect(themes.flatMap((t) => t.items)).toHaveLength(10);
    expect(members).toHaveLength(5);
    // Japanese text and the multi-name cells survive the real reader.
    expect(groups[0]).toEqual({ name: '病棟', visit: 'always' });
    const item = themes[1].items.find((i) => i.text === '汚物処理室の床やシンクに汚れがない');
    expect(item).toMatchObject({ targetGroups: ['病棟', '外来B'], excludedDepartments: ['透析室'] });
    expect(readXlsxFileMock.mock.calls[0][0]).toBeInstanceOf(ArrayBuffer);
  });

  it('拡張子が大文字の .XLSX でも読む', async () => {
    const result = await readSettingsFile(templateFile('SETTINGS.XLSX'), sequentialIds());
    expect(result.ok).toBe(true);
  });

  it('シートが欠けていれば、そのシートの誤りを返す', async () => {
    readXlsxFileMock.mockResolvedValueOnce(validSheets().filter((s) => s.sheet !== '参加者'));
    const result = await readSettingsFile(zipFile(), sequentialIds());
    expect(result).toEqual({
      ok: false,
      errors: [{ sheet: '参加者', message: '「参加者」シートがありません' }],
    });
  });

  it('ほかのシートがあっても無視して読む', async () => {
    readXlsxFileMock.mockResolvedValueOnce([...validSheets(), { sheet: 'メモ', data: [['自由に書く']] }]);
    const result = await readSettingsFile(zipFile(), sequentialIds());
    expect(result.ok).toBe(true);
  });

  it('数値・真偽値・null のセルを文字列にして渡す', async () => {
    const sheets = validSheets();
    sheets[1].data.push([401, '病棟'], [true, '病棟']);
    readXlsxFileMock.mockResolvedValueOnce(sheets);
    const result = await readSettingsFile(zipFile(), sequentialIds());
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.settings.departments.map((d) => d.name)).toEqual(['3東', '401', 'true']);
    expect(result.settings.themes[0].items[0]).toEqual({
      id: 'id-1',
      text: '項目1',
      targetGroups: [],
      excludedDepartments: [],
    });
    // A null cell becomes '', which the builder reports as a blank required cell.
    sheets[3].data.push([null, '医師']);
    readXlsxFileMock.mockResolvedValueOnce(sheets);
    const blank = await readSettingsFile(zipFile(), sequentialIds());
    expect(blank).toEqual({ ok: false, errors: [{ sheet: '参加者', row: 3, message: '「氏名」が空欄です' }] });
  });

  it('拡張子が .xlsx でなければ読まずに誤りを返す', async () => {
    for (const name of ['settings.xls', 'settings.csv', 'settings.xlsx.txt', 'settings']) {
      await expectFileError(zipFile(name), /^Excel ファイル（\.xlsx）を選んでください/);
    }
    expect(readXlsxFileMock).not.toHaveBeenCalled();
  });

  it('先頭が PK でないファイルは読まずに誤りを返す', async () => {
    await expectFileError(new File(['グループ名,回り方'], 'settings.xlsx'), /^Excel ファイル（\.xlsx）ではありません/);
    // Only the 4th byte differs from the signature.
    await expectFileError(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x05])], 'a.xlsx'), /ではありません/);
    await expectFileError(new File([], 'empty.xlsx'), /ではありません/);
    expect(readXlsxFileMock).not.toHaveBeenCalled();
  });

  it('5MB を超えるファイルは読まずに誤りを返す', async () => {
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set([0x50, 0x4b, 0x03, 0x04]);
    await expectFileError(new File([big], 'big.xlsx'), /^ファイルが大きすぎます（5MB）。施設設定のファイルは 5MB までです$/);
    expect(readXlsxFileMock).not.toHaveBeenCalled();
  });

  it('ちょうど 5MB のファイルは読む', async () => {
    const limit = new Uint8Array(5 * 1024 * 1024);
    limit.set([0x50, 0x4b, 0x03, 0x04]);
    readXlsxFileMock.mockResolvedValueOnce(validSheets());
    const result = await readSettingsFile(new File([limit], 'limit.xlsx'), sequentialIds());
    expect(result.ok).toBe(true);
  });

  it('壊れていて読めないファイルは throw せずに誤りを返す', async () => {
    readXlsxFileMock.mockRejectedValueOnce(new Error('invalid zip'));
    await expectFileError(zipFile(), /^ファイルが壊れているか、Excel ファイルとして読めません/);
  });

  it('ファイルそのものが読めない（選んだあとに変わった）ときも throw せずに誤りを返す', async () => {
    const file = zipFile();
    const unreadable = new Blob();
    vi.spyOn(unreadable, 'arrayBuffer').mockRejectedValue(new DOMException('changed', 'NotReadableError'));
    vi.spyOn(file, 'slice').mockReturnValue(unreadable);
    await expectFileError(file, /^ファイルが壊れているか、Excel ファイルとして読めません/);
    expect(readXlsxFileMock).not.toHaveBeenCalled();
  });

  it('PK で始まるだけの壊れたファイルを実際の読み込みで読んでも throw しない', async () => {
    await expectFileError(zipFile(), /読めません/);
  });
});
