import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATEGORY_MAX_LENGTH, WRAP_TAIL_MAX_LENGTH, isWrappedItemTail, parseChecklistText } from '../checklistText';
import { CHECKLIST_CATEGORIES } from '../checklistData';
import type { DraftCategory } from '../checklistEditor';

// Text recognised from photos of a paper table: items and category names wrapped in their cells.

function simplify(categories: DraftCategory[]) {
  return categories.map((cat) => ({ name: cat.name, items: cat.items.map((item) => item.description) }));
}

const STANDARD = CHECKLIST_CATEGORIES.map((cat) => ({
  name: cat.category,
  items: cat.items.map((item) => item.description),
}));

const lines = (...rows: string[]) => rows.join('\n');

describe('parseChecklistText on text recognised from a photo of the report table', () => {
  // macOS Vision (the engine of iPhone Live Text) on a slanted photo of the report's table shown on a
  // screen: long items and "汚物室・トイレ" wrap in their cells, "．" is often read as "、" or "。",
  // a few characters are misread, and the editor's title and find bar are read too.
  const sample = readFileSync(fileURLToPath(new URL('./fixtures/paper-livetext-sample.txt', import.meta.url)), 'utf8');

  it('joins wrapped items and the wrapped category name, keeping the rest of the screen as read', () => {
    expect(simplify(parseChecklistText(sample))).toEqual([
      { name: 'X', items: [] },
      { name: '1，チェックリスト', items: [] },
      {
        name: '手指衛生',
        items: [
          '病室の入退室時に手指衛生が行えている、',
          '手指衛生剤に開封日の記載がある、年度も記載している、月1回残量確認実施している。',
        ],
      },
      {
        name: '水回り',
        items: [
          '洗浄用スポンジは乾燥し易い様に保管、原則タワシはNG、（交換目安：2週間毎）',
          'シンク回りに氷枕などが掛かっていない。（水跳ねしない場所で管理）',
          'シンクは定期に清掃され、周辺に水はねがなく、清潔に保たれている。',
        ],
      },
      { name: '薬品', items: ['薬品保冷庫内は整理整額され、清掃が行き届いている。', '薬品や消毒薬は、開封日の記載があり、期限切れがない。'] },
      { name: 'リネン等', items: ['清潔リネンは汚染しないよう保管されている。', '医療廃棄物の分別・表示が適切で遵守されている、'] },
      {
        name: '処置室',
        items: [
          '清潔物品と不潔物品が混在せず、区別して配置している、物品は清潔に保管している。',
          '包交車に搭載する物品は最小限（目安は1日分）とし清潔と不潔区域を区別している、',
          '検体保管・運搬容器に破損や汚染がない。',
        ],
      },
      {
        name: 'PPE',
        items: [
          'PPE（個人防護具）がすぐに使用できるよう適切な場所に設置されている。',
          '経路別予防策に応じた必要なPPEが患者の部屋に設置されており、使用している、',
          'PPEを着たまま廊下を歩いているスタッフがいない、（非液時のみ可）',
        ],
      },
      { name: '日常清掃', items: ['パソコン、ナースコール等、高頻度接触面に汚れや埃がない。', '浴室の清掃がいきわたり、カビの紫額がない。'] },
      { name: 'デバイス関連', items: ['膀胱留置カテーテルが屈曲していない。床についていない。', '点滴ルートが床についていない。'] },
      {
        name: '汚物室・トイレ',
        items: ['汚物処理室の清潔が保たれている、', 'エリアが清潔・不潔と区別されている、手洗いシンクに不潔物を置かない。'],
      },
      { name: 'Find', items: ['Find All Match Case Match Diacritics /'] },
      { name: '昌｜Page', items: ['1of 2 1,114 words, 1,159 characters 1 Default Page Style Japanese 1 Insert'] },
    ]);
  });

  it('has the categories and item counts of the photographed part of the standard checklist', () => {
    const photographed = STANDARD.map((cat) => (cat.name === '汚物室・トイレ' ? { ...cat, items: cat.items.slice(0, 2) } : cat));
    const read = simplify(parseChecklistText(sample)).filter((cat) => cat.items.some((item) => /[ぁ-ん]/.test(item)));
    expect(read.map((cat) => [cat.name, cat.items.length])).toEqual(photographed.map((cat) => [cat.name, cat.items.length]));
  });
});

describe('parseChecklistText: items and category names wrapped in their cells', () => {
  it('joins the tail of a wrapped item to it, in every line format', () => {
    expect(simplify(parseChecklistText(lines('手指衛生', '月1回の残量確認を毎月実施してい', 'る．', '病室の入口と廊下に手指衛生の掲示があ', 'る、 A')))).toEqual([
      { name: '手指衛生', items: ['月1回の残量確認を毎月実施している．', '病室の入口と廊下に手指衛生の掲示がある、'] },
    ]);
    expect(simplify(parseChecklistText(lines('手指衛生 月1回の残量確認を毎月実施してい', 'る．', '手指衛生 掲示がある．')))).toEqual([
      { name: '手指衛生', items: ['月1回の残量確認を毎月実施している．', '掲示がある．'] },
    ]);
    expect(simplify(parseChecklistText(lines('■手指衛生', '月1回の残量確認を毎月実施してい', 'る．')))).toEqual([
      { name: '手指衛生', items: ['月1回の残量確認を毎月実施している．'] },
    ]);
  });

  it('keeps a short line as its own item or category when the item above is complete or there is none', () => {
    expect(simplify(parseChecklistText(lines('手指衛生', '掲示がある．', 'いる．', '交換の記録を残している', 'こと．', 'スポンジを交換する（目安：2週間毎）', 'する．')))).toEqual([
      { name: '手指衛生', items: ['掲示がある．', 'いる．', '交換の記録を残している', 'こと．', 'スポンジを交換する（目安：2週間毎）', 'する．'] },
    ]);
    expect(simplify(parseChecklistText(lines('手指衛生', 'る．', '環境')))).toEqual([
      { name: '手指衛生', items: ['る．'] },
      { name: '環境', items: [] },
    ]);
  });

  it('does not join a category, a marked line, a bare number or a longer sentence to an unfinished item', () => {
    expect(simplify(parseChecklistText(lines('手指衛生', '月1回の残量確認を毎月実施してい', '環境', '病室の入口の掲示を毎日確認してい', '1.', '清掃を行う．')))).toEqual([
      { name: '手指衛生', items: ['月1回の残量確認を毎月実施してい'] },
      { name: '環境', items: ['病室の入口の掲示を毎日確認してい', '清掃を行う．'] },
    ]);
    expect(simplify(parseChecklistText(lines('■手指衛生', '月1回の残量確認を毎月実施してい', '■ る．')))).toEqual([
      { name: '手指衛生', items: ['月1回の残量確認を毎月実施してい'] },
      { name: 'る．', items: [] },
    ]);
  });

  it('keeps two short items apart when the first does not end like a sentence', () => {
    expect(simplify(parseChecklistText(lines('■環境', '清掃を実施', '確認する')))).toEqual([
      { name: '環境', items: ['清掃を実施', '確認する'] },
    ]);
  });

  it('keeps a short item without a full stop apart from an unfinished long item', () => {
    expect(simplify(parseChecklistText(lines('■環境', '病棟の入口に手指消毒剤を設置して', '確認する')))).toEqual([
      { name: '環境', items: ['病棟の入口に手指消毒剤を設置して', '確認する'] },
    ]);
  });

  it('keeps a short row with its own category after an unfinished long item', () => {
    expect(simplify(parseChecklistText(lines('環境 病棟の入口に手指消毒剤を設置して', '薬 有．')))).toEqual([
      { name: '環境', items: ['病棟の入口に手指消毒剤を設置して'] },
      { name: '薬', items: ['有．'] },
    ]);
  });

  it('joins the end of a category name wrapped in its cell when the next row repeats the cut name', () => {
    const text = lines('汚物室・トイ 清潔が保たれている． A', 'レ', '汚物室・トイ 区別されている．', 'レ', '汚物室•トイ 置かない．', 'レ');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '汚物室・トイレ', items: ['清潔が保たれている．', '区別されている．', '置かない．'] },
    ]);
  });

  it('keeps a category after a row when the next row does not repeat the cut name', () => {
    expect(simplify(parseChecklistText(lines('検体 破損がない．', 'PPE', 'PPE 設置されている．')))).toEqual([
      { name: '検体', items: ['破損がない．'] },
      { name: 'PPE', items: ['設置されている．'] },
    ]);
    expect(simplify(parseChecklistText(lines('汚物室・トイ 清潔が保たれている．', 'レ')))).toEqual([
      { name: '汚物室・トイ', items: ['清潔が保たれている．'] },
      { name: 'レ', items: [] },
    ]);
    expect(simplify(parseChecklistText(lines('手指衛生', '清潔が保たれている．', 'レ', '手指衛生 掲示がある．')))).toEqual([
      { name: '手指衛生', items: ['清潔が保たれている．', '掲示がある．'] },
      { name: 'レ', items: [] },
    ]);
  });

  it('does not join when the whole name is already a category or would be too long for one', () => {
    expect(simplify(parseChecklistText(lines('環境A 清掃されている．', '環境 記録がある．', 'A', '環境 掲示がある．')))).toEqual([
      { name: '環境A', items: ['清掃されている．'] },
      { name: '環境', items: ['記録がある．', '掲示がある．'] },
    ]);
    const cut = 'あ'.repeat(CATEGORY_MAX_LENGTH - 1);
    expect(simplify(parseChecklistText(lines(`${cut} 清掃されている．`, 'いい', `${cut} 掲示がある．`)))).toEqual([
      { name: cut, items: ['清掃されている．', '掲示がある．'] },
      { name: 'いい', items: [] },
    ]);
  });
});

describe('isWrappedItemTail', () => {
  /** Text long enough to have filled its cell. */
  const LONG = '清潔物品と不潔物品を区別して';

  it(`accepts a tail of up to ${WRAP_TAIL_MAX_LENGTH} characters after an item that stops mid-word`, () => {
    expect(isWrappedItemTail(LONG + '配置してい', 'る．')).toBe(true);
    expect(isWrappedItemTail(LONG + '配置してい', 'る、')).toBe(true);
    expect(isWrappedItemTail(LONG + '配置し', 'ている。')).toBe(true);
    expect(isWrappedItemTail(LONG + '配置し', 'ていない。')).toBe(false);
    expect(isWrappedItemTail(LONG + '配置し', 'て'.repeat(WRAP_TAIL_MAX_LENGTH - 1) + '．')).toBe(true);
    expect(isWrappedItemTail(LONG + '配置し', 'て'.repeat(WRAP_TAIL_MAX_LENGTH) + '．')).toBe(false);
  });

  it.each<[string, string]>([
    [`${LONG}配置している．`, 'る．'],
    [`${LONG}配置している、`, 'る．'],
    [`${LONG}配置している`, 'る．'],
    [`${LONG}（2週間毎）`, 'る．'],
    [`${LONG}配置してい`, 'る'],
    [`${LONG}配置してい`, '1.'],
    [`${LONG}配置してい`, 'A．'],
    [`${LONG}配置してい`, 'レ'],
    [`${LONG}配置してい`, 'いる'],
    ['清掃を実施', '確認する'],
    ['あ'.repeat(CATEGORY_MAX_LENGTH), 'る．'],
  ])('rejects %s followed by %s', (item, line) => expect(isWrappedItemTail(item, line)).toBe(false));

  it(`needs the item to be longer than ${CATEGORY_MAX_LENGTH} characters`, () => {
    expect(isWrappedItemTail('あ'.repeat(CATEGORY_MAX_LENGTH + 1), 'る．')).toBe(true);
  });
});
