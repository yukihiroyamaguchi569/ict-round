import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CATEGORY_MAX_LENGTH,
  SUBHEADING_MAX_LENGTH,
  classifyLine,
  continuesItem,
  isWrappedItemTail,
  parseChecklistText,
  stripAnswerColumn,
} from '../checklistText';
import type { DraftCategory } from '../checklistEditor';

// Rules for real paper checklists with check boxes ("□"), recognised from photos: a check box read as "■",
// "口" or "ロ", a "□はい □いいえ" answer column, a heading number stuck to its name ("2手洗い"), the form's
// title, a katakana word cut at the end of a line, a "て" left open, and a short predicate after a long item.

function simplify(categories: DraftCategory[]) {
  return categories.map((cat) => ({ name: cat.name, items: cat.items.map((item) => item.description) }));
}

const lines = (...rows: string[]) => rows.join('\n');

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

/** Text of exactly n characters, with no sentence ending and no comma. */
const plain = (n: number) => 'あ'.repeat(n - 1) + '表';

describe('parseChecklistText on text recognised from photos of three real paper checklists with check boxes', () => {
  // Each fixture: a page of a public PDF drawn as a photo of paper, then recognised by macOS Vision
  // (ja-JP, accurate), the engine of iPhone Live Text.

  it('reads the dialysis checklist: answer columns dropped, the title a category', () => {
    // Miyazaki Prefecture "透析医療機関における院内感染チェックリスト" (public PDF, 1 page). The vertical category
    // column is not read; its stray single characters ("ス" "ツ" "析") become categories and scatter the items.
    // A row number on the middle line of a three-line item joins it ("…感染性" then "15 作 廃棄物…"), and a
    // stray character before a tail stays ("…透析され" then "操 ている。").
    expect(simplify(parseChecklistText(fixture('paper-livetext-dialysis-yesno.txt')))).toEqual([
      {
        name: '透析医療機関における院内感染チェックリスト',
        items: [
          '透析に使用する医療器具は患者毎に滅菌したものか、ディスポーザブル製品を使っている。',
          'スタッフが透析操作前後に手洗いが容易にできる十分な手洗い設備がある。',
          'スタッフが患者の症状の変化に素早く対応し、また頻回に手洗い等に移動できるよう、十分なベッド間がとられている。',
          '透析装置の保守点検はマニュアルにのっとり、定期に行っている。',
          '回路圧測定系にトランスデューサープロテクターを挿入している。',
          '患者数やその重症度に応じて十分な診療ができるスタッフが配置されている',
        ],
      },
      {
        name: 'ス',
        items: [
          '感染対策委員会が設置され、各職種のスタッフが参加して定期に開',
          '催されており、感染対策委員会委員長は施設の長（責任者）である。',
        ],
      },
      {
        name: 'ツ',
        items: [
          'スタッフに対して感染症対策に関する教育が定期的に行われている。',
          'スタッフには定期健康診断が行われ、希望者にはHBワクチン接種の機会がある。',
          '透析開始・終了操作は清潔不潔概念をよく理解した医師、臨床工学技',
          '土、看護師、准看護師、薬剤師などの有資格者スタッフが行っている。',
          '透析開始、終了操作は患者側と機械側にそれぞれ1名ずつが共同して行っている。',
          'スタッフは侵襲的手技の前後に入念な手洗いを必ず行っている。',
          '透 穿刺および抜針操作をするスタッフは、ディスポーザブルの手袋を装着している。',
        ],
      },
      {
        name: '析',
        items: [
          '肝炎ウイルス陽性の患者は透析室内の一定の位置に固定して透析され操 ている。',
          '血液に汚染された物品は、周囲を汚染しないように注意して、感染性作 廃棄物として廃棄するか、マニュアルにのっとり、洗浄滅菌されている。',
          '透析中に投与される抗凝固薬やエリスロポエチンなどの薬剤は、透析',
          '室から区画された場所で無菌的に準備されている。',
          '透析記録（患者、一回ごとの透析経過、診療内容、担当者名の記録）を作成している。',
          '感染症にたいする患者監視（サーベイランス）として、定期的な検査を実施している。',
          '定期検査の結果は患者に告知され、説明指導が行われている。',
          '患者にはB型肝炎、インフルエンザ等に対するワクチン接種の機会が提供されている。',
        ],
      },
    ]);
  });

  it('reads the check item list: check boxes read as "■" "口" "ロ" dropped, "（2）" headings', () => {
    // Takamatsu City "院内感染対策に係るチェック項目" (public PDF), page 3. The page starts in the middle of a
    // section, so its first items have no category. A check box stuck to its text as "口" or "ロ" stays
    // ("口境整備…", "ロドアノブ…"); "消毒を行う方法", the short end of a wrapped item, is read as a category.
    expect(simplify(parseChecklistText(fixture('paper-livetext-checkbox-list.txt')))).toEqual([
      {
        name: '',
        items: [
          '必要に応じて、院内部門、対象患者、対象病原微生物等の特性に対応し',
          'た感染経路別予防策（空気予防策、飛沫予防策及び接触予防策）を実施している',
          '易感染患者を防御する環境整備に努めている',
        ],
      },
      {
        name: '手指衛生',
        items: [
          '手洗い及び手指消毒のための設備・備品等を整備している',
          '患者・家族に対しても、必要に応じて、感染予防に関して説明し、手',
          '指消毒を励行する',
          '患者処置の前後には必ず手指衛生を行っている',
          'アルコールに抵抗性のある微生物も存在することから、必要に応じて石',
          'けん及び水道水による手洗いを実施している',
          '手術時手洗いの方法として、以下のいずれかの方法を基本としている',
          '石けん及び水道水による素洗いの後、水分を十分に拭き取ってから、持続殺菌効果のある速乾性擦式消毒薬（アルコール製剤等）により擦式',
        ],
      },
      {
        name: '消毒を行う方法',
        items: [
          '手術時手洗い用の外用消毒薬（クロルヘキシジン・スクラブ製剤、ポビドンヨード・スクラブ製剤等）及び水道水により手洗いを行う方法',
          '上記②の方法においても、最後にアルコール製剤等による擦式消毒を併',
          '用している（推奨）',
        ],
      },
      {
        name: '職業感染防止',
        items: [
          '注射針を使用する際、針刺しによる感染防止のため、使用済み注射針の「リキャップ」を原則として禁止している',
          '注射針専用の廃棄容器等を適切に配置している',
          '必要に応じて針刺しの防止に配慮した安全器材の活用を検討している',
        ],
      },
      {
        name: '環境整備及び環境微生物調査',
        items: [
          '空調設備、給湯設備など、院内感染対策に有用な設備を適切に整備するとともに、院内の清掃等を行い、院内の境管理を適切に行っている',
          '口境整備として、一律に広範囲の境消毒を行っていない',
          '血液又は体液による汚染がある場合は、汚染局所の清拭除去及び消毒を基本としている',
          'ロドアノブ、ベッドなど、頻繁に接触する箇所を定期に清拭し、必要に応じてアルコール消毒等を行っている',
          '多剤耐性菌感染患者が使用した病室等において消毒薬による環境消毒が必要となる場合には、生体に対する毒性等がないように配慮している',
          '消毒薬の噴霧、散布又は薫蒸、紫外線照射等については、効果及び作業',
          '者の安全に関する科学的根拠並びに想定される院内感染のリスクに応じて、慎重に判断している',
        ],
      },
    ]);
  });

  it('reads the staff checklist: numbered headings, spaced or stuck, and check boxes before sentences', () => {
    // Tokyo Metropolitan Government "高齢者福祉施設における感染対策チェックリスト（職員向け）" (public PDF, 1 page).
    // A check box stuck to its text ("ロケアに…", "口複数の…", "口換気扇…") stays for the user to delete.
    expect(simplify(parseChecklistText(fixture('paper-livetext-staff-checklist.txt')))).toEqual([
      { name: '高齢者福祉施設における感染対策チェックリスト（職員向け）', items: [] },
      { name: '体調管理', items: ['健康診断を定期的に受けている。', '体調が悪い場合には、休暇を取ることができる。'] },
      {
        name: '手洗い',
        items: [
          '手洗いは、石鹸と流水で15秒～30秒以上行っている。',
          'ケア前後に手洗いをしている。',
          '手袋をはずした後に手洗いをしている。',
          '手拭きはペーパータオルか個人用のタオルを使用している。',
        ],
      },
      {
        name: '排泄ケア（おむつ交換を含む）',
        items: [
          '排泄ケアの際に手袋を着用し、1回ごとに手袋を交換している。',
          '使用後のおむつ類はビニール袋等に密閉して処理している。',
          '排泄ケアの際には決められた手順を守っている。',
        ],
      },
      {
        name: '個人防護具の適切な使用',
        items: [
          'ロケアに応じて決められた使用物品、使用方法を守っている。',
          '口複数の入所者に対応する際は、入所者ごとに手袋を交換している。',
          '手袋やガウン等は必要なケアの時のみ使用し、使用後は速やかに外している。',
          '手袋やガウン等を外す際は、汚染された表面が自分の手や体に触れないように注意し、外した後に手指衛生を行っている。',
        ],
      },
      {
        name: '環境管理（清掃、施設衛生）',
        items: [
          '施設内で定められた清掃、消毒のやり方、タイミングを守っている。',
          '消毒薬は噴霧せず、ペーパータオル等にしみ込ませて使用している。',
          '感染症の流行状況に合わせて、使用する消毒薬やその濃度を変更している。',
          '排泄物の処理は汚物室等の汚染処理専用の場所で行っている。',
        ],
      },
      {
        name: '換気',
        items: [
          '汚れた室内の空気を排出し外の空気を取り入れる換気が実施できている。',
          'エアコン使用時も効果に換気ができるよう、換気扇などの換気装置のスイッチをオンにしている。',
          '口換気扇などの換気装置の給気口、排気口にほこりが詰まっていないか日常の点検を行っている。',
          '窓開け換気をする場合は、空気の流れを考えながら実施している。',
        ],
      },
      {
        name: '職場の体制',
        items: [
          '感染症に関する研修を年一回以上受講している。',
          '研修受講後に、他の職員にも情報共有できるように報告している。',
          '感染対策に困った際に相談できる相手がいる。',
          '感染対策に困った際に、職場で相談しやすい雰囲気がある。',
        ],
      },
      { name: 'マニュアル', items: ['感染対策マニュアルの置き場所を知っている。', '感染対策マニュアルを活用している。'] },
    ]);
  });
});

describe('classifyLine: check boxes (rule M)', () => {
  it.each(['口', 'ロ', '☐', '☑', '✓', '✔'])('drops "%s" and a space and classifies the rest', (box) => {
    expect(classifyLine(`${box} 易感染患者を防御する環境整備に努めている`)).toEqual({
      kind: 'item',
      text: '易感染患者を防御する環境整備に努めている',
    });
    expect(classifyLine(`${box} 手指衛生`)).toEqual({ kind: 'category', name: '手指衛生' });
  });

  it('keeps "口" or "ロ" stuck to the text: it may start a word ("口腔ケア", "ロッカー")', () => {
    expect(classifyLine('口腔ケアの後に手指衛生を行っている。')).toEqual({ kind: 'item', text: '口腔ケアの後に手指衛生を行っている。' });
    expect(classifyLine('ロッカーを整理している。')).toEqual({ kind: 'item', text: 'ロッカーを整理している。' });
    expect(classifyLine('口腔ケア')).toEqual({ kind: 'category', name: '口腔ケア' });
  });

  it(`keeps a marked line of up to ${CATEGORY_MAX_LENGTH} characters a category, even a sentence`, () => {
    expect(classifyLine(`■ ${plain(CATEGORY_MAX_LENGTH)}`)).toEqual({ kind: 'category', name: plain(CATEGORY_MAX_LENGTH) });
    const sentence = 'あ'.repeat(CATEGORY_MAX_LENGTH - 3) + 'ている';
    expect(classifyLine(`■${sentence}`)).toEqual({ kind: 'category', name: sentence });
  });

  it(`reads "■" before a longer sentence, or a longer line with a comma, as a check box`, () => {
    const sentence = 'あ'.repeat(CATEGORY_MAX_LENGTH - 2) + 'ている';
    expect(classifyLine(`■${sentence}`)).toEqual({ kind: 'item', text: sentence });
    expect(classifyLine(`□ ${sentence}`)).toEqual({ kind: 'item', text: sentence });
    const withComma = `あ、${plain(CATEGORY_MAX_LENGTH - 1)}`;
    expect(classifyLine(`◆${withComma}`)).toEqual({ kind: 'item', text: withComma });
    expect(classifyLine(`◆${withComma.slice(1)}`)).toEqual({ kind: 'category', name: withComma.slice(1) });
  });

  it(`keeps a marked heading up to ${SUBHEADING_MAX_LENGTH} characters, and reads a longer line as an item`, () => {
    expect(classifyLine('# デバイス関連の感染対策（カテーテル・人工呼吸器）')).toEqual({
      kind: 'category',
      name: 'デバイス関連の感染対策（カテーテル・人工呼吸器）',
    });
    expect(classifyLine(`■${plain(SUBHEADING_MAX_LENGTH)}`)).toEqual({ kind: 'category', name: plain(SUBHEADING_MAX_LENGTH) });
    expect(classifyLine(`■${plain(SUBHEADING_MAX_LENGTH + 1)}`)).toEqual({ kind: 'item', text: plain(SUBHEADING_MAX_LENGTH + 1) });
  });

  it('reads the rest behind a check box as an item once marked lines exist', () => {
    expect(classifyLine('口 手指衛生', true)).toEqual({ kind: 'item', text: '手指衛生' });
    expect(classifyLine('■必要に応じて、院内部門、対象患者の特性に対応し', true)).toEqual({
      kind: 'item',
      text: '必要に応じて、院内部門、対象患者の特性に対応し',
    });
  });
});

describe('parseChecklistText: check boxes and marked lines (rule M)', () => {
  it('does not enter the marks-only mode for a "■" check box, so headings are read by their shape', () => {
    expect(simplify(parseChecklistText(lines('1 体調管理', '■ 手袋をはずした後に手洗いをしている。', '2手洗い', 'ケア前後に手洗いをしている。')))).toEqual([
      { name: '体調管理', items: ['手袋をはずした後に手洗いをしている。'] },
      { name: '手洗い', items: ['ケア前後に手洗いをしている。'] },
    ]);
  });

  it('keeps the marks-only mode when a short marked line names a category', () => {
    expect(simplify(parseChecklistText(lines('■手指衛生', '■ 手袋をはずした後に手洗いをしている。', '手洗い')))).toEqual([
      { name: '手指衛生', items: ['手袋をはずした後に手洗いをしている。', '手洗い'] },
    ]);
  });

  it('does not join a check-boxed line to an unfinished item above', () => {
    expect(simplify(parseChecklistText(lines('環境', '病室の入口に手指消毒剤を設置し、その', '口 ている。', 'ロ をしている。')))).toEqual([
      { name: '環境', items: ['病室の入口に手指消毒剤を設置し、その', 'ている。', 'をしている。'] },
    ]);
  });

  it('removes a rating after an item behind a "■" check box', () => {
    expect(simplify(parseChecklistText(lines('環境', '■ 手袋をはずした後に手洗いをしている。 A')))).toEqual([
      { name: '環境', items: ['手袋をはずした後に手洗いをしている。'] },
    ]);
  });
});

describe('stripAnswerColumn (rule N)', () => {
  it.each([
    '口はい 口いいえ',
    '口はいいいえ',
    '口はいロいいえ',
    '口はい一口いいえ',
    '口はい口いいえ',
    '□はい □いいえ',
    'はい いいえ',
  ])('removes "%s" from the end of an item', (column) => {
    expect(stripAnswerColumn(`定期に行っている。 ${column}`)).toBe('定期に行っている。');
    expect(stripAnswerColumn(`定期に行っている。${column}`)).toBe('定期に行っている。');
  });

  it('empties a line left with nothing or only a number', () => {
    expect(stripAnswerColumn('口はいいいえ')).toBe('');
    expect(stripAnswerColumn('7 口はい口いいえ')).toBe('');
    expect(stripAnswerColumn('10 口はいロいいえ')).toBe('');
  });

  it('keeps a line without the column, or with "はい" or "いいえ" alone', () => {
    expect(stripAnswerColumn('定期に行っている。')).toBe('定期に行っている。');
    expect(stripAnswerColumn('ツ 口はいいいえ')).toBe('ツ');
    expect(stripAnswerColumn('返事は必ずはい')).toBe('返事は必ずはい');
    expect(stripAnswerColumn('いいえ')).toBe('いいえ');
  });

  it('drops answer-only lines and joins the item around them', () => {
    expect(simplify(parseChecklistText(lines('透析', 'スタッフには定期健康診断が行われ、希望者にはワクチン接種の', '9 口はいいいえ', '機会がある。', '口はいいいえ')))).toEqual([
      { name: '透析', items: ['スタッフには定期健康診断が行われ、希望者にはワクチン接種の機会がある。'] },
    ]);
  });

  it('does not enter the marks-only mode for an answer column read with its "□"', () => {
    expect(
      simplify(
        parseChecklistText(
          lines('1 体調管理', '□ 職員は健康診断を定期的に受けている。 □はい □いいえ', '□はい □いいえ', '2手洗い', '□ ケアの前後に必ず手洗いをしている。'),
        ),
      ),
    ).toEqual([
      { name: '体調管理', items: ['職員は健康診断を定期的に受けている。'] },
      { name: '手洗い', items: ['ケアの前後に必ず手洗いをしている。'] },
    ]);
  });
});

describe('classifyLine: a heading number stuck to its name (rule O)', () => {
  it.each([
    ['2手洗い', '手洗い'],
    ['3排泄ケア（おむつ交換を含む）', '排泄ケア（おむつ交換を含む）'],
    ['5環境管理（清掃、施設衛生）', '環境管理（清掃、施設衛生）'],
    ['12感染対策委員会', '感染対策委員会'],
  ])('reads "%s" as the category "%s"', (line, name) => {
    expect(classifyLine(line)).toEqual({ kind: 'category', name });
  });

  it.each(['15秒以上かけて乾燥させている', '3階', '2回', '30分', '1日3回', '10名'])('keeps a number with a unit: "%s"', (line) => {
    expect(classifyLine(line)).not.toEqual(expect.objectContaining({ name: line.replace(/^\d+/, '') }));
  });

  it('keeps a number stuck to kana or to a sentence, and a name too long for a subheading (rule X)', () => {
    expect(classifyLine('9パータオル')).toEqual({ kind: 'category', name: '9パータオル' });
    expect(classifyLine('2手洗いをしている')).toEqual({ kind: 'item', text: '2手洗いをしている' });
    const long = `2${plain(SUBHEADING_MAX_LENGTH + 1).replace(/^あ/, '手')}`;
    expect(classifyLine(long)).toEqual({ kind: 'item', text: long });
    const atLimit = `2手${plain(SUBHEADING_MAX_LENGTH - 1)}`;
    expect(classifyLine(atLimit)).toEqual({ kind: 'category', name: atLimit.slice(1) });
  });

  it('reads it as an item once marked lines exist', () => {
    expect(classifyLine('2手洗い', true)).toEqual({ kind: 'item', text: '2手洗い' });
  });

  it('does not join a stuck heading to an unfinished item above', () => {
    expect(simplify(parseChecklistText(lines('1 体調管理', '体調が悪い場合には休暇を取るように', '2手洗い')))).toEqual([
      { name: '体調管理', items: ['体調が悪い場合には休暇を取るように'] },
      { name: '手洗い', items: [] },
    ]);
  });
});

describe('classifyLine: the title of a form (rule P)', () => {
  it.each([
    '透析医療機関における院内感染チェックリスト',
    '高齢者福祉施設における感染対策チェックリスト（職員向け）',
    '感染対策チェックシート',
    '病棟ラウンドチェック表',
    '院内感染防止対策の点検表',
    '院内感染防止対策の点検票',
    '院内感染防止対策自主管理票',
    '院内感染対策に係るチェック項目表',
    '院内感染対策に係る確認事項の一覧表',
    '院内感染対策に係る確認事項の一覧',
  ])('reads "%s" as a category', (line) => {
    expect(classifyLine(line)).toEqual({ kind: 'category', name: line });
  });

  it(`needs ${SUBHEADING_MAX_LENGTH} characters or fewer`, () => {
    const atLimit = 'あ'.repeat(SUBHEADING_MAX_LENGTH - 7) + 'チェックリスト';
    expect(classifyLine(atLimit)).toEqual({ kind: 'category', name: atLimit });
    expect(classifyLine(`あ${atLimit}`)).toEqual({ kind: 'item', text: `あ${atLimit}` });
  });

  it('keeps a long line that only mentions a checklist an item', () => {
    const line = '感染対策チェックリストを用いて定期的に確認している';
    expect(classifyLine(line)).toEqual({ kind: 'item', text: line });
  });

  it('does not join a title to an unfinished item above', () => {
    expect(simplify(parseChecklistText(lines('病室の入口に手指消毒剤を設置し、その', '透析医療機関における院内感染チェックリスト')))).toEqual([
      { name: '', items: ['病室の入口に手指消毒剤を設置し、その'] },
      { name: '透析医療機関における院内感染チェックリスト', items: [] },
    ]);
  });
});

describe('continuesItem: a katakana word cut at the end of a line (rule Q)', () => {
  const LONG = '透析に使用する医療器具は患者毎に';

  it('joins a line starting in katakana to an unfinished item ending in katakana', () => {
    expect(continuesItem(`${LONG}ディスポーザブ`, 'ル製品を使っている。', false)).toBe(true);
    expect(continuesItem(`${LONG}ノンパウダー手袋、非ラ`, 'テックス手袋', false)).toBe(true);
    expect(continuesItem(`${LONG}ペーパ`, 'ータオルを使う', false)).toBe(true);
    expect(continuesItem(`${LONG}ペー`, 'パータオルを使う', false)).toBe(true);
  });

  it.each<[string, string]>([
    [`${LONG}ディスポーザブル。`, 'ル製品を使っている。'],
    [`${LONG}ディスポーザブル`, '製品を使っている。'],
    [`${LONG}医療器具`, 'ル製品を使っている。'],
    ['ディスポーザブ', 'ル製品を使っている。'],
  ])('does not join %s and %s', (item, line) => expect(continuesItem(item, line, false)).toBe(false));
});

describe('continuesItem: a "て" left open (rule R)', () => {
  it('joins the line after an item ending with "て", also before a comma', () => {
    expect(continuesItem('それぞれ1名ずつが共同して', '行っている。', false)).toBe(true);
    expect(continuesItem('ウォッシャー等を用いて', '適切に洗浄消毒をおこなっている', false)).toBe(true);
    expect(continuesItem('リスクに応じて、', '慎重に判断している', false)).toBe(true);
  });

  it('joins the line after "から、"', () => {
    expect(continuesItem('水分を十分に拭き取ってから、', '持続殺菌効果のある消毒薬により擦式', false)).toBe(true);
  });

  it('does not join after an item ending with "について", a heading more often than a wrap', () => {
    expect(continuesItem('中心静脈カテーテルの衛生管理について', '高カロリー輸液は混合時間を含め投与を終了している。', false)).toBe(false);
  });

  it('starts a new item after "て" when both lines are numbered', () => {
    expect(continuesItem('1. 共同して', '2. 行っている。', true)).toBe(false);
  });
});

describe('isWrappedItemTail: a short predicate after a long unfinished item (rule S)', () => {
  const LONG = '十分な診療ができるスタッフが配置';

  it('joins a short predicate starting in hiragana, also after an item ending in hiragana', () => {
    expect(isWrappedItemTail(`${LONG}され`, 'ている')).toBe(true);
    expect(isWrappedItemTail(`${LONG}してい`, 'いる')).toBe(true);
    expect(isWrappedItemTail(`${LONG}し`, 'ている')).toBe(true);
  });

  it('keeps a short item starting with its noun, or after a short item', () => {
    expect(isWrappedItemTail(`${LONG}され`, '確認する')).toBe(false);
    expect(isWrappedItemTail('配置され', 'ている')).toBe(false);
    // "…ますか" ends like a question (rule V), so a tail that does not end like a predicate is used here
    expect(isWrappedItemTail(`${LONG}され`, 'ています')).toBe(false);
  });
});

describe('looksLikeCategory through classifyLine: a sentence before a note in brackets', () => {
  it('reads a short sentence with a note as an item, a name with a note as a category', () => {
    expect(classifyLine('用している（推奨）')).toEqual({ kind: 'item', text: '用している（推奨）' });
    expect(classifyLine('排泄ケア（おむつ交換を含む）')).toEqual({ kind: 'category', name: '排泄ケア（おむつ交換を含む）' });
  });
});
