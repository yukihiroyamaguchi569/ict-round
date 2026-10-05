import { describe, it, expect } from 'vitest';
import { mergeRounds } from '../merge/mergeRounds';
import type { ChecklistCategory, RoundExport } from '../types';

const HYGIENE_2: ChecklistCategory = {
  category: '手指衛生',
  items: [
    { id: 'shushi-1', category: '手指衛生', description: '擦式消毒薬がある' },
    { id: 'shushi-2', category: '手指衛生', description: '手袋を適切に外している' },
  ],
};
const HYGIENE: ChecklistCategory = { category: '手指衛生', items: [HYGIENE_2.items[0]] };

/** 全項目を A で評価した1部署分のエクスポート */
function makeExport(wardName: string, categories: ChecklistCategory[]): RoundExport {
  return {
    format: 'meguru-round',
    version: 1,
    exportedAt: '2026-09-19T00:00:00.000Z',
    checklistName: '標準チェックリスト',
    categories,
    roundData: {
      inspectorName: '山口',
      wardName,
      startTime: '2026-09-19 10:00',
      checklistResults: categories.flatMap((cat) =>
        cat.items.map((item) => ({ itemId: item.id, rating: 'A' as const, photos: [] }))
      ),
      generalPhotos: [],
      overallEvaluation: '',
    },
  };
}

/** 担当者名と項目ごとの評価を指定した1件分のエクスポート（指定のない項目は未評価） */
function makeShared(wardName: string, inspectorName: string, ratings: Record<string, 'A' | 'B' | 'C'>): RoundExport {
  const roundExport = makeExport(wardName, [HYGIENE_2]);
  roundExport.roundData.inspectorName = inspectorName;
  roundExport.roundData.checklistResults = HYGIENE_2.items.map((item) => ({
    itemId: item.id,
    rating: ratings[item.id] ?? null,
    photos: [],
  }));
  return roundExport;
}

const splitWarnings = (warnings: string[]) => warnings.filter((w) => w.includes('担当者間で評価が分かれました'));
const duplicateIdWarnings = (warnings: string[]) => warnings.filter((w) => w.includes('複数のチェック項目に使われています'));
const unknownIdWarnings = (warnings: string[]) => warnings.filter((w) => w.includes('チェックリストに無い項目ID'));

describe('mergeRounds（警告の文言）', () => {
  it('評価が分かれた警告は担当者を「 / 」、項目を「、」で区切り、担当者名が空なら「担当者名なし」と書く', () => {
    const merged = mergeRounds([
      makeShared('1病棟', ' 山田 ', { 'shushi-1': 'A', 'shushi-2': 'A' }),
      makeShared('1病棟', ' ', { 'shushi-1': 'B', 'shushi-2': 'C' }),
    ]);

    expect(splitWarnings(merged.warnings)).toEqual([
      '「1病棟」は担当者間で評価が分かれました: 「擦式消毒薬がある」（山田: A / 担当者名なし: B）、「手袋を適切に外している」（山田: A / 担当者名なし: C）。厳しい方の評価（C＞B＞A）を採用しています。',
    ]);
  });

  it('不整合の警告は該当する項目IDを「、」で区切ってすべて挙げる', () => {
    const stale = makeExport('3階東病棟', [HYGIENE_2]);
    stale.roundData.checklistResults.push(
      { itemId: 'kankyo-8', rating: 'B', photos: [] },
      { itemId: 'kankyo-9', rating: 'C', photos: [] }
    );
    const duplicated: ChecklistCategory = {
      category: '手指衛生',
      items: [...HYGIENE_2.items, ...HYGIENE_2.items.map((item) => ({ ...item, description: `${item.description}（再掲）` }))],
    };

    const merged = mergeRounds([stale, makeExport('4階西病棟', [duplicated])]);

    expect(unknownIdWarnings(merged.warnings)[0]).toContain('（kankyo-8、kankyo-9）');
    expect(duplicateIdWarnings(merged.warnings)[0]).toContain('（shushi-1、shushi-2）');
  });

  it('警告で報告書を示すときは、病棟名と担当者名のうち分かる方を前後の空白を落として使う', () => {
    const withResult = (wardName: string, inspectorName: string): RoundExport => {
      const roundExport = makeExport(wardName, [HYGIENE]);
      roundExport.roundData.inspectorName = inspectorName;
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
    const roundExport = makeExport('3階東病棟', [HYGIENE]);
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
