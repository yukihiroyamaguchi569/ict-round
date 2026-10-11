import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyLine, isNoiseLine, parseChecklistText, stripTrailingRemark } from '../checklistText';
import type { DraftCategory } from '../checklistEditor';

// Rules T to Y for three more real paper checklists: a title starting with "【x】", delimited heading numbers
// before longer headings, items ending in "…した" / "…しているか", a remark column read at the end of an
// item's line, and the fill-in fields and header cells of these forms.

function simplify(categories: DraftCategory[]) {
  return categories.map((cat) => ({ name: cat.name, items: cat.items.map((item) => item.description) }));
}

const lines = (...rows: string[]) => rows.join('\n');

const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8');

const names = (text: string) => parseChecklistText(text).map((c) => c.name);

describe('parseChecklistText on text recognised from photos of three more real paper checklists', () => {
  // Each fixture: a page of a public PDF drawn as a photo of paper, then recognised by macOS Vision
  // (ja-JP, accurate), the engine of iPhone Live Text.

  it('reads the facility self-check list: a "【x】" title, delimited heading numbers, items ending in "…た"', () => {
    // Kumamoto Prefecture "【入所系】高齢者施設等における施設・事業所内感染対策のための自己点検チェックリスト" (public PDF,
    // 1 page). "施設類型" is misread as "施設顃型", so that fill-in line stays.
    expect(simplify(parseChecklistText(fixture('paper-livetext-facility-self-check.txt')))).toEqual([
      { name: '【入所系】高齢者施設等における施設・事業所内感染対策のための自己点検チェックリスト', items: [] },
      { name: '施設顃型 事業所番号', items: [] },
      {
        name: '職員の感染防止に関する意識の徹底',
        items: ['施設外（休日等）においても三密を避けるなどの行動を取っている'],
      },
      {
        name: '感染症対応力向上',
        items: [
          '手指消毒の励行、定期な換気を行っている',
          '職員の日々の健康管理を行っている',
          '入所者の日々の健康管理を行っている',
          '防護具の着脱方法の確認を行った',
          'サービスの提供に当たり日々清掃するなど環境整備を行っている',
          '施設入所者と他のサービス（通所等）利用者の動線が交わらないようにしている',
          '感染防止対策のため入所系職員と訪問・通所系職員との兼務を無くした又は減らした',
          '入所系職員と訪問・通所系職員の休憩室の利用等を時間帯で分離するなど工夫している',
          '職員の休憩時間をずらすなど、食事中のマスクが無い状態での接触を減らす工夫をしている',
        ],
      },
      {
        name: '物資（マスク、ガウン、手袋、消毒液等）の確保',
        items: ['在庫量と使用量・必要量を確認した', '感染者・濃厚接触者への対応等を踏まえた必要量の想定を行っている'],
      },
      {
        name: '関係者（診療・検査医療機関、県・市町村の所管課等）の連絡先の確認',
        items: ['感染対策に係る関係者の連絡先を確認している'],
      },
      {
        name: '感染者発生時のシミュレーション',
        items: [
          '個室管理、生活空間の区分けの検討を行った',
          '勤務体制の変更、人員確保の検討を行った',
          '検体採取場所の検討を行った',
          '最新版の入所者名簿（認知症高齢者の日常生活自立度等を含む）及び配置図がある',
          '最新版の職員名簿及び組織図がある',
          '最新版の出入り業者のリストがある',
        ],
      },
      {
        name: '情報共有',
        items: [
          '感染者発生防止対策及び発生時の対応方針について入所者、家族と共有している',
          '感染者発生時の対応方針について協力医療機関等と共有している',
        ],
      },
      { name: '面会', items: ['面会希望者にオンラインによる面会等を実施している'] },
    ]);
  });

  it('reads the self-management checklist with a remark column: remarks dropped, items ending in "…か。" kept apart', () => {
    // Tokyo Metropolitan Government "院内感染対策のための自主管理チェックリスト" (public PDF), page 17 "手指衛生（2）".
    // The category column is written vertically and is not read. The long remark "15秒以内に乾燥しない量" is read
    // as a line of its own and an end of a line; the first half stays as a category (it starts with a unit).
    expect(simplify(parseChecklistText(fixture('paper-livetext-remarks-column.txt')))).toEqual([
      { name: '', items: ['第二部 標準予防策と感染経路別予防策'] },
      {
        name: '手指衛生（2）一手洗い・手指消毒の方法一',
        items: [
          '手指は病原体が容易に付着するものであり、医療従事者の手指を媒介して感染が広がる',
          '可能性があります。院内感染防止対策における「感染経路の遮断」において、手指衛生は最を真要な手段であり、手洗い・手指消毒の方法等の遵守が院内感染の発生や拡大を未然に防ぐことになります。',
        ],
      },
      {
        name: '＜チェックリスト2-1（2）＞',
        items: [
          '手洗いは、腕時計や指輪を外してから行っているか。',
          '最低15秒間両手を擦り合わせ、正しい手技で手洗いをしているか。',
          '手洗い後は、手指をペーパータオルや温風でよく乾燥させているか。',
          '共用タオルは使用していないか。',
          'ペーパータオルは、上から下に引き抜けるホルダーを使用しているか。',
          '固形石鹸は使用していないか。',
          '液体石鹸の継ぎ足し使用はしていないか。',
          '手洗いの手順・方法に関する職員の研修・演習を行っているか。',
          '手洗いの方法等にかかる職員の遵守状況について確認を行っているか。',
        ],
      },
      {
        name: '15秒以内に乾燥し',
        items: [
          '消毒薬の使用方法をよく読み、適量を確認して使用しているか。',
          '消毒薬が乾燥し終わるまで、両手を擦り合わせているか。',
          '消毒を行った手で髪の毛やエプロン等を触っていないか。',
          '消毒薬は、必要かつ適切な場所に配置されているか。',
          '定期的に消毒薬の使用期限、開封日を確認しているか。',
          '消毒薬の継ぎ足し使用をしていないか。',
          '手指消毒の手順・方法に関する職員の研修・演習を行っているか。',
          '手指消毒の方法等に係る職員の遵守状況について確認をしているか。',
        ],
      },
    ]);
  });

  it('reads the two-text-column sheet without failing: header lines dropped, the two numbered headings are categories', () => {
    // Hyogo Prefecture (Kakogawa Health and Welfare Office) "施設内感染対策のためのチェックリスト（高齢者施設用）"
    // (public PDF), page 2. Each item sits beside an explanation, so recognised lines mix both columns; this
    // shape is not suited to import and only the headings are pinned.
    const categories = simplify(parseChecklistText(fixture('paper-livetext-two-text-columns.txt')));
    const all = categories.flatMap((c) => [c.name, ...c.items]);
    expect(all).not.toContain('対策のポイント 自己評価 他者評価');
    expect(all).not.toContain('確認事項');
    for (const name of ['感染症予防のための環境整備について', '感染拡大防止のための看護・介護ケアについて（個人防護具の使用・管理含む）']) {
      expect(categories.find((c) => c.name === name)?.items.length).toBeGreaterThan(0);
    }
  });
});

describe('a line starting with "【x】" (rule T)', () => {
  it('keeps a "【x】" followed by text as one line and reads it as the title', () => {
    expect(classifyLine('【入所系】高齢者施設等の自己点検チェックリスト')).toEqual({
      kind: 'category',
      name: '【入所系】高齢者施設等の自己点検チェックリスト',
    });
  });

  it('counts the title length without the leading "【x】"', () => {
    const title40 = `${'あ'.repeat(33)}チェックリスト`;
    expect(title40).toHaveLength(40);
    expect(classifyLine(`【長い区分の名前】${title40}`)).toEqual({ kind: 'category', name: `【長い区分の名前】${title40}` });
    expect(classifyLine(`【長い区分の名前】あ${title40}`).kind).toBe('item');
  });

  it('reads a "【x】" followed by a sentence as an item, by its shape', () => {
    expect(classifyLine('【必須】手指消毒剤を病室の入口に設置している')).toEqual({
      kind: 'item',
      text: '【必須】手指消毒剤を病室の入口に設置している',
    });
  });

  it('still makes a line of "【x】" alone a category without the brackets', () => {
    expect(classifyLine('【手指衛生】')).toEqual({ kind: 'category', name: '手指衛生' });
  });

  it('does not enter the marks-only mode for "【x】" lines', () => {
    const text = lines('【手指衛生】', '1）手指衛生に関する職員の意識の徹底', '消毒剤を設置している', '環境整備');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: [] },
      { name: '手指衛生に関する職員の意識の徹底', items: ['消毒剤を設置している'] },
      { name: '環境整備', items: [] },
    ]);
  });

  it('still enters the marks-only mode for "■" lines', () => {
    const text = lines('■手指衛生', '1）手指衛生に関する職員の意識の徹底', '消毒剤を設置している', '環境整備');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '手指衛生', items: ['手指衛生に関する職員の意識の徹底', '消毒剤を設置している', '環境整備'] },
    ]);
  });
});

describe('a delimited heading number before a heading (rule U)', () => {
  it('makes "1）…" a category when the next line is an unnumbered sentence', () => {
    for (const number of ['1）', '(1)', '①', '1.']) {
      const text = lines(`${number}職員の感染防止に関する意識の徹底`, '行動を取っている');
      expect(simplify(parseChecklistText(text))).toEqual([
        { name: '職員の感染防止に関する意識の徹底', items: ['行動を取っている'] },
      ]);
    }
  });

  it('keeps it an item when the next line also has a number', () => {
    const text = lines('1）職員の感染防止に関する意識の徹底', '2）施設外においても行動を取っている');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '', items: ['職員の感染防止に関する意識の徹底', '施設外においても行動を取っている'] },
    ]);
  });

  it('keeps it an item when the next line has a row number', () => {
    const text = lines('1）職員の感染防止に関する意識の徹底', '2 施設外においても行動を取っている');
    expect(names(text)).toEqual(['']);
  });

  it('keeps it an item when the next line does not end like a sentence', () => {
    const text = lines('12. 汚染機器/器具/リネン等の適切な処理と搬送', '細菌汚染を受けやすい消毒薬（第四級アンモニウ');
    expect(names(text)).toEqual(['']);
  });

  it('keeps it an item at the end of the text', () => {
    expect(names('1）職員の感染防止に関する意識の徹底')).toEqual(['']);
  });

  it('keeps it an item when the next line is the wrapped tail of the line', () => {
    const text = lines('1）手指消毒剤を病室の入口に配置してい', 'る．');
    expect(simplify(parseChecklistText(text))).toEqual([{ name: '', items: ['手指消毒剤を病室の入口に配置している．'] }]);
  });

  it('takes a heading of 40 characters, not 41', () => {
    const heading40 = 'あ'.repeat(39) + '徹';
    expect(names(lines(`1）${heading40}`, '行動を取っている'))).toEqual([heading40]);
    expect(names(lines(`1）あ${heading40}`, '行動を取っている'))).toEqual(['']);
  });

  it('keeps a line ending like a sentence an item', () => {
    expect(names(lines('1）職員の感染防止を徹底している', '行動を取っている'))).toEqual(['']);
  });

  it('skips noise lines when looking at the next line', () => {
    expect(names(lines('1）職員の感染防止に関する意識の徹底', 'チェック欄', '行動を取っている'))).toEqual([
      '職員の感染防止に関する意識の徹底',
    ]);
  });

  it('is not applied in the marks-only mode', () => {
    const text = lines('■手指衛生', '1）職員の感染防止に関する意識の徹底', '行動を取っている');
    expect(names(text)).toEqual(['手指衛生']);
  });
});

describe('items ending in "…た" and "…か" (rule V)', () => {
  it('reads a past tense after hiragana as an item', () => {
    for (const item of ['確認した', '在庫量を確認した', '検討を行った', '接触を減らした', '行動を取った']) {
      expect(classifyLine(item)).toEqual({ kind: 'item', text: item });
    }
  });

  it('reads a question after a predicate as an item', () => {
    for (const item of ['換気口を清掃しているか', '使用していないか', '手順書があるか', '確認できるか']) {
      expect(classifyLine(item)).toEqual({ kind: 'item', text: item });
    }
  });

  it('keeps names ending in kanji "た" or "か" categories', () => {
    for (const name of ['手洗いの仕方', '要否か否か', '下肢', '手指消毒の可否']) {
      expect(classifyLine(name)).toEqual({ kind: 'category', name });
    }
  });

  it('keeps an item ending in "か" apart from the next numbered item', () => {
    const text = lines('5 換気口を定期に清掃しているか', '6 固形石鹸を使用していないか');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '', items: ['換気口を定期に清掃しているか', '固形石鹸を使用していないか'] },
    ]);
  });
});

describe('stripTrailingRemark (rule W)', () => {
  it('drops a short remark after a full stop and a space', () => {
    expect(stripTrailingRemark('…ホルダーを使用しているか。 汚染防止')).toBe('…ホルダーを使用しているか。');
    expect(stripTrailingRemark('…配置されているか。 病室、清潔区域')).toBe('…配置されているか。');
    expect(stripTrailingRemark('…使用しているか． ない量')).toBe('…使用しているか．');
  });

  it('drops a remark of 12 characters, not 13', () => {
    expect(stripTrailingRemark(`手洗いをしているか。 ${'備'.repeat(12)}`)).toBe('手洗いをしているか。');
    expect(stripTrailingRemark(`手洗いをしているか。 ${'備'.repeat(13)}`)).toBe(`手洗いをしているか。 ${'備'.repeat(13)}`);
  });

  it('keeps a second sentence', () => {
    expect(stripTrailingRemark('確認しているか。 実施している。')).toBe('確認しているか。 実施している。');
    expect(stripTrailingRemark('確認しているか。 実施している')).toBe('確認しているか。 実施している');
  });

  it('keeps text without a space after the full stop, or without a full stop', () => {
    expect(stripTrailingRemark('使用しているか。汚染防止')).toBe('使用しているか。汚染防止');
    expect(stripTrailingRemark('使用している 汚染防止')).toBe('使用している 汚染防止');
  });

  it('drops the remark before the next numbered item is read', () => {
    const text = lines('5 ホルダーを使用しているか。 汚染防止', '6 固形石鹸は使用していないか。');
    expect(simplify(parseChecklistText(text))).toEqual([
      { name: '', items: ['ホルダーを使用しているか。', '固形石鹸は使用していないか。'] },
    ]);
  });
});

describe('a heading number stuck to a longer heading (rule X)', () => {
  it('makes a name of up to 40 characters after a stuck number a category', () => {
    expect(classifyLine('4感染症予防のための環境整備について')).toEqual({ kind: 'category', name: '感染症予防のための環境整備について' });
    expect(classifyLine('1手指衛生（2）一手洗い・手指消毒の方法一')).toEqual({
      kind: 'category',
      name: '手指衛生（2）一手洗い・手指消毒の方法一',
    });
    expect(classifyLine('5感染拡大防止のための看護・介護ケアについて（個人防護具の使用・管理含む）')).toEqual({
      kind: 'category',
      name: '感染拡大防止のための看護・介護ケアについて（個人防護具の使用・管理含む）',
    });
  });

  it('takes 40 characters, not 41', () => {
    const name40 = '感' + 'あ'.repeat(38) + '理';
    expect(classifyLine(`4${name40}`)).toEqual({ kind: 'category', name: name40 });
    expect(classifyLine(`4${name40}理`).kind).toBe('item');
  });

  it('still leaves a unit after the number and a sentence', () => {
    expect(classifyLine('15秒以内に乾燥しない量を使用している')).toEqual({ kind: 'item', text: '15秒以内に乾燥しない量を使用している' });
    expect(classifyLine('4感染症予防のための環境整備をしている').kind).toBe('item');
  });
});

describe('header and fill-in words of these forms (rule Y)', () => {
  it('drops the fill-in fields and header cells', () => {
    for (const line of [
      '検査日', '担当者名', '電話番号 チェック', '事業所番号', '施設類型', '施設所在市町村名', 'チェック欄',
      '項 目 欄', '自己評価', '対策のポイント 自己評価 他者評価', '確認事項', '項 チェック 備 考',
    ]) {
      expect(isNoiseLine(line)).toBe(true);
    }
  });

  it('matches whole words only', () => {
    for (const line of ['項目の確認', '目の粘膜', '備考欄の記入', 'チェック表の記入']) {
      expect(isNoiseLine(line)).toBe(false);
    }
    expect(isNoiseLine('項目')).toBe(true);
  });
});
