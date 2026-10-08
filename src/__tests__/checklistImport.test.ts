import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SheetData } from 'read-excel-file/browser';
import {
  parseCsv,
  parseXlsx,
  checklistFileType,
  readChecklistFile,
  importedChecklistName,
  buildImportedChecklist,
} from '../checklistImport';
import { addPhoto, createRound, setRating } from '../roundData';

// Fixture tests use the real reader; individual tests can feed rows directly.
const readSheetMock = vi.hoisted(() => vi.fn<(input: ArrayBuffer) => Promise<SheetData>>());
vi.mock('read-excel-file/browser', () => ({ readSheet: readSheetMock }));
const { readSheet: actualReadSheet } =
  await vi.importActual<typeof import('read-excel-file/browser')>('read-excel-file/browser');

beforeEach(() => {
  // Reset drops any queued mockResolvedValueOnce so it cannot leak into the next test.
  readSheetMock.mockReset();
  readSheetMock.mockImplementation((input) => actualReadSheet(input));
});

describe('parseCsv', () => {
  it('カテゴリごとに項目をグルーピングする', () => {
    const result = parseCsv('手指衛生,項目1\n手指衛生,項目2\n水回り,項目3');
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('手指衛生');
    expect(result[0].items).toHaveLength(2);
    expect(result[1].items).toHaveLength(1);
  });

  it('同一カテゴリ内で ID に連番を振る', () => {
    const result = parseCsv('手指衛生,項目1\n手指衛生,項目2');
    const ids = result[0].items.map((i) => i.id);
    expect(ids[0]).toMatch(/-1$/);
    expect(ids[1]).toMatch(/-2$/);
    expect(new Set(ids).size).toBe(2);
  });

  it('日本語カテゴリ名でも ID が空にならない', () => {
    const result = parseCsv('手指衛生,項目1');
    expect(result[0].items[0].id).toBe('手指衛生-1');
  });

  it('英字カテゴリ名は小文字化し、空白をハイフンに、記号を除いて ID にする', () => {
    const result = parseCsv('Hand  Hygiene!,item');
    expect(result[0].items[0].id).toBe('hand-hygiene-1');
  });

  it('各列の前後の空白を取り除く', () => {
    const result = parseCsv('手指衛生 , 項目1 ');
    expect(result[0].category).toBe('手指衛生');
    expect(result[0].items[0]).toEqual({ id: '手指衛生-1', category: '手指衛生', description: '項目1' });
  });

  it('見出し行（1行目が category）をスキップする', () => {
    const result = parseCsv('category,description\n手指衛生,項目1');
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(1);
  });

  it('カンマの前に空白がある見出し行もスキップする', () => {
    const result = parseCsv('category ,description\n手指衛生,項目1');
    expect(result.map((c) => c.category)).toEqual(['手指衛生']);
  });

  it('大文字で始まる見出し行（Category,Description）もスキップする', () => {
    const result = parseCsv('Category,Description\n手指衛生,項目1');
    expect(result.map((c) => c.category)).toEqual(['手指衛生']);
  });

  it('2行目以降の category 列が Category の行は見出しとして扱わず取り込む', () => {
    const result = parseCsv('category,description\n手指衛生,項目1\nCategory,項目2');
    expect(result.map((c) => c.category)).toEqual(['手指衛生', 'Category']);
    expect(result[1].items[0].description).toBe('項目2');
  });

  it('先頭の空行の後にある見出し行をスキップする (#103)', () => {
    const result = parseCsv('\n\r\n,\ncategory,description\n手指衛生,項目1');
    expect(result.map((c) => c.category)).toEqual(['手指衛生']);
    expect(result[0].items.map((i) => i.description)).toEqual(['項目1']);
  });

  it('タイトル行（1列だけ・2列目が空）の後にある見出し行をスキップする (#103)', () => {
    const result = parseCsv('感染対策ラウンド表\n感染対策ラウンド表,\n,作成日\ncategory,description\n手指衛生,項目1');
    expect(result.map((c) => c.category)).toEqual(['手指衛生']);
    expect(result.flatMap((c) => c.items).some((i) => i.description === 'description')).toBe(false);
  });

  it('データ行の後の category 行は、先頭に空行があっても見出しとして扱わず取り込む (#103)', () => {
    const result = parseCsv('\ncategory,description\n手指衛生,項目1\ncategory,項目2');
    expect(result.map((c) => c.category)).toEqual(['手指衛生', 'category']);
    expect(result[1].items[0].description).toBe('項目2');
  });

  it('引用符で囲まれたカンマを列の区切りとして扱わない', () => {
    const result = parseCsv('手指衛生,"手洗い,手指消毒の両方"');
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].description).toBe('手洗い,手指消毒の両方');
  });

  it('引用符のエスケープ（""）を1つの引用符に戻す', () => {
    const result = parseCsv('手指衛生,"いわゆる""5つのタイミング"""');
    expect(result[0].items[0].description).toBe('いわゆる"5つのタイミング"');
  });

  it('空行と2列未満の行を無視する', () => {
    const result = parseCsv('手指衛生,項目1\n\n列が1つだけ\n手指衛生,項目2');
    expect(result[0].items).toHaveLength(2);
  });

  it('片方の列が空の行を無視する', () => {
    const result = parseCsv('手指衛生,項目1\n手指衛生,\n,項目X');
    expect(result[0].items).toHaveLength(1);
  });

  it('有効な行が1つも無ければエラーを投げる', () => {
    // The message is shown as-is in the import dialog.
    expect(() => parseCsv('')).toThrow('有効な行が見つかりません');
    expect(() => parseCsv('列が1つだけ')).toThrow('有効な行が見つかりません');
  });
});

describe('項目 ID (#102)', () => {
  const ids = (csv: string) => parseCsv(csv).flatMap((c) => c.items.map((i) => i.id));

  it('slug が重ならない入力では ID を今までどおり slug-連番 にする', () => {
    expect(
      ids(
        [
          '手指衛生,項目1',
          'Hand  Hygiene!,項目2',
          '手指衛生,項目3',
          '個人防護具（PPE）の着脱,項目4',
          'あいうえおかきくけこさしすせそたちつてとなにぬ,項目5',
          '!!!,項目6',
        ].join('\n')
      )
    ).toEqual(['手指衛生-1', '手指衛生-2', 'hand-hygiene-1', '個人防護具ppeの着脱-1', 'あいうえおかきくけこさしすせそたちつてと-1', '-1']);
  });

  it('配布テンプレートの ID はずらさない', async () => {
    const buf = readFileSync(fileURLToPath(new URL('../../public/round-checklist-template.xlsx', import.meta.url)));
    const result = await parseXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    expect(result.flatMap((c) => c.items).some((i) => i.id.includes('~'))).toBe(false);
  });

  it('大文字小文字・空白の数だけが違うカテゴリは、後のカテゴリの ID をずらす', () => {
    expect(ids('Hand Hygiene,項目1\nhand  hygiene,項目2\nHand Hygiene,項目3')).toEqual([
      'hand-hygiene-1',
      'hand-hygiene-2',
      'hand-hygiene~2-1',
    ]);
  });

  it('slug で除かれる記号だけが違うカテゴリは、後のカテゴリの ID をずらす', () => {
    expect(ids('手指衛生①,項目1\n手指衛生②,項目2\n手指衛生③,項目3')).toEqual([
      '手指衛生-1',
      '手指衛生~2-1',
      '手指衛生~3-1',
    ]);
  });

  it('先頭 20 文字が同じ長いカテゴリ名は、後のカテゴリの ID をずらす', () => {
    const prefix = 'あいうえおかきくけこさしすせそたちつてと';
    expect(ids(`${prefix}A,項目1\n${prefix}B,項目2`)).toEqual([`${prefix}-1`, `${prefix}~2-1`]);
  });

  it('slug が空になるカテゴリどうしも ID を重複させない', () => {
    expect(ids('!!!,項目1\n???,項目2')).toEqual(['-1', '~2-1']);
  });

  it('ずらした ID は、slug から自然に生まれる ID や後続のカテゴリの ID と衝突しない', () => {
    const csv = ['a,1', 'A,2', 'a 2,3', 'a2,4', 'a-2,5', 'a~2,6', 'a_2,7', 'A,8', 'a,9'].join('\n');
    const all = ids(csv);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual(['a-1', 'a-2', 'a~2-1', 'a~2-2', 'a-2-1', 'a2-1', 'a-2~2-1', 'a2~2-1', 'a_2-1']);
  });

  it('同じ入力からは常に同じ ID を作る', () => {
    const csv = 'Hand Hygiene,項目1\nhand  hygiene,項目2\n手指衛生①,項目3\n手指衛生②,項目4';
    expect(ids(csv)).toEqual(ids(csv));
  });

  it('ID が重ならないので、片方の項目の評価・写真がもう片方に入らない', () => {
    const categories = parseCsv('Hand Hygiene,項目1\nhand  hygiene,項目2');
    const checklist = buildImportedChecklist({ typedName: 'x', fileName: 'x.csv', categories }, 'c1', '2026-10-08T00:00:00.000Z');
    const [first, second] = categories.flatMap((c) => c.items);
    let round = createRound(checklist, '山田', '3東', '2026/10/08 09:00');
    round = setRating(round, first.id, 'A');
    round = addPhoto(round, { id: 'p1', dataUrl: 'data:image/jpeg;base64,AA', comment: '', timestamp: '09:01' }, first.id);
    const results = round.checklistResults;
    expect(results.map((r) => r.rating)).toEqual(['A', null]);
    expect(results.map((r) => r.photos.length)).toEqual([1, 0]);
    expect(results[1].itemId).toBe(second.id);
  });
});

describe('parseXlsx', () => {
  // 実ファイルを読んで取り込み経路を通しで検証する
  async function loadFixture(relativePath: string) {
    const path = fileURLToPath(new URL(relativePath, import.meta.url));
    const buf = readFileSync(path);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return parseXlsx(arrayBuffer as ArrayBuffer);
  }

  const countItems = (cats: Awaited<ReturnType<typeof loadFixture>>) =>
    cats.reduce((sum, cat) => sum + cat.items.length, 0);

  it('配布テンプレートを読み込んでカテゴリに変換できる', async () => {
    const result = await loadFixture('../../public/round-checklist-template.xlsx');

    expect(result.length).toBeGreaterThan(0);
    expect(countItems(result)).toBeGreaterThan(0);
    // 日本語が文字化けせず読めていること
    expect(result[0].category).toBe('手指衛生');
    expect(result[0].items[0].description).toContain('手指衛生');
  });

  it('複数カテゴリをグルーピングして読み込む', async () => {
    const result = await loadFixture('./fixtures/checklist-normal.xlsx');

    expect(result.map((c) => c.category)).toEqual(['手指衛生', '個人防護具', '環境整備']);
    expect(result.map((c) => c.items.length)).toEqual([3, 2, 2]);
    expect(countItems(result)).toBe(7);
  });

  it('見出し行（1行目が category）をスキップする', async () => {
    const result = await loadFixture('./fixtures/checklist-with-header.xlsx');

    expect(result.map((c) => c.category)).toEqual(['手指衛生', '廃棄物']);
    expect(countItems(result)).toBe(4);
    // 見出し行がカテゴリとして混入していないこと
    expect(result.some((c) => c.category === 'category')).toBe(false);
  });

  it('前後に空白のある見出し行もスキップする', async () => {
    readSheetMock.mockResolvedValueOnce([
      [' category ', 'description'],
      ['手指衛生', '項目1'],
    ]);
    const result = await parseXlsx(new ArrayBuffer(0));
    expect(result.map((c) => c.category)).toEqual(['手指衛生']);
  });

  it('2行目以降の category 列が Category の行は見出しとして扱わず取り込む', async () => {
    readSheetMock.mockResolvedValueOnce([
      ['category', 'description'],
      ['手指衛生', '項目1'],
      ['Category', '項目2'],
    ]);
    const result = await parseXlsx(new ArrayBuffer(0));
    expect(result.map((c) => c.category)).toEqual(['手指衛生', 'Category']);
  });

  // Empty cells come back as null, and rows are padded to the sheet width (as the real reader returns them).
  it('先頭の空行・タイトル行の後にある見出し行をスキップする (#103)', async () => {
    readSheetMock.mockResolvedValueOnce([
      [null, null],
      ['感染対策ラウンド表', null],
      [null, '作成日'],
      ['Category', 'Description'],
      ['手指衛生', '項目1'],
    ]);
    const result = await parseXlsx(new ArrayBuffer(0));
    expect(result.map((c) => c.category)).toEqual(['手指衛生']);
    expect(result[0].items.map((i) => i.description)).toEqual(['項目1']);
  });

  it('データ行の後の category 行は、先頭にタイトル行があっても見出しとして扱わず取り込む (#103)', async () => {
    readSheetMock.mockResolvedValueOnce([
      ['感染対策ラウンド表', null],
      ['category', 'description'],
      ['手指衛生', '項目1'],
      ['category', '項目2'],
    ]);
    const result = await parseXlsx(new ArrayBuffer(0));
    expect(result.map((c) => c.category)).toEqual(['手指衛生', 'category']);
  });

  it('別カテゴリで slug が同じでも項目 ID を重複させない (#102)', async () => {
    readSheetMock.mockResolvedValueOnce([
      ['Hand Hygiene', '項目1'],
      ['hand  hygiene', '項目2'],
    ]);
    const result = await parseXlsx(new ArrayBuffer(0));
    expect(result.flatMap((c) => c.items.map((i) => i.id))).toEqual(['hand-hygiene-1', 'hand-hygiene~2-1']);
  });

  it('空行・片側だけのセルを無視して有効な行のみ取り込む', async () => {
    const result = await loadFixture('./fixtures/checklist-messy.xlsx');

    expect(result.map((c) => c.category)).toEqual(['手指衛生', '水回り', '汚物室・トイレ']);
    expect(countItems(result)).toBe(4);
    // 片側のセルしかない行がカテゴリ・項目として混入していないこと
    expect(result.some((c) => c.category === 'カテゴリだけの行')).toBe(false);
    expect(
      result.flatMap((c) => c.items).some((i) => i.description === '項目だけの行')
    ).toBe(false);
  });
});

describe('checklistFileType', () => {
  it('treats a name ending in .xlsx as xlsx', () => {
    expect(checklistFileType('list.xlsx')).toBe('xlsx');
    expect(checklistFileType('.xlsx')).toBe('xlsx');
  });

  it('treats everything else as CSV, including other spreadsheet extensions and upper case', () => {
    expect(checklistFileType('list.csv')).toBe('csv');
    expect(checklistFileType('list.xls')).toBe('csv');
    expect(checklistFileType('list.XLSX')).toBe('csv');
    expect(checklistFileType('list.xlsx.txt')).toBe('csv');
    expect(checklistFileType('')).toBe('csv');
  });
});

describe('readChecklistFile', () => {
  it('reads an xlsx file through the spreadsheet reader', async () => {
    readSheetMock.mockResolvedValueOnce([['手指衛生', '項目1']]);
    const file = new File(['ignored'], 'a.xlsx');
    const result = await readChecklistFile(file, 'xlsx');
    expect(result.map((c) => c.category)).toEqual(['手指衛生']);
    expect(readSheetMock).toHaveBeenCalledTimes(1);
    expect(readSheetMock.mock.calls[0][0]).toBeInstanceOf(ArrayBuffer);
  });

  it('reads a CSV file as text without the spreadsheet reader', async () => {
    const result = await readChecklistFile(new File(['水回り,項目1'], 'a.csv'), 'csv');
    expect(result.map((c) => c.category)).toEqual(['水回り']);
    expect(readSheetMock).not.toHaveBeenCalled();
  });

  it('follows the given type rather than the file name', async () => {
    const result = await readChecklistFile(new File(['水回り,項目1'], 'a.xlsx'), 'csv');
    expect(result[0].items[0].description).toBe('項目1');
  });

  it('passes on a parse failure', async () => {
    await expect(readChecklistFile(new File([''], 'a.csv'), 'csv')).rejects.toThrow('有効な行が見つかりません');
  });
});

describe('importedChecklistName', () => {
  it('uses the typed name, trimmed', () => {
    expect(importedChecklistName('  外来用 ', 'list.csv')).toBe('外来用');
  });

  it('falls back to the file name without its last extension', () => {
    expect(importedChecklistName('', 'list.csv')).toBe('list');
    expect(importedChecklistName('   ', '3東.v2.xlsx')).toBe('3東.v2');
    expect(importedChecklistName('', 'noext')).toBe('noext');
  });

  it('falls back to 取込チェックリスト when the file name has no stem', () => {
    expect(importedChecklistName('', '.csv')).toBe('取込チェックリスト');
    expect(importedChecklistName('', '')).toBe('取込チェックリスト');
  });
});

describe('buildImportedChecklist', () => {
  it('builds the checklist with the given ID, name and time, fields in a fixed order', () => {
    const categories = parseCsv('手指衛生,項目1');
    const result = buildImportedChecklist({ typedName: '', fileName: 'a.csv', categories }, 'id1', '2026-10-06T00:00:00.000Z');
    expect(result).toStrictEqual({ id: 'id1', name: 'a', createdAt: '2026-10-06T00:00:00.000Z', categories });
    expect(Object.keys(result)).toEqual(['id', 'name', 'createdAt', 'categories']);
    expect(result.categories).toBe(categories);
  });
});
