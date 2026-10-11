import { describe, it, expect } from 'vitest';
import { bracketDepth, classifyLine, continuesItem, isNoiseLine, parseChecklistText } from '../checklistText';
import type { DraftCategory } from '../checklistEditor';

// Rules for text recognised from photos of real paper checklists: heading numbers and letters, bullets,
// rows split only when their brackets allow, and lines that go on from the item above.

function simplify(categories: DraftCategory[]) {
  return categories.map((cat) => ({ name: cat.name, items: cat.items.map((item) => item.description) }));
}

const lines = (...rows: string[]) => rows.join('\n');

describe('bracketDepth', () => {
  it('counts opening minus closing brackets, half and full width', () => {
    expect(bracketDepth('手袋（マスク')).toBe(1);
    expect(bracketDepth('手袋(マスク（')).toBe(2);
    expect(bracketDepth('（手袋）と(マスク)')).toBe(0);
    expect(bracketDepth('など）')).toBe(-1);
    expect(bracketDepth('手袋')).toBe(0);
  });
});

describe('continuesItem', () => {
  const COMPLETE = '鋭利器材の廃棄容器が適切に管理されている';

  it('joins any line to an item left unfinished by an open bracket or a particle at the end', () => {
    expect(continuesItem('感染対策上の適切な病棟内患者配置（個別アイソ', 'レーション、集団アイソレーション', false)).toBe(true);
    expect(continuesItem('減菌機材が適切に保管され、使用期限のチェックが', '行われている', false)).toBe(true);
    expect(continuesItem('アルコール製剤ディスペンサーの', '適正設置', false)).toBe(true);
    for (const particle of 'のがをにとはでもへや') {
      expect(continuesItem(`容器${particle}`, '適正設置', false)).toBe(true);
    }
  });

  it('does not join a numbered line to an unfinished numbered item (a closing bracket dropped by Live Text)', () => {
    const item = '利器材の廃棄容器が安全に管理されている （廃棄容器の蓋が開いていない、など';
    expect(continuesItem(item, '鋭利器材の廃棄容器が処置を行う場所の近くに設置してある', true)).toBe(false);
    expect(continuesItem(item, '鋭利器材の廃棄容器が処置を行う場所の近くに設置してある', false)).toBe(true);
    // A line that starts like a continuation is still joined in a numbered list
    expect(continuesItem(item, 'ーション', true)).toBe(true);
  });

  it.each(['の適正手技', 'が行われている', 'ーション、技術アイソレーション）', 'ゃ', 'ッ', '）の適切な着用', ')の着用', '、および', '，および', ',および'])(
    'joins %s, which cannot start an item',
    (line) => expect(continuesItem(COMPLETE, line, true)).toBe(true),
  );

  it('joins a line that closes a bracket it did not open', () => {
    expect(continuesItem(COMPLETE, '故障の有無、ノズルのつまり、など）', false)).toBe(true);
    expect(continuesItem(COMPLETE, '故障の有無（ノズル）', false)).toBe(false);
  });

  it.each([
    ['a complete item and a new item', COMPLETE, '検査検体が適切に保管してある'],
    ['a category name after a complete item', COMPLETE, '処置室'],
    ['a line opening a bracket after a complete one', '患者清拭用タオルの熱水洗浄と保温時清潔管理（芽胞）', '（使用量チェックが必要）/管理'],
    ['an item ending with a kana that is not a particle', '感染症が病院感染か否かの特定、および、病院感', '染の場合その感染経路の特定と対応'],
  ])('keeps %s apart', (_, item, line) => expect(continuesItem(item, line, false)).toBe(false));

  it('joins a short wrapped tail', () => {
    expect(continuesItem('空調のメンテナンスが行われ、HEPA filterが定期的に交換', 'されている', true)).toBe(true);
  });
});

describe('classifyLine: heading numbers, bullets and marks', () => {
  it('drops the heading number and then reads the line by its shape', () => {
    expect(classifyLine('2）咳エチケットが確実に実施されている')).toEqual({ kind: 'item', text: '咳エチケットが確実に実施されている' });
    expect(classifyLine('2.スタッフステーション')).toEqual({ kind: 'category', name: 'スタッフステーション' });
    expect(classifyLine('17.')).toEqual({ kind: 'category', name: '' });
  });

  it.each(['A.', 'D．', 'Ｂ．', 'B. '])('drops the lettered heading %s', (head) =>
    expect(classifyLine(`${head}病棟`)).toEqual({ kind: 'category', name: '病棟' }),
  );

  it('keeps a lowercase or unmarked letter as part of the text', () => {
    expect(classifyLine('a. 病棟')).toEqual({ kind: 'category', name: 'a. 病棟' });
    expect(classifyLine('AB. 病棟')).toEqual({ kind: 'category', name: 'AB. 病棟' });
    expect(classifyLine('PPE')).toEqual({ kind: 'category', name: 'PPE' });
  });

  it('splits a numbered category and its numbered item, dropping both numbers', () => {
    expect(classifyLine('4.抗がん化学療法外来 1）薬剤の無菌調製が適切に実施されている')).toEqual({
      kind: 'row', category: '抗がん化学療法外来', text: '薬剤の無菌調製が適切に実施されている', numbered: true,
    });
    expect(classifyLine('スタッフステーション 1） 水道のシンク外周が擦拭され乾燥している')).toEqual({
      kind: 'row', category: 'スタッフステーション', text: '水道のシンク外周が擦拭され乾燥している', numbered: true,
    });
  });

  it('reads a line after a bullet by its shape', () => {
    expect(classifyLine('・ 病室 1）部屋ごとに手洗い場がある')).toEqual({ kind: 'row', category: '病室', text: '部屋ごとに手洗い場がある', numbered: true });
    expect(classifyLine('・ 手洗い場が整備されている')).toEqual({ kind: 'item', text: '手洗い場が整備されている' });
    expect(classifyLine('・ 病室')).toEqual({ kind: 'category', name: '病室' });
    // Without a space the dot is part of the text
    expect(classifyLine('・病室')).toEqual({ kind: 'category', name: '・病室' });
  });

  it('splits a marked line into a row when it has that shape, and otherwise keeps it a category', () => {
    expect(classifyLine('■ 病室 1）部屋ごとに手洗い場がある')).toEqual({ kind: 'row', category: '病室', text: '部屋ごとに手洗い場がある', numbered: true });
    expect(classifyLine('■ 手指衛生')).toEqual({ kind: 'category', name: '手指衛生' });
    expect(classifyLine('■ 1. 手指衛生')).toEqual({ kind: 'category', name: '手指衛生' });
    expect(classifyLine('■ 手指衛生の徹底と手荒れ対策を含む長いカテゴリ')).toEqual({ kind: 'category', name: '手指衛生の徹底と手荒れ対策を含む長いカテゴリ' });
  });

  it('does not split a line that leaves a bracket open unless the item starts with a number', () => {
    const open = '個人用防護具 Personal Protective Equipment （手';
    expect(classifyLine(open)).toEqual({ kind: 'item', text: open });
    expect(classifyLine('防護具 手袋が着用されている（手袋の交換を含')).toEqual({ kind: 'item', text: '防護具 手袋が着用されている（手袋の交換を含' });
    expect(classifyLine('防護具 手袋の交換を含む）の手袋が着用されている')).toEqual({ kind: 'item', text: '防護具 手袋の交換を含む）の手袋が着用されている' });
    expect(classifyLine('防護具 手袋が着用されている（手袋の交換を含む）')).toEqual({
      kind: 'row', category: '防護具', text: '手袋が着用されている（手袋の交換を含む）', numbered: false,
    });
    expect(classifyLine('外来処置室 1）利器材が管理されている （蓋が開いていない、など')).toEqual({
      kind: 'row', category: '外来処置室', text: '利器材が管理されている （蓋が開いていない、など', numbered: true,
    });
  });
});

describe('parseChecklistText: numbered lists, bullets and wrapped lines', () => {
  it('reads every line once marked lines exist, but does not count a bullet as a mark', () => {
    expect(simplify(parseChecklistText(lines('・ 病室 1）手洗い場がある', '環境', '清掃されている．')))).toEqual([
      { name: '病室', items: ['手洗い場がある'] },
      { name: '環境', items: ['清掃されている．'] },
    ]);
  });

  it('starts a new item for each number in a numbered list, even after an unclosed bracket', () => {
    expect(simplify(parseChecklistText(lines('外来処置室 1）容器が管理されている （蓋が開いていない、など', '2）容器が近くに設置してある')))).toEqual([
      { name: '外来処置室', items: ['容器が管理されている （蓋が開いていない、など', '容器が近くに設置してある'] },
    ]);
  });

  it('joins a numbered line, without its number, to an unfinished unnumbered item', () => {
    expect(simplify(parseChecklistText(lines('■ 手指衛生', '細菌汚染を受けやすい消毒薬（第四級アンモニウ', '13. ム塩、ポビドンヨード', 'など）の適正な取り扱い')))).toEqual([
      { name: '手指衛生', items: ['細菌汚染を受けやすい消毒薬（第四級アンモニウム塩、ポビドンヨードなど）の適正な取り扱い'] },
    ]);
  });

  it('joins a short line read as a category to an unfinished item, across a bare number', () => {
    expect(simplify(parseChecklistText(lines('整備', '高水準消毒薬（グルタラール、フタラー', '17.', 'ル）暴露対策')))).toEqual([
      { name: '整備', items: ['高水準消毒薬（グルタラール、フタラール）暴露対策'] },
    ]);
  });

  it('does not join a marked, bulleted or row line to an unfinished item', () => {
    const unfinished = '廃棄容器の蓋が開いていないことを確認（など';
    expect(simplify(parseChecklistText(lines('環境', unfinished, '・ の確認', '病室 1）手洗い場がある')))).toEqual([
      { name: '環境', items: [unfinished] },
      { name: 'の確認', items: [] },
      { name: '病室', items: ['手洗い場がある'] },
    ]);
    expect(simplify(parseChecklistText(lines('■ 環境', unfinished, '■ の確認')))).toEqual([
      { name: '環境', items: [unfinished] },
      { name: 'の確認', items: [] },
    ]);
  });
});

describe('isNoiseLine: page numbers in full-width brackets', () => {
  it.each(['（24）', '（3）'])('drops %s', (line) => expect(isNoiseLine(line)).toBe(true));
  it.each(['（24）環境', '（ 24 ）', '（二）'])('keeps %s', (line) => expect(isNoiseLine(line)).toBe(false));
});
