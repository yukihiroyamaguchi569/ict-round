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

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

describe('parseChecklistText on text recognised from photos of real paper checklists', () => {
  // Both fixtures: a page of a public PDF drawn as a photo of paper (slant, keystone, blur, uneven light,
  // noise), then recognised by macOS Vision (ja-JP, accurate), the engine of iPhone Live Text.

  it('reads the MHLW check sheet: numbered merged categories with numbered items', () => {
    // MHLW "別紙24 感染対策向上加算1 チェック項目表", page 3. "1." read as "•" before "病室".
    expect(simplify(parseChecklistText(fixture('paper-livetext-mhlw-form.txt')))).toEqual([
      {
        name: '外来処置室',
        items: [
          '利器材の廃棄容器が安全に管理されている （廃棄容器の蓋が開いていない、など',
          '鋭利器材の廃棄容器が処置を行う場所の近くに設置してある',
          '検査検体が適切に保管してある',
        ],
      },
      {
        name: '抗がん化学療法外来',
        items: ['薬剤の無菌調製が適切に実施されている', '咳エチケットが確実に実施されている', '患者および職員の手指衛生が適切に行われている'],
      },
      { name: '病棟', items: [] },
      {
        name: '病室',
        items: [
          '部屋ごとに手洗い場がある',
          '床や廊下に品が放置されていない',
          '必要なコホーティングが行われている',
          '隔離個室の医療器具は専用化されている',
          '隔離個室には必要なPPEが準備されている',
          '空調のメンテナンスが行われ、HEPA filterが定期的に交換されている',
        ],
      },
      {
        name: 'スタッフステーション',
        items: [
          '水道のシンク外周が擦拭され乾燥している',
          '鋭利機材の廃棄容器が適切に管理されている',
          '鋭利機材の廃棄容器が必要な場所に設置されている',
          '臨床検体の保存場所が整備されている',
        ],
      },
      {
        name: '処置室',
        items: [
          '清潔区域と不潔区域を区別している',
          '減菌機材が適切に保管され、使用期限のチェックが行われている',
          '包交車が清潔と不潔のソーニングがなされている',
          '包交車に不要な滅菌機材が積まれていない',
        ],
      },
      {
        name: '薬剤の管理',
        items: ['清潔な状況下で輸液調整が実施されている', '希釈調製したへパリン液は室温に放置されていない', '薬品保管庫の中が整理されている'],
      },
    ]);
  });

  it('reads the journal intervention list: lettered sections and items wrapped over numbered lines', () => {
    // Tokyo Healthcare University "ICT ラウンド時介入項目リスト 2010 年版" (Journal of Healthcare-associated
    // Infection 2010;1:22-26), page 3. The number column is centred in its cell, so "6." lands on a middle line
    // of a wrapped item. Where nothing marks a wrap ("…病院感" then "染の場合…") the item stays in two.
    expect(simplify(parseChecklistText(fixture('paper-livetext-journal-list.txt')))).toEqual([
      { name: '医療関連感染', items: [] },
      {
        name: '特定と対応',
        items: [
          '感染症が病院感染か香かの特定、および、病院感',
          '染の場合その感染経路の特定と対応',
          'ケアー／作業前後の手指衛生（手洗い／擦式消毒）の適正手技、適正遵守と手荒れ対策の実施',
          '個人用防護具 Personal Protective Equipment （手袋、マスク、ガウン／エプロン、アイ・プロテク ター、フェイス・シールドなど）の適切な着用',
          '感染対策上の適切な病棟内患者配置（個別アイソレーション、集団アイソレーション、逆アイソレーション、技術アイソレーション）',
          '下剤/幅吐患者対策（接触感染対策、アイソレーション、下痢便および吐物の汚染拡散防止策）',
          '交差感染の危険性ある症例の適正な把握（当該病棟のスタッフ全員が把握）と個人情報保護',
        ],
      },
      {
        name: '汚染防止と清潔管理',
        items: [
          '汚染機器/器具/リネン等の適切な処理と搬送',
          '細菌汚染を受けやすい消毒薬（第四級アンモニウム塩、両性界面活性剤、ポビドンヨード、低濃度クロルヘキシジンなど）の適正な取り扱い',
          '手指衛生用品（液体石けん、アルコール擦式消毒薬、ペーパータオル等）の供給整備、および、手',
          '指消毒用擦式アルコール製剤ディスペンサーの適正設置（病室内外は施設の状況による）/活用',
          '（使用量チェックが必要）/管理（適切な供給量、故障の有無、ノズルのつまり、など）',
          '患者清拭用タオルの熱水洗浄（芽胞汚染を考慮した適切な洗剤）と保温時清潔管理',
          'アレルギー対策としてのノンパウダー手袋、非ラ',
          'テックス手袋、非アルコール系消毒薬の供給体制',
        ],
      },
      // "整備", the 2-character end of the item above, has nothing to mark it as a wrap
      { name: '整備', items: ['高水準消毒薬（グルタラール、通酢酸、フタラール）暴露対策としての換気対策'] },
      {
        name: '清掃と整備',
        items: [
          '適切な清掃方法、清掃順（清潔度の高い区域からの順次清掃、ほこりを立てない技法、滑らない対策、清掃用具適正管理、病院用掃除機）',
        ],
      },
    ]);
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
    expect(simplify(parseChecklistText(lines('手指衛生', '月1回の残量確認を毎月実施してい', '環境', '病室の入口の掲示を毎日確認してい', '1.', '清掃を毎日行っている．')))).toEqual([
      { name: '手指衛生', items: ['月1回の残量確認を毎月実施してい'] },
      { name: '環境', items: ['病室の入口の掲示を毎日確認してい', '清掃を毎日行っている．'] },
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
    expect(isWrappedItemTail(LONG + '配置し', 'ていない。')).toBe(true);
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

  it('accepts a tail without a full stop when a predicate ending carries on a noun', () => {
    expect(isWrappedItemTail(`${LONG}定期的に交換`, 'されている')).toBe(true);
    expect(isWrappedItemTail(`${LONG}HEPA filter`, 'されている')).toBe(true);
    expect(isWrappedItemTail(`${LONG}交換`, 'さ'.repeat(WRAP_TAIL_MAX_LENGTH - 2) + 'いる')).toBe(true);
    expect(isWrappedItemTail(`${LONG}交換`, 'さ'.repeat(WRAP_TAIL_MAX_LENGTH - 1) + 'いる')).toBe(false);
  });

  it.each<[string, string]>([
    [`${LONG}配置してい`, 'いる'],
    [`${LONG}設置して`, '確認する'],
    [`${LONG}定期的に交換`, '確認する'],
    [`${LONG}定期的に交換`, 'されて'],
  ])('rejects %s followed by %s without a full stop', (item, line) => expect(isWrappedItemTail(item, line)).toBe(false));
});
