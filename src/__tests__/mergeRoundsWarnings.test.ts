import { describe, it, expect } from 'vitest';
import { mergeRounds } from '../merge/mergeRounds';
import type { ChecklistCategory, RoundExport } from '../types';
import { ROUND_CATEGORIES, makeRoundExport } from './fixtures/roundDocx';

const [HYGIENE] = ROUND_CATEGORIES;

const splitWarnings = (warnings: string[]) => warnings.filter((w) => w.includes('担当者間で評価が分かれました'));
const duplicateIdWarnings = (warnings: string[]) => warnings.filter((w) => w.includes('複数のチェック項目に使われています'));
const unknownIdWarnings = (warnings: string[]) => warnings.filter((w) => w.includes('チェックリストに無い項目ID'));

describe('mergeRounds（警告の文言）', () => {
  it('評価が分かれた警告は担当者を「 / 」、項目を「、」で区切り、担当者名が空なら「担当者名なし」と書く', () => {
    const merged = mergeRounds([
      makeRoundExport({ wardName: '1病棟', inspectorName: ' 山田 ', ratings: { h1: 'A', h2: 'A' } }),
      makeRoundExport({ wardName: '1病棟', inspectorName: ' ', ratings: { h1: 'B', h2: 'C' } }),
    ]);

    expect(splitWarnings(merged.warnings)).toEqual([
      '「1病棟」は担当者間で評価が分かれました: 「手指消毒剤が配置されている」（山田: A / 担当者名なし: B）、「5つのタイミングが掲示されている」（山田: A / 担当者名なし: C）。厳しい方の評価（C＞B＞A）を採用しています。',
    ]);
  });

  it('不整合の警告は該当する項目IDを「、」で区切ってすべて挙げる', () => {
    const stale = makeRoundExport({ wardName: '3階東病棟' });
    stale.roundData.checklistResults.push(
      { itemId: 'kankyo-8', rating: 'B', photos: [] },
      { itemId: 'kankyo-9', rating: 'C', photos: [] }
    );
    const duplicated: ChecklistCategory = {
      category: '手指衛生',
      items: [...HYGIENE.items, ...HYGIENE.items.map((item) => ({ ...item, description: `${item.description}（再掲）` }))],
    };

    const merged = mergeRounds([stale, makeRoundExport({ wardName: '4階西病棟', categories: [duplicated] })]);

    expect(unknownIdWarnings(merged.warnings)[0]).toContain('（kankyo-8、kankyo-9）');
    expect(duplicateIdWarnings(merged.warnings)[0]).toContain('（h1、h2）');
  });

  it('警告で報告書を示すときは、病棟名と担当者名のうち分かる方を前後の空白を落として使う', () => {
    const withResult = (wardName: string, inspectorName: string): RoundExport => {
      const roundExport = makeRoundExport({ wardName, inspectorName });
      roundExport.roundData.checklistResults.push({ itemId: 'kankyo-9', rating: 'C', photos: [] });
      return roundExport;
    };

    const warnings = unknownIdWarnings(
      mergeRounds([
        withResult(' 3階東病棟 ', ' 山田 '),
        withResult('4階西病棟', ''),
        withResult('', '田中'),
        withResult(' ', ' '),
      ]).warnings
    );

    expect(warnings.map((w) => w.slice(0, w.indexOf('の報告書')))).toEqual([
      '「3階東病棟」（担当: 山田）',
      '「4階西病棟」',
      '「田中」',
      '「名称未設定」',
    ]);
  });
});

describe('mergeRounds（チェックリスト名）', () => {
  const named = (checklistName: string) => {
    const roundExport = makeRoundExport({ wardName: '3階東病棟' });
    roundExport.checklistName = checklistName;
    return roundExport;
  };

  it('チェックリスト名が報告書ごとに違えば、どれとどれかを警告する', () => {
    const merged = mergeRounds([named('標準チェックリスト'), named('ICU用'), named('標準チェックリスト')]);

    expect(merged.warnings).toContain('チェックリスト名が混在しています: 標準チェックリスト / ICU用');
  });

  it('チェックリスト名が空の報告書は混在の判定に含めない', () => {
    const merged = mergeRounds([named('標準チェックリスト'), named('')]);

    expect(merged.warnings.filter((w) => w.includes('チェックリスト名'))).toEqual([]);
  });
});
