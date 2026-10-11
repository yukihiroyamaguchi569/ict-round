import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CATEGORY_MAX_LENGTH,
  SUBHEADING_MAX_LENGTH,
  classifyLine,
  continuesItem,
  isNoiseLine,
  looksLikeCategory,
  parseChecklistText,
  rowNumberContinues,
} from '../checklistText';
import type { DraftCategory } from '../checklistEditor';

// Rules for real paper checklists recognised from photos: a number column without delimiters, Roman numeral
// and dotted subheadings, single characters picked up from a vertical category column, a particle before a
// comma, and the form's fill-in fields and legend.

function simplify(categories: DraftCategory[]) {
  return categories.map((cat) => ({ name: cat.name, items: cat.items.map((item) => item.description) }));
}

const lines = (...rows: string[]) => rows.join('\n');

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

describe('parseChecklistText on text recognised from photos of three more real paper checklists', () => {
  // Each fixture: a page of a public PDF drawn as a photo of paper, then recognised by macOS Vision
  // (ja-JP, accurate), the engine of iPhone Live Text.

  it('reads the ward check sheet: fill-in fields dropped, a vertical category column left unread', () => {
    // Nagoya University Hospital "感染対策チェックシート 病棟" (public PDF, 1 page). The place column is written
    // vertically and is not read, apart from stray single characters ("フ" "物" "理" "室") at the start of
    // lines. The items stay in the title's category (nothing marks where the title ends); the legend line
    // stays as an item for the user to delete in the preview. "…を用いて" then "適切に…" stays in two.
    expect(simplify(parseChecklistText(fixture('paper-livetext-ward-sheet.txt')))).toEqual([
      {
        name: '感染対策チェックシート病棟',
        items: [
          '評価項目★：重点評価項目 無印：自己チェック項目 評価',
          '★各病室にアルコール手指消毒薬、手袋、エブロン、マスクが設置されている',
          '床や廊下に物品が放置されていない',
          '★退室時の清掃方法が明文化され実施状況が記録されている。記録がない場合は、清掃担当部門との調整を行っている',
          'アルコール手指消毒薬に開封日あるいは使用限を記載し、使用期限を守っている',
          '★手洗いシンクは自動水栓である',
          'ハンドソープは継ぎ足ししていない',
          '★ペーパータオルはビニールを外してホルダーに収納している',
          '★シンクは定期的に清掃しできる限り乾燥している',
          '★感染性廃棄物をスタッフステーション内に持ち込んでいない。構造上の問題でフ スタッフステーションが廃棄スペースへの通路となっている場合は、持ち込んだ',
          '清潔用針廃棄物の容器以外の不必要なものは置いていない',
          '作業前にアルコールクロスまたは環境クロスで作業面を清拭している',
          'アルコール綿は単包を使用している',
          '輸液架台に輸液以外を吊り下げていない',
          '★注射薬調製台が排気口の下に位置していない。構造上の問題で位置が変えれない場合は、風よけなどの対策がなされている',
          '注射薬調製台は流し台や廃棄物の容器と距離があり汚染することがない',
          '滅菌器材保管庫の扉が閉まっている',
          '減菌器材は床上20cm以内に置かれていない',
          '包交車は廃止している、または最小限の物品のみ搭載している',
          '開栓後の消毒薬に開封日あるいは使用期限を記載し、使用期限を守っている',
          '消毒する場合には有効濃度域の消毒薬に確実に浸漬している',
          '★器材洗浄用シンクに使用後の器材を置いたままにしていない',
          '器材洗浄用シンクの周囲に清潔物品を置いていない',
          '廃棄物の容器に分別の表示がされている',
          '感染廃棄物の容器の分別が正しく行われている',
          '物 感染性廃棄物の容器の中身は八分目以下である',
          '患者に使用した針はリキャップしていない',
          '★アルコール手指消毒薬、手袋、エプロン、マスク、アイガードが設置されている',
          '洗浄前の物品を扱うエリアと洗浄後の物品を扱うエリアは区別され交差していない',
          '器材洗浄用シンクに使用後の器材を置いたままにしていない',
          '汚染したスポンジやブラシはなく、適切な管理をしている',
          '汚物処理室に臭気がない',
          '理 汚物処理槽に汚物の停滞がない',
          '室 床に水や汚物がこぼれていない',
          '尿器、便器、陰部洗浄ボトル等はベッドパンウォッシャー等を用いて',
          '適切に洗浄消毒をおこなっている',
          '不要な蓄尿は行っていない、または蓄尿の基準が設けられている',
        ],
      },
      {
        name: '浴室',
        items: [
          'ストレッチャーや椅子にカビがない',
          '★浴室に埃やカビがない。カビがある場合は清掃業者や施設管理部門に改善を依頼している',
        ],
      },
    ]);
  });

  it('reads the self-management sheet: a number column without delimiters, dotted subheadings', () => {
    // Ehime Prefecture "院内感染防止対策自主管理票 令和4年度版" (public PDF), page 6. The number column is centred,
    // so a wrapped item has its number on the second line ("…清潔授布）を" then "100 行っている。"); "1104" is a
    // misread "104". With "■" lines marked, "ア" / "イ" subheadings stay items, and wraps without a clue stay in two.
    expect(simplify(parseChecklistText(fixture('paper-livetext-self-check.txt')))).toEqual([
      { name: '輸液に関する対策', items: [] },
      {
        name: '共通項目',
        items: [
          '点滴の調製は、消毒用エタノール等で消毒した専用の清潔区域で行っている。',
          '調製作業は、手指衛生の後マスク、手袋を着用して実施している。',
          '調製は点滴を実施する直前に行う。保管が必要な場合は冷蔵庫で保管している。',
          '輸液ラインの交換間隔に関する基準を確認している。',
          '挿入部に滅菌したドレッシング材を使用し、定期的に交換している。',
          '挿入部の感染兆候を定期に確認している。',
          'カテーテルロックに使用するヘパリン生理食塩水は作り置きしていない。',
        ],
      },
      {
        name: '中心静脈カテーテルの衛生管理について',
        items: [
          '高カロリー輸液は混合時間を含め28時間以内に投与を終了している。',
          'カテーテル挿入部位は感染リスク等を考慮して選択している。',
          'カテーテル挿入時は高度バリアプレコーション（清潔手袋、滅菌ガウン、マスク、帽子、清潔授布）を行っている。',
          'カテーテル挿入部の消毒には、クロルヘキシジン（ヒビデン等）またはヨード消毒液（インジン等）を用いている。',
          '三方活栓は、極力使用しないようにしている。やむを得ず三方活栓から薬液を注入する場合は、酒精綿等で厳重に消毒している。',
        ],
      },
      {
        name: '患者の周辺環境の整備等',
        items: [
          'シンク周辺で清潔と不潔の交差がない（流しなどの排水口及び湿潤部位などは必ず汚染しているものと考え、水の跳ね返りによる汚染に留意する）。',
          '床に近い棚（30cm以内）に清潔な器具を保管しない。',
          '清掃は次の3つに分して実施している。',
          '日常清掃（毎日行う清掃）床の清掃は洗剤を用いた湿式清掃を行う。手指が高頻度に接触するドアノブ、ベッド',
          '柵等は清拭または必要に応じて消毒する',
          '定期清掃（一定期間ごとに行う清掃）カーテン、壁面等',
          '緊急清掃（血液、体液、排泄物などによる汚染に対する清掃）防護具を着用し、局所の除染と消毒を行う',
          '廃棄物は「廃棄物処理法に基づく感染性廃棄物処理マニュアル」に掲げられた基準を遵守し、適切に処理されている。',
          '廃棄物の発生場所で感染性医療廃棄物と非感染性廃棄物とを区別している',
          '感染性医療廃棄物は破損や漏出しない保管容器を使用し、常時蓋をしている',
          '感染性医療廃棄物は液状のもの、固形のもの、鋭利なものに分類し、容器には取扱い時の注意事項を表示し',
          'ている',
          '清潔区域と不潔区域を（区別を表示しているなどして）区別している。',
          '★ 給水設備、給湯設備の保守管理を適正に行っている。',
          '給水施設について、定期又は臨時の水質検査を実施している。',
          'ア専用水道を使用する病院',
          '色及び濁り並びに消毒の残留効果に関する検査（1日1回）',
          '化学分析及び細菌検査等の水質検査（1月1回）',
          'イ簡易専用水道を使用する病院',
          '公的機関の検査を受けている（年1回）',
          '受水槽の清掃が行われている（年1回）',
        ],
      },
    ]);
  });

  it('reads the round check sheet: Roman numeral subheadings and numbers on the middle line of wrapped items', () => {
    // Hyogo Prefecture (Hanshin-kita) "医療機関における感染症対策ガイドブック" 分野別4 "院内ラウンドチェックシート"
    // (public PDF), page 1. "Ⅰ" / "Ⅳ" are read as "I"; number-only lines left by dropped text and the page
    // number "88" are dropped. "…擦式アルコール手" then "指消毒剤を…" has nothing to mark the wrap.
    expect(simplify(parseChecklistText(fixture('paper-livetext-round-sheet.txt')))).toEqual([
      { name: '院内ラウンドチェックシート', items: [] },
      { name: '手指衛生', items: [] },
      {
        name: '全般',
        items: [
          '手洗いや擦式アルコール手指消毒剤を適切に配置している',
          '必要時、擦式アルコール手指消毒剤を携帯している',
          '擦式アルコール手指消毒剤の期限切れチェックができている',
          '固形石鹸を使用していない',
          '液体石鹸は継ぎ足ししていない',
          '流水で石鹸を15秒以上かけて十分に洗い流している',
          'ペーパータオルで押さえるように拭いている',
          'ペーパータオルをホルダーに入れている',
          '自動でない水道の開閉は、使用後のペーパータオルを使用するなど直接接触しない工夫をしている',
        ],
      },
      {
        name: '擦式アルコール手指消毒剤による手洗い',
        items: [
          '目にみえる汚染がない場合、擦式アルコール手',
          '指消毒剤を使用した手指消毒を実施している',
          '一回必要量が十分押し出せている',
          '15秒以上かけて乾燥させている',
          '手順に沿って擦式アルコール手指消毒剤を手指から手全体および手首に広げ、擦っている',
        ],
      },
    ]);
  });
});

describe('classifyLine: a number column without delimiters (rule F)', () => {
  it('drops a number and a space at the start of a line', () => {
    expect(classifyLine('91 点滴の調製は清潔区域で行っている。')).toEqual({ kind: 'item', text: '点滴の調製は清潔区域で行っている。' });
    expect(classifyLine('1 手指衛生')).toEqual({ kind: 'category', name: '手指衛生' });
    expect(classifyLine('1104 床に近い棚に清潔な器具を保管しない。')).toEqual({ kind: 'item', text: '床に近い棚に清潔な器具を保管しない。' });
  });

  it('drops a star stuck to the number, but keeps a star after a space', () => {
    expect(classifyLine('109★ 化学分析及び細菌検査等の水質検査（1月1回）')).toEqual({ kind: 'item', text: '化学分析及び細菌検査等の水質検査（1月1回）' });
    expect(classifyLine('109☆ 化学分析及び細菌検査等の水質検査（1月1回）')).toEqual({ kind: 'item', text: '化学分析及び細菌検査等の水質検査（1月1回）' });
    expect(classifyLine('108 ★ 給水設備の保守管理を適正に行っている。')).toEqual({ kind: 'item', text: '★ 給水設備の保守管理を適正に行っている。' });
  });

  it('drops only the first number', () => {
    expect(classifyLine('3 15秒以上かけて乾燥させている')).toEqual({ kind: 'item', text: '15秒以上かけて乾燥させている' });
  });

  it.each(['15秒以上かけて乾燥させている', '3階東病棟の清掃をしている', '9パータオルを使用している'])(
    'keeps a number followed by text without a space: %s',
    (line) => expect(classifyLine(line)).toEqual({ kind: 'item', text: line }),
  );

  it('still drops a number-only line as a page number', () => {
    expect(isNoiseLine('6')).toBe(true);
    expect(isNoiseLine('88')).toBe(true);
  });
});

describe('rowNumberContinues (rule G)', () => {
  it('is true after an item that does not end like a sentence', () => {
    expect(rowNumberContinues('手洗いや擦式アルコール手指消毒剤を適切に配', false)).toBe(true);
    expect(rowNumberContinues('清潔授布）を', false)).toBe(true);
    expect(rowNumberContinues('記録がない場合は、', false)).toBe(true);
  });

  it.each<[string, string, boolean]>([
    ['an item ending with a full stop', '清潔区域で行っている。', false],
    ['an item ending with a predicate', '固形石鹸を使用していない', false],
    ['an item ending with a comma read for a full stop', '行えている、', false],
    ['an item ending with a closed bracket', '色及び濁りに関する検査（1日1回）', false],
    ['an item that started with a heading number', '③緊急清掃 局所の除染と消毒を行う', true],
  ])('is false after %s', (_, item, numbered) => expect(rowNumberContinues(item, numbered)).toBe(false));
});

describe('parseChecklistText: lines starting with a number continue an unfinished item (rule G)', () => {
  it('joins "number + space" lines, without the number, to an unfinished item', () => {
    expect(simplify(parseChecklistText(lines('全般', '手洗いや擦式アルコール手指消毒剤を適切に配', '1 置している', '2 固形石鹸を使用していない')))).toEqual([
      { name: '全般', items: ['手洗いや擦式アルコール手指消毒剤を適切に配置している', '固形石鹸を使用していない'] },
    ]);
  });

  it('joins a number stuck to kana only when the item above is unfinished', () => {
    expect(simplify(parseChecklistText(lines('全般', '自動でない水道の開閉は、使用後のペー', '9パータオルを使用する工夫', 'をしている')))).toEqual([
      { name: '全般', items: ['自動でない水道の開閉は、使用後のペーパータオルを使用する工夫をしている'] },
    ]);
    expect(simplify(parseChecklistText(lines('全般', '水道の開閉に注意している', '9パータオルを使用している')))).toEqual([
      { name: '全般', items: ['水道の開閉に注意している', '9パータオルを使用している'] },
    ]);
  });

  it('starts a new item after a complete item, a closed bracket, a numbered item or a category', () => {
    expect(simplify(parseChecklistText(lines('全般', '手洗いをしている。', '1 置している')))).toEqual([
      { name: '全般', items: ['手洗いをしている。', '置している'] },
    ]);
    expect(simplify(parseChecklistText(lines('■水', '水質検査（1日1回）', '109★ 化学分析（1月1回）')))).toEqual([
      { name: '水', items: ['水質検査（1日1回）', '化学分析（1月1回）'] },
    ]);
    expect(simplify(parseChecklistText(lines('■清掃', '③緊急清掃 局所の除染と消毒を行う', '106 廃棄物を適切に処理している。')))).toEqual([
      { name: '清掃', items: ['緊急清掃 局所の除染と消毒を行う', '廃棄物を適切に処理している。'] },
    ]);
    expect(simplify(parseChecklistText(lines('全般', '手洗いや擦式アルコール手指消毒剤を適切に配', '環境', '1 置している')))).toEqual([
      { name: '全般', items: ['手洗いや擦式アルコール手指消毒剤を適切に配'] },
      { name: '環境', items: ['置している'] },
    ]);
  });

  it('keeps the rule for delimited numbers: a numbered line after an unfinished numbered item starts a new item', () => {
    expect(simplify(parseChecklistText(lines('■環境', '1）容器が管理されている（蓋が', '2）容器が設置してある')))).toEqual([
      { name: '環境', items: ['容器が管理されている（蓋が', '容器が設置してある'] },
    ]);
  });

  it('starts a new item at a row-numbered line after a numbered item ending with a particle', () => {
    expect(simplify(parseChecklistText(lines('■環境', '1）容器の管理が', '2 続きを確認する')))).toEqual([
      { name: '環境', items: ['容器の管理が', '続きを確認する'] },
    ]);
  });
});

describe('classifyLine: Roman numeral and lettered subheadings (rule H)', () => {
  it.each(['I 全般', 'Ⅰ 全般', 'Ⅳ 全般', 'IV 全般', 'VIII 全般', 'IX. 全般', 'Ⅻ．全般', 'II、全般', 'A.全般'])('reads %s as a category', (line) =>
    expect(classifyLine(line)).toEqual({ kind: 'category', name: '全般' }),
  );

  it('reads a subheading longer than a category name as a category, up to the limit', () => {
    expect(classifyLine('I 擦式アルコール手指消毒剤による手洗い')).toEqual({ kind: 'category', name: '擦式アルコール手指消毒剤による手洗い' });
    const limit = 'あ'.repeat(SUBHEADING_MAX_LENGTH);
    expect(classifyLine(`Ⅱ ${limit}`)).toEqual({ kind: 'category', name: limit });
    expect(classifyLine(`Ⅱ ${limit}あ`)).toEqual({ kind: 'item', text: `${limit}あ` });
  });

  it('drops the numeral of a subheading that ends like a sentence and reads it by its shape', () => {
    expect(classifyLine('I 手洗いを適切に行っている')).toEqual({ kind: 'item', text: '手洗いを適切に行っている' });
    expect(classifyLine('Ｃ．病室 1）手洗い場がある')).toEqual({ kind: 'row', category: '病室', text: '手洗い場がある', numbered: true });
  });

  it.each(['X線室の清掃', 'IVHの管理', '病棟I 全般'])('keeps %s, which has no separator after the numeral', (line) =>
    expect(classifyLine(line)).toEqual({ kind: 'category', name: line }),
  );

  it('keeps Arabic heading numbers to the shape of a category name', () => {
    const long = 'あ'.repeat(CATEGORY_MAX_LENGTH + 1);
    expect(classifyLine(`1. ${long}`)).toEqual({ kind: 'item', text: long });
  });

  it('reads every unmarked subheading as an item, without its numeral, once marked lines exist', () => {
    expect(classifyLine('I 全般', true)).toEqual({ kind: 'item', text: '全般' });
  });
});

describe('classifyLine: a dot without a space (rule I)', () => {
  it('drops the dot and reads a category-shaped rest as a category, in both modes', () => {
    expect(classifyLine('・共通項目')).toEqual({ kind: 'category', name: '共通項目' });
    expect(classifyLine('・病室')).toEqual({ kind: 'category', name: '病室' });
    expect(classifyLine('・中心静脈カテーテルの衛生管理について')).toEqual({ kind: 'category', name: '中心静脈カテーテルの衛生管理について' });
    expect(classifyLine('・共通項目', true)).toEqual({ kind: 'category', name: '共通項目' });
  });

  it('keeps the dot on an item-shaped line', () => {
    expect(classifyLine('・手洗い場が整備されている')).toEqual({ kind: 'item', text: '・手洗い場が整備されている' });
    expect(classifyLine('・手洗い場が整備されている', true)).toEqual({ kind: 'item', text: '・手洗い場が整備されている' });
    const long = 'あ'.repeat(SUBHEADING_MAX_LENGTH + 1);
    expect(classifyLine(`・${long}`)).toEqual({ kind: 'item', text: `・${long}` });
  });

  it('does not count a dotted line as a mark, so the other lines are still read by their shape', () => {
    expect(simplify(parseChecklistText(lines('・共通項目', '環境', '清掃されている．')))).toEqual([
      { name: '共通項目', items: [] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('does not join a dotted subheading or a Roman numeral subheading to an unfinished item', () => {
    expect(simplify(parseChecklistText(lines('全般', '手洗いや擦式アルコール手指消毒剤を適切に配置して', '・共通項目', 'I 全般')))).toEqual([
      { name: '全般', items: ['手洗いや擦式アルコール手指消毒剤を適切に配置して'] },
      { name: '共通項目', items: [] },
    ]);
  });
});

describe('classifyLine: a row needs a head of two characters or more (rule J)', () => {
  it('does not split a row with a single-character head', () => {
    expect(classifyLine('室 床に水や汚物がこぼれていない')).toEqual({ kind: 'item', text: '室 床に水や汚物がこぼれていない' });
    expect(classifyLine('フ スタッフステーションが通路となっている場合は')).toEqual({
      kind: 'item',
      text: 'フ スタッフステーションが通路となっている場合は',
    });
    expect(classifyLine('★ 給水設備の保守管理を適正に行っている。')).toEqual({ kind: 'item', text: '★ 給水設備の保守管理を適正に行っている。' });
  });

  it('splits a row with a two-character head', () => {
    expect(classifyLine('浴室 ストレッチャーや椅子にカビがない')).toEqual({
      kind: 'row', category: '浴室', text: 'ストレッチャーや椅子にカビがない', numbered: false,
    });
  });

  it('reads a single character with a short rest by its shape', () => {
    expect(classifyLine('フ 病室')).toEqual({ kind: 'category', name: 'フ 病室' });
  });
});

describe('continuesItem: a particle before a comma (rule K)', () => {
  it.each(['記録がない場合は、', '場合は，', '場合は,', '手袋の、', '場合に、', 'ことで、'])('joins the next line to %s', (item) =>
    expect(continuesItem(item, '清掃担当部門との調整を行っている', false)).toBe(true),
  );

  it.each(['病室の入退室時に手指衛生が行えている、', '清掃し、', '手袋、マスク、'])('keeps the next line apart from %s', (item) =>
    expect(continuesItem(item, '清掃担当部門との調整を行っている', false)).toBe(false),
  );

  it('does not read a particle before a comma as a sentence ending', () => {
    expect(looksLikeCategory('場合は、')).toBe(true);
    expect(looksLikeCategory('いる、')).toBe(false);
  });

  it('joins a line starting with "から" to an unfinished item only', () => {
    expect(continuesItem('手順に沿って消毒剤を手指', 'から手全体に広げ、擦っている', false)).toBe(true);
    expect(continuesItem('消毒剤を手指に広げている', 'から拭きをしている', false)).toBe(false);
  });
});

describe('isNoiseLine: fill-in fields and the legend (rule L)', () => {
  it.each(['場所', '部署', '施設名', '評価日', '評価者', '点検者', '点検日', '記入者', '日付', 'コメント', '根拠', 'できている', 'できていない', '該当なし', 'NA', 'n/a', 'N/A'])(
    'drops the header word %s',
    (line) => expect(isNoiseLine(line)).toBe(true),
  );

  it.each(['評価・できている', '施設名：', '施設名:', '部署： NA 該当なし', '施設名： × できていない', '評価日： 評価者：'])('drops %s', (line) =>
    expect(isNoiseLine(line)).toBe(true),
  );

  it.each(['汚物室・トイレ', '評価・確認', '施設名：〇〇病院', '場所：病棟', '：', '評価項目★：重点評価項目 無印：自己チェック項目 評価'])('keeps %s', (line) =>
    expect(isNoiseLine(line)).toBe(false),
  );
});
