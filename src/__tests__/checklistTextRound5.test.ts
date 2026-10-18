import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyLine, continuesItem, continuesNumberedItem, isNoiseLine, parseChecklistText, stripAnswerColumn } from '../checklistText';
import { dropNotes, stripChoiceColumn, stripLawReference } from '../checklistTextLines';
import type { DraftCategory } from '../checklistEditor';

// Rules from a first look at ten more real forms: a column of choices at the end of each line, law references in
// brackets, variants of the "□はい □いいえ" column and notes ("注："), katakana sub-numbers, titles in brackets
// and header words in angle brackets or joined by slashes.

function simplify(categories: DraftCategory[]) {
  return categories.map((cat) => ({ name: cat.name, items: cat.items.map((item) => item.description) }));
}

const lines = (...rows: string[]) => rows.join('\n');

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

describe('parseChecklistText on three more real forms', () => {
  // The fixtures are not the recognised text itself: they were written out from what text recognition read on
  // a page of each public form, keeping the shapes that matter (line breaks, misread marks, columns).

  it('reads the class 1 infectious disease checklist: choices "A・B・C・X" at the end of each line', () => {
    // MHLW research "第一種感染症指定医療機関における一類感染症対策チェックリスト" p2: No. | item | rating
    expect(simplify(parseChecklistText(fixture('form-sample-class1.txt')))).toEqual([
      {
        name: '院内組織体制',
        items: [
          '患者受け入れの判断基準が定められている',
          '24時間体制で対策本部が設置される体制が整備されている',
          '患者受け入れ時の院内の組織体制について定められている',
          '上記組織体制に病院管理者（病院長など）が含まれている',
          '院内の緊急連絡体制が整備されている',
          '院内の連絡担当責任者が指定されている',
          '一類感染症患者の診療期間の診療体制の変更等について事前に方針が定められている',
          '一類感染症患者の診療にあたり感染症科以外の診療科・病棟の協力体制が事前に定められている',
        ],
      },
      {
        name: '外部機関との連絡・連携',
        items: [
          '外部機関との連絡担当者が指定されている',
          '管轄保健所の連絡先を把握している',
          '都道府県の感染症対策担当部局の連絡先を把握している',
        ],
      },
    ]);
  });

  it('reads the clinic inspection sheet: "1ー3" headings, law references under items, "＜備考＞" fields', () => {
    // Tottori Prefecture "診療所・歯科診療所点検表" p2
    expect(simplify(parseChecklistText(fixture('form-sample-clinic.txt')))).toEqual([
      {
        name: '院内感染対策のための体制の確保',
        items: [
          '院内感染対策のための指針は策定されていますか。',
          '院内感染対策のための委員会を開催していますか。',
          '院内感染対策のための職員研修（年2回程度）を実施し、実施記録（日時・参加者・研修内容等）を残していますか。',
          '感染症の発生状況の報告、その他の院内感染対策の推進を目的とした改善のための方策を実施していますか。',
        ],
      },
      {
        name: '医薬品の安全管理体制',
        items: [
          '医薬品安全管理責任者が配置されていますか。',
          '必要に応じて従事者に対する医薬品の安全使用のための研修を実施し、実施記録（日時・参加者・研修内容等）を残していますか。',
          '医薬品安全管理責任者は、従事者の業務が手順書に基づき行われているか定期的に確認し、確認内容を記録していますか。',
        ],
      },
    ]);
  });

  it('reads the dental checklist: lettered items, "口はい［いいえ" columns and "注：" notes', () => {
    // Ishiyaku "歯科医療施設における感染予防チェックリスト" p2: 評価項目 | 評価（□はい □いいえ）| 備考／改善箇所
    expect(simplify(parseChecklistText(fixture('form-sample-dental.txt')))).toEqual([
      { name: '感染予防チェックリスト', items: [] },
      {
        name: '管理法',
        items: [
          '歯科特有の感染予防の方策と手順は文章化され、利用可能で最新な状態であり、根拠に基づいたガイドライン（例：CDC ／医療感染管理諮問委員会［HICPAC］）、規則または規格に従っている',
          '感染予防の方策と手順は、少なくとも毎年または州・連邦の基準に従って再評価され、必要に応じて更新されている',
          '感染予防に精通した者が少なくとも1名、感染予防プログラムを調整するために配置されている',
          'スタンダードプレコーションを遵守するのに必要な物品が、すぐに利用可能である',
        ],
      },
      { name: '感染予防教育とトレーニング', items: [] },
    ]);
  });
});

describe('stripChoiceColumn: a column of choices at the end of a line (rule Z1)', () => {
  it.each([
    ['…整備されている A ・B・C・X', '…整備されている'],
    ['…含まれている A B・ C X', '…含まれている'],
    ['…整備されている A・B・C', '…整備されている'],
    ['…把握している A ・ B・C・X', '…把握している'],
    ['…について事前にA ・B・C・X', '…について事前に'],
    ['…されている Ａ・Ｂ・Ｃ', '…されている'],
  ])('removes the choices from %s', (line, expected) => expect(stripChoiceColumn(line)).toBe(expected));

  it.each(['A・B・C・X', 'A B・C ・ X', 'A・B'])('returns a line of choices alone (%s) empty', (line) =>
    expect(stripChoiceColumn(line)).toBe(''),
  );

  it.each(['…している A', 'a・b', '…している a・b', '…ICT・AST', '…PPE', 'CDC ／医療感染管理諮問委員会'])('keeps %s', (line) =>
    expect(stripChoiceColumn(line)).toBe(line),
  );

  it('drops a line of choices and reads the rest of a line as before', () => {
    expect(simplify(parseChecklistText(lines('院内組織体制', 'A・B・C・X', '体制が整備されている A ・B・C・X')))).toEqual([
      { name: '院内組織体制', items: ['体制が整備されている'] },
    ]);
  });

  it('joins a line left open after its choices to the next line', () => {
    expect(simplify(parseChecklistText(lines('診療体制', '7 一類感染症患者の診療体制の変更等について事前にA ・B・C・X', '方針が定められている')))).toEqual([
      { name: '診療体制', items: ['一類感染症患者の診療体制の変更等について事前に方針が定められている'] },
    ]);
  });
});

describe('stripLawReference: law references in brackets (rule Z2)', () => {
  it.each([
    '（規則第1条の11第2項第1号イ）',
    '（規則第1条の11第2項第1号）※義務付けられているのは有床診療所のみ',
    '（H19.3.30医政発0330010）',
    '（平成19年厚生労働省告示）',
    '（令和5年通知）',
    '(医療法第6条)',
  ])('returns the line %s empty', (line) => expect(stripLawReference(line)).toBe(''));

  it('cuts a law reference off the end of an item', () => {
    expect(stripLawReference('方策を実施していますか。（規則第1条の11第2項第1号ニ）')).toBe('方策を実施していますか。');
  });

  it.each(['（規則第1条の11第2項第1号イ）', '（H19.3.30医政発0330010）', '（平成19年3月30日医政発第0330010号）', '（第3号）', '（R5.4.1通知）'])(
    'returns a citation %s empty',
    (line) => expect(stripLawReference(line)).toBe(''),
  );

  it.each(['（院内規則に基づき確認する）', '（感染対策委員会の規則による）', '（委員会からの通知を確認する）'])(
    'keeps a bracket with "規則" or "通知" that cites nothing: %s',
    (line) => expect(stripLawReference(line)).toBe(line),
  );

  it('keeps a trailing bracket with "規則" that cites nothing', () => {
    expect(stripLawReference('手順を守っている（院内規則に基づき確認する）')).toBe('手順を守っている（院内規則に基づき確認する）');
  });

  it.each(['（ケアの前後、食事の配膳前など）', '手指消毒を行う（ケアの前後）', '（第三者評価）'])('keeps a bracket without law words: %s', (line) =>
    expect(stripLawReference(line)).toBe(line),
  );

  it('keeps a bracketed note without law words as a line of the checklist, as before', () => {
    expect(simplify(parseChecklistText(lines('手指衛生', '手指消毒を行っている', '（ケアの前後、食事の配膳前など）')))).toEqual([
      { name: '手指衛生', items: ['手指消毒を行っている', '（ケアの前後、食事の配膳前など）'] },
    ]);
  });

  it('drops a law line with a note after it, and keeps the items around it apart', () => {
    expect(
      simplify(parseChecklistText(lines('体制', '①委員会を開催していますか。', '（規則第1条の11第2項第1号）※有床診療所のみ', '②指針は策定されていますか。'))),
    ).toEqual([{ name: '体制', items: ['委員会を開催していますか。', '指針は策定されていますか。'] }]);
  });
});

describe('the "□はい □いいえ" column read with brackets, and notes (rule Z3)', () => {
  it.each(['…利用可能 口はい［いいえ', '…利用可能 口はい ［いいえ', '…利用可能 口はい 口いいえ', '…利用可能 口はい[いいえ', '…利用可能 口はい「いいえ'])(
    'removes the answer column from %s',
    (line) => expect(stripAnswerColumn(line)).toBe('…利用可能'),
  );

  it('drops a note that ends like a sentence, and only that line', () => {
    expect(dropNotes(['項目Aを確認している', '注：前年分のレビューをもとに行われることが多い。', '項目Bを確認している'])).toEqual([
      '項目Aを確認している',
      '項目Bを確認している',
    ]);
  });

  it('drops a wrapped note up to the line that ends like a sentence', () => {
    expect(dropNotes(['注：実装と手順は、病原体に関', 'する感染予防トレーニングまで', '含まれている。', '次の項目を確認している'])).toEqual([
      '次の項目を確認している',
    ]);
  });

  it.each(['注:手順は文書にする。', '注）手順は文書にする。'])('drops a note starting %s', (line) => expect(dropNotes([line])).toEqual([]));

  it.each(['注射器は単回使用している', '注意事項を表示している'])('keeps a line starting with the word %s', (line) =>
    expect(dropNotes([line])).toEqual([line]),
  );
});

describe('katakana sub-numbers (rule Z4)', () => {
  it.each([
    ['ア. 手指消毒を実施している', '手指消毒を実施している'],
    ['イ．手指消毒を実施している', '手指消毒を実施している'],
    ['ウ、手指消毒を実施している', '手指消毒を実施している'],
    ['エ，手指消毒を実施している', '手指消毒を実施している'],
    ['コ.手指消毒を実施している', '手指消毒を実施している'],
    ['(1)ア.手指消毒を実施している', '手指消毒を実施している'],
    ['1 ア．手指消毒を実施している', '手指消毒を実施している'],
  ])('drops the sub-number of %s', (line, text) => expect(classifyLine(line)).toEqual({ kind: 'item', text }));

  it('drops a sub-number before a bracket', () => {
    expect(classifyLine('ア（手指衛生）を実施している')).toEqual({ kind: 'item', text: '（手指衛生）を実施している' });
  });

  it.each(['アルコール手指消毒剤を設置している', 'ウルトルト食品を保管している', 'サ.手指消毒を実施している'])('keeps %s', (line) =>
    expect(classifyLine(line)).toEqual({ kind: 'item', text: line }),
  );
});

describe('titles in brackets (rule Z5)', () => {
  it.each([
    ['«障害者支援施設・グループホーム チェックリスト»', '障害者支援施設・グループホーム チェックリスト'],
    ['≪感染対策チェックリスト≫', '感染対策チェックリスト'],
    ['「感染対策チェックリスト」', '感染対策チェックリスト'],
    ['『感染対策点検表』', '感染対策点検表'],
  ])('reads %s as the title', (line, name) => expect(classifyLine(line)).toEqual({ kind: 'category', name }));

  it('keeps the brackets of a name that is not a title', () => {
    expect(classifyLine('「手洗い」')).toEqual({ kind: 'category', name: '「手洗い」' });
  });

  it('keeps "【手指衛生】" as a marked category', () => {
    expect(simplify(parseChecklistText(lines('【手指衛生】', '手洗いをしている')))).toEqual([{ name: '手指衛生', items: ['手洗いをしている'] }]);
  });
});

describe('header words in angle brackets or joined by slashes (rule Z6)', () => {
  it.each(['＜備考＞', '<備考>', '〈備考〉', '備考／改善箇所', '備考/改善箇所', '評価項目 評価 備考／改善箇所', '改善箇所', '項目'])(
    'drops %s',
    (line) => expect(isNoiseLine(line)).toBe(true),
  );

  it.each(['＜手洗い＞', '汚物室／トイレ', '手洗い／うがい'])('keeps %s', (line) => expect(isNoiseLine(line)).toBe(false));
});

describe('joining rules the three forms needed', () => {
  it('reads a letter and a space before a heading as a section ("C 院内組織体制")', () => {
    expect(classifyLine('C 院内組織体制')).toEqual({ kind: 'category', name: '院内組織体制' });
  });

  it('keeps a lettered heading a category when the next line starts an item of its own', () => {
    expect(simplify(parseChecklistText(lines('A. 病棟', '手洗いをしている')))).toEqual([{ name: '病棟', items: ['手洗いをしている'] }]);
  });

  it('reads a lettered heading as an item when the next line goes on from it', () => {
    expect(simplify(parseChecklistText(lines('管理法', 'D. 遵守するのに必要な物品', 'が、すぐに利用可能である')))).toEqual([
      { name: '管理法', items: ['遵守するのに必要な物品が、すぐに利用可能である'] },
    ]);
  });

  it('joins a "・" line that closes a bracket left open, not as a dotted subheading', () => {
    expect(simplify(parseChecklistText(lines('研修', '③職員研修を実施し、実施記録（日時', '・参加者・研修内容等）を残していますか。')))).toEqual([
      { name: '研修', items: ['職員研修を実施し、実施記録（日時・参加者・研修内容等）を残していますか。'] },
    ]);
  });

  it('joins the "か" of a question cut off its predicate', () => {
    expect(continuesItem('業務が手順書に基づき行われている', 'か定期的に確認し、記録していますか。', false)).toBe(true);
    expect(continuesItem('業務が手順書に基づき行われている', 'かご は消毒している', false)).toBe(false);
    expect(continuesItem('手順書の整備', 'か定期的に確認していますか。', false)).toBe(false);
  });

  describe('continuesNumberedItem', () => {
    const item = '④感染症の発生状況の報告、その他の推進を目的とした改';

    it('joins a sentence to a numbered item with a comma that stopped mid-word', () => {
      expect(continuesNumberedItem(item, '善のための方策を実施していますか。')).toBe(true);
    });

    it('joins a sentence to a numbered item that stopped after "…し、"', () => {
      expect(continuesNumberedItem('②従事者に対する安全使用のための研修を実施し、', '実施記録を残していますか。')).toBe(true);
    });

    it.each([
      ['a heading without a comma', '1）職員の感染防止に関する意識の徹底', '感染防止の行動を取っている'],
      ['a comma only in brackets', '物資（マスク、ガウン、手袋、消毒液等）の確保', '在庫量を確認した'],
      ['an item holding a full stop', '①床は湿式清掃を行う。手指が高頻度に接触するドアノブ、ベッド', '柵等は清拭する'],
      ['an item ending like a sentence', '④感染症の発生状況の報告、その他の推進を行っている', '確認している'],
      ['a short item', '報告、改', '善を実施している'],
      ['a line that is not a sentence', item, '善のための方策'],
      ['a line starting with a number', item, '1 方策を実施している'],
    ])('keeps apart %s', (_, before, line) => expect(continuesNumberedItem(before, line)).toBe(false));

    it('keeps the next numbered item apart', () => {
      expect(simplify(parseChecklistText(lines('体制', '①発生状況の報告、その他の推進を目的とした改', '②方策を実施していますか。')))).toEqual([
        { name: '体制', items: ['発生状況の報告、その他の推進を目的とした改', '方策を実施していますか。'] },
      ]);
    });
  });
});
