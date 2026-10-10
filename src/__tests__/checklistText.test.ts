import { describe, it, expect } from 'vitest';
import {
  CATEGORY_MAX_LENGTH,
  classifyLine,
  detectTextFormat,
  isNoiseLine,
  looksLikeCategory,
  normalizeLine,
  parseChecklistText,
  hasNumberColumn,
  stripTrailingRating,
} from '../checklistText';
import { CHECKLIST_CATEGORIES } from '../checklistData';
import type { DraftCategory } from '../checklistEditor';

/** Categories as plain names and item texts, for comparison. */
function simplify(categories: DraftCategory[]) {
  return categories.map((cat) => ({ name: cat.name, items: cat.items.map((item) => item.description) }));
}

const STANDARD = CHECKLIST_CATEGORIES.map((cat) => ({
  name: cat.category,
  items: cat.items.map((item) => item.description),
}));

const lines = (...rows: string[]) => rows.join('\n');

/** The report's table copied from Excel / Word: category repeated on each row, a header and a rating column. */
function reportTableTsv(): string {
  const rows = STANDARD.flatMap((cat) => cat.items.map((item) => `${cat.name}\t${item}\tA`));
  return lines('ジャンル\tチェック項目\t評価', ...rows);
}

/** The same table with the category cells merged: the name only on the first row of each category. */
function mergedTableTsv(): string {
  const rows = STANDARD.flatMap((cat) => cat.items.map((item, i) => `${i === 0 ? cat.name : ''}\t${item}\tB`));
  return lines('ジャンル\tチェック項目\t評価', ...rows);
}

/** Live Text reading each table row as one line: "手指衛生 病室の…． A". */
function rowPerLineText(): string {
  const rows = STANDARD.flatMap((cat) => cat.items.map((item) => `${cat.name} ${item} A`));
  return lines('ジャンル チェック項目 評価', ...rows);
}

/** A merged table read line by line: the category once on its own line, then its items and ratings. */
function categoryOnceText(): string {
  return lines(
    'ジャンル',
    'チェック項目',
    '評価',
    ...STANDARD.flatMap((cat) => [cat.name, ...cat.items.flatMap((item) => [item, 'A'])]),
  );
}

/** A merged table where the category is read on the same line as its first item only. */
function categoryOnFirstRowText(): string {
  return lines(...STANDARD.flatMap((cat) => cat.items.map((item, i) => (i === 0 ? `${cat.name} ${item}` : item))));
}

describe('parseChecklistText on the standard checklist', () => {
  it.each([
    ['an Excel / Word table with a header and a rating column', reportTableTsv],
    ['a table with merged category cells', mergedTableTsv],
    ['recognised text with one table row per line', rowPerLineText],
    ['recognised text with each category once on its own line', categoryOnceText],
    ['recognised text with the category only on the first row', categoryOnFirstRowText],
  ])('splits %s into the 9 categories and 22 items', (_, make) => {
    const result = simplify(parseChecklistText(make()));
    expect(result).toEqual(STANDARD);
    expect(result).toHaveLength(9);
    expect(result.flatMap((c) => c.items)).toHaveLength(22);
  });

  it('gives every category and item its own key', () => {
    const result = parseChecklistText(reportTableTsv());
    const keys = result.flatMap((cat) => [cat.key, ...cat.items.map((item) => item.key)]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(result[0].items[0]).not.toHaveProperty('source');
  });
});

describe('parseChecklistText: tables (tab-separated)', () => {
  it('reads column 1 as the category, column 2 as the item, and drops the rest', () => {
    const text = lines('手指衛生\t消毒剤がある．\tA\t備考あり', '環境\t清掃されている．\tC');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['消毒剤がある．'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('drops a leading number column', () => {
    const text = lines('No.\tジャンル\tチェック項目\t評価', '1\t手指衛生\t消毒剤がある．\tA', '2\t\t掲示がある．\tB', '3\t環境\t清掃されている．');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['消毒剤がある．', '掲示がある．'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('keeps numbers used as category names in a table with a rating column', () => {
    const text = lines('1\t手洗いを行う．\tA', '1\t記録する．\tB', '2\t清掃されている．\tA');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '1', items: ['手洗いを行う．', '記録する．'] },
      { name: '2', items: ['清掃されている．'] },
    ]);
  });

  it('keeps numbers used as category names with one item each and a rating column', () => {
    const text = lines('1\t手洗いを行う．\tA', '2\t清掃されている．\tB');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '1', items: ['手洗いを行う．'] },
      { name: '2', items: ['清掃されている．'] },
    ]);
  });

  it('still finds the number column when the table has empty rows', () => {
    const text = lines('1\t手指衛生\t消毒剤がある．\tA', '\t\t\t', '2\t環境\t清掃されている．\tB');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['消毒剤がある．'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('keeps a tab inside a quoted cell in the cell, as a space', () => {
    expect(simplify(parseChecklistText('手指衛生\t"消毒剤\tを確認する．"\tA'))).toEqual([
      { name: '手指衛生', items: ['消毒剤 を確認する．'] },
    ]);
  });

  it('skips header rows wherever they appear (a header repeated after a page break)', () => {
    const text = lines('カテゴリ\t項目', '手指衛生\t消毒剤がある．', 'Category\tDescription', '環境\t清掃されている．');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['消毒剤がある．'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('treats a row with only a category cell as the start of that category', () => {
    const text = lines('手指衛生\t', '\t消毒剤がある．', '\t掲示がある．');
    expect(simplify(parseChecklistText(text))).toEqual([{ name: '手指衛生', items: ['消毒剤がある．', '掲示がある．'] }]);
  });

  it('puts items before any category into an unnamed category', () => {
    const text = lines('\t消毒剤がある．', '手指衛生\t掲示がある．');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '', items: ['消毒剤がある．'] },
      { name: '手指衛生', items: ['掲示がある．'] },
    ]);
  });

  it('merges a category name that appears again later', () => {
    const text = lines('手指衛生\t消毒剤がある．', '環境\t清掃されている．', '手指衛生\t掲示がある．');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['消毒剤がある．', '掲示がある．'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('removes quotes Excel puts around a cell and tidies spaces in cells', () => {
    const text = lines('"手指衛生"\t"消毒剤が　ある．"', ' 環境 \t  清掃されている． ');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['消毒剤が ある．'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('joins the lines of a quoted cell with line breaks instead of splitting the row', () => {
    const text = lines(
      '手指衛生\t"洗浄用スポンジは乾燥し易い様に保管．',
      '原則タワシはNG．"\tA',
      '\t"手指消毒剤に""開封日""を書く．"\tB',
      '"環境\r\n整備"\t清掃されている．',
    );
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['洗浄用スポンジは乾燥し易い様に保管．原則タワシはNG．', '手指消毒剤に"開封日"を書く．'] },
      { name: '環境整備', items: ['清掃されている．'] },
    ]);
  });

  it('leaves quotes inside a cell that is not wrapped in quotes', () => {
    expect(simplify(parseChecklistText('手指衛生\t"5つのタイミング"を守る．\tA'))).toEqual([
      { name: '手指衛生', items: ['"5つのタイミング"を守る．'] },
    ]);
  });

  it('keeps a number as the category name in a two-column table', () => {
    expect(simplify(parseChecklistText(lines('1\t手洗いを行う．', '2\t記録する．')))).toEqual([
      { name: '1', items: ['手洗いを行う．'] },
      { name: '2', items: ['記録する．'] },
    ]);
  });

  it('reads a line without tabs inside a table by the line rules (a title, a category typed by hand)', () => {
    const text = lines('病棟ラウンド表', '■ 感染対策', '\t手袋がある．', '手指衛生\t消毒剤がある．');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '', items: ['病棟ラウンド表'] },
      { name: '感染対策', items: ['手袋がある．'] },
      { name: '手指衛生', items: ['消毒剤がある．'] },
    ]);
  });

  it('guesses categories from the shape of lines without tabs when no line in the table is marked', () => {
    const text = lines('病棟ラウンド表', '手指衛生\t消毒剤がある．', '手袋を交換している．');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '病棟ラウンド表', items: [] },
      { name: '手指衛生', items: ['消毒剤がある．', '手袋を交換している．'] },
    ]);
  });

  it('ignores rows whose cells are all empty', () => {
    expect(parseChecklistText(lines('\t\t', '\t\tA'))).toEqual([]);
  });
});

describe('parseChecklistText: recognised lines', () => {
  it('makes a line starting with ■ □ ● ◆ ◇ 【 # a category, without the mark', () => {
    const text = lines(
      '■手指衛生', '消毒剤がある．',
      '□ 環境', '清掃されている．',
      '●薬品', '期限切れがない．',
      '◆リネン', '保管されている．',
      '◇処置室', '区別している．',
      '【PPE】', '設置されている．',
      '# デバイス 関連の長い長いカテゴリ名です', '床についていない．',
    );
    expect(simplify(parseChecklistText(text)).map((c) => c.name)).toEqual([
      '手指衛生', '環境', '薬品', 'リネン', '処置室', 'PPE', 'デバイス 関連の長い長いカテゴリ名です',
    ]);
  });

  it('makes a numbered line a category, however long, unless it ends like a sentence', () => {
    const text = lines(
      '1. 手指衛生（WHO の 5 つのタイミングを含む）',
      '(1) 消毒剤がある．',
      '②掲示されている',
      '（2）環境',
      '3、清掃されている．',
    );
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生（WHO の 5 つのタイミングを含む）', items: ['消毒剤がある．', '掲示されている'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('drops header, rating and page number lines, and blank lines', () => {
    const text = lines(
      'ジャンル',
      '',
      'ジャンル チェック項目 評価',
      '手指衛生',
      '消毒剤がある．',
      'A',
      '○',
      '- 1 -',
      '   ',
      '掲示がある．',
      '×',
      '2/3',
      'P.2',
      '3ページ',
    );
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['消毒剤がある．', '掲示がある．'] },
    ]);
  });

  it('keeps a category with no items, so a short item taken for a category still shows', () => {
    expect(simplify(parseChecklistText(lines('手指衛生', '手指消毒を行う。', '手袋交換', '環境', '清掃されている．')))).toEqual([
      { name: '手指衛生', items: ['手指消毒を行う。'] },
      { name: '手袋交換', items: [] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('reads only marked lines as categories once any line is marked, and every other line as an item', () => {
    const text = lines('■手指衛生', '手指消毒を行う。', '手袋交換', '1. 掲示', '■ 環境', '清掃されている． A', '1.');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['手指消毒を行う。', '手袋交換', '掲示'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('keeps a trailing letter in a marked category name', () => {
    expect(simplify(parseChecklistText(lines('■ 病棟 A', '清掃されている． A', '■ 病棟 B', '記録がある． B')))).toEqual([
      { name: '病棟 A', items: ['清掃されている．'] },
      { name: '病棟 B', items: ['記録がある．'] },
    ]);
  });

  it('removes a rating stuck to the end of the item text', () => {
    expect(simplify(parseChecklistText(lines('■手指衛生', '手指消毒をしているA', '手袋を交換している○', '病棟A')))).toEqual([
      { name: '手指衛生', items: ['手指消毒をしている', '手袋を交換している', '病棟A'] },
    ]);
  });

  it('puts items into an unnamed category when there is no category at all', () => {
    expect(simplify(parseChecklistText(lines('消毒剤がある．', '清掃されている．')))).toEqual([
      { name: '', items: ['消毒剤がある．', '清掃されている．'] },
    ]);
  });

  it('keeps the current category for a bare mark or number', () => {
    expect(simplify(parseChecklistText(lines('手指衛生', '■', '1.', '消毒剤がある．')))).toEqual([
      { name: '手指衛生', items: ['消毒剤がある．'] },
    ]);
  });

  it('merges the category repeated on each row of an unmerged table', () => {
    const text = lines('手指衛生 消毒剤がある． A', '手指衛生 掲示がある． B', '環境 清掃されている．');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['消毒剤がある．', '掲示がある．'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('accepts Windows and old Mac line breaks', () => {
    expect(simplify(parseChecklistText('手指衛生\r\n消毒剤がある．\r掲示がある．'))).toEqual([
      { name: '手指衛生', items: ['消毒剤がある．', '掲示がある．'] },
    ]);
  });

  it('returns nothing for empty or blank text', () => {
    expect(parseChecklistText('')).toEqual([]);
    expect(parseChecklistText(' \n　\n')).toEqual([]);
  });
});

describe('detectTextFormat', () => {
  it('is table when any line has a tab, and lines otherwise', () => {
    expect(detectTextFormat('a\nb\tc')).toBe('table');
    expect(detectTextFormat('a\nb c')).toBe('lines');
    expect(detectTextFormat('')).toBe('lines');
  });
});

describe('normalizeLine', () => {
  it('turns full-width, non-breaking and repeated spaces into one space and trims spaces', () => {
    expect(normalizeLine('　手指衛生　　消毒剤 がある  ')).toBe('手指衛生 消毒剤 がある');
  });

  it('keeps tabs, including a leading tab for an empty first cell', () => {
    expect(normalizeLine('\t消毒剤がある．\tA')).toBe('\t消毒剤がある．\tA');
  });
});

describe('isNoiseLine', () => {
  it.each(['A', 'B', 'Ｃ', '○', '◯', '〇', '×', '✕', '△', '－', '-', 'ー', 'A B C', '評価', 'ジャンル チェック項目 評価', 'No.', 'CATEGORY'])(
    'drops %s',
    (line) => expect(isNoiseLine(line)).toBe(true),
  );

  it.each(['3', '- 3 -', '－3－', '3/5', '3／5', 'P.3', 'p3', '3ページ', '3 頁'])('drops the page number %s', (line) =>
    expect(isNoiseLine(line)).toBe(true),
  );

  it.each(['手指衛生', 'AB', '消毒剤がある． A', '3階東病棟', '1日1回清掃している．'])('keeps %s', (line) =>
    expect(isNoiseLine(line)).toBe(false),
  );
});

describe('stripTrailingRating', () => {
  it.each([
    ['消毒剤がある． A', '消毒剤がある．'],
    ['消毒剤がある．A', '消毒剤がある．'],
    ['消毒剤がある。○', '消毒剤がある。'],
    ['（交換目安：2週間毎） B', '（交換目安：2週間毎）'],
    ['（交換目安：2週間毎）×', '（交換目安：2週間毎）'],
    ['消毒剤がある －', '消毒剤がある'],
    ['手指消毒をしているA', '手指消毒をしている'],
    ['記録があるＢ', '記録がある'],
    ['手袋を交換している×', '手袋を交換している'],
    ['表示を確認すること○', '表示を確認すること'],
  ])('turns %s into %s', (line, expected) => expect(stripTrailingRating(line)).toBe(expected));

  it.each(['PPE', 'カバー', 'ゴミボックスー', '手指衛生 PPE', '消毒剤がある．', 'ABC', '病棟A', 'ビタミンC', '手指消毒を行うA', '表示「済」○'])('leaves %s as it is', (line) =>
    expect(stripTrailingRating(line)).toBe(line),
  );
});

describe('looksLikeCategory', () => {
  it(`accepts up to ${CATEGORY_MAX_LENGTH} characters without a sentence ending`, () => {
    expect(looksLikeCategory('あ'.repeat(CATEGORY_MAX_LENGTH))).toBe(true);
    expect(looksLikeCategory('あ'.repeat(CATEGORY_MAX_LENGTH + 1))).toBe(false);
  });

  it.each(['点滴ルートが床についていない．', '清掃した。', 'ok.', '整理している', '汚れがない', '記載がある', '確認する', '保管されれる', '守ること'])(
    'rejects the sentence-like %s',
    (text) => expect(looksLikeCategory(text)).toBe(false),
  );

  it.each(['手指衛生', '汚物室・トイレ', 'PPE', 'デバイス関連'])('accepts %s', (text) =>
    expect(looksLikeCategory(text)).toBe(true),
  );
});

describe('classifyLine', () => {
  it('reads a short word, a space and a sentence as a table row', () => {
    expect(classifyLine('手指衛生 消毒剤がある．')).toEqual({ kind: 'row', category: '手指衛生', text: '消毒剤がある．' });
  });

  it('does not split a category name that contains a space', () => {
    expect(classifyLine('汚物室 トイレ')).toEqual({ kind: 'category', name: '汚物室 トイレ' });
  });

  it('does not split when the first word is long or ends like a sentence', () => {
    const longHead = `${'あ'.repeat(CATEGORY_MAX_LENGTH + 1)} 消毒剤がある．`;
    expect(classifyLine(longHead)).toEqual({ kind: 'item', text: longHead });
    expect(classifyLine('確認した． 消毒剤がある．')).toEqual({ kind: 'item', text: '確認した． 消毒剤がある．' });
  });

  it('reads a long line without a full stop as an item', () => {
    const text = '洗浄用スポンジは乾燥し易い様に保管（交換目安：2週間毎）';
    expect(classifyLine(text)).toEqual({ kind: 'item', text });
  });

  it('drops the heading number of a numbered item and still splits a row', () => {
    expect(classifyLine('1. 手指衛生 消毒剤がある．')).toEqual({ kind: 'row', category: '手指衛生', text: '消毒剤がある．' });
  });
});

describe('hasNumberColumn', () => {
  it('is true when every row starts with a different number followed by two more cells', () => {
    expect(hasNumberColumn([['1', '手指衛生', 'a'], ['2', '', 'b'], ['10', '環境', 'c', 'A']])).toBe(true);
  });

  it.each<[string, string[][]]>([
    ['no rows', []],
    ['a repeated number (numbers used as category names)', [['1', 'a', 'A'], ['1', 'b', 'B']]],
    ['a blank first cell (merged number categories)', [['1', 'a', 'A'], ['', 'b', 'B']]],
    ['a row of two cells', [['1', 'a', 'A'], ['2', 'b']]],
    ['a first cell that is not only digits', [['1', '手指衛生', 'a'], ['2.', '環境', 'b']]],
    ['a sentence in the second column (numbers as category names)', [['1', '手洗いを行う．', '備考'], ['2', '清掃されている', '要再確認']]],
    ['only ratings or blanks in the third column (numbers as category names)', [['1', 'a．', 'A'], ['2', 'b．', ''], ['3', 'c．', '○']]],
  ])('is false with %s', (_, rows) => {
    expect(hasNumberColumn(rows)).toBe(false);
  });
});
