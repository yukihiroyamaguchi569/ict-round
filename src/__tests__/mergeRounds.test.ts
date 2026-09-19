import { describe, it, expect } from 'vitest';
import { itemRowKey, mergeRounds } from '../merge/mergeRounds';
import { READABLE_DEPT_MAX } from '../merge/mergedDocx';
import type { ChecklistCategory, RoundExport } from '../types';

const HYGIENE: ChecklistCategory = {
  category: '手指衛生',
  items: [{ id: 'shushi-1', category: '手指衛生', description: '擦式消毒薬がある' }],
};

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

function conflictWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => w.includes('同じ項目ID'));
}

describe('mergeRounds', () => {
  it('同じチェックリストで記録した報告書は警告なしで1行にまとまる', () => {
    const merged = mergeRounds([makeExport('3階東病棟', [HYGIENE]), makeExport('4階西病棟', [HYGIENE])]);

    expect(merged.warnings).toEqual([]);
    expect(merged.categories[0].items).toHaveLength(1);
    expect(merged.columns.map((c) => c.label)).toEqual(['3階東病棟', '4階西病棟']);
  });

  it('同じ項目IDに違う文言が割り当てられていると警告する', () => {
    const renamed: ChecklistCategory = {
      category: '手指衛生',
      items: [{ id: 'shushi-1', category: '手指衛生', description: '手袋を適切に外している' }],
    };

    const merged = mergeRounds([makeExport('3階東病棟', [HYGIENE]), makeExport('4階西病棟', [renamed])]);

    expect(conflictWarnings(merged.warnings)).toHaveLength(1);
    expect(conflictWarnings(merged.warnings)[0]).toContain('shushi-1');
    expect(conflictWarnings(merged.warnings)[0]).toContain('手袋を適切に外している');
    expect(conflictWarnings(merged.warnings)[0]).toContain('別の行に分けて出力します');
    // 統合自体は止めない
    expect(merged.columns).toHaveLength(2);
  });

  it('同じ項目IDでも文言が違えば別の行にし、各部署の評価を自分の文言の行に載せる', () => {
    const renamed: ChecklistCategory = {
      category: '手指衛生',
      items: [{ id: 'shushi-1', category: '手指衛生', description: '手袋を適切に外している' }],
    };
    const west = makeExport('4階西病棟', [renamed]);
    west.roundData.checklistResults = [{ itemId: 'shushi-1', rating: 'C', photos: [] }];

    const merged = mergeRounds([makeExport('3階東病棟', [HYGIENE]), west]);

    const items = merged.categories[0].items;
    expect(items.map((i) => i.description)).toEqual(['擦式消毒薬がある', '手袋を適切に外している']);

    const keyOf = (description: string) =>
      itemRowKey('手指衛生', items.find((i) => i.description === description)!);
    const [east, westCol] = merged.columns;
    expect(east.ratings.get(keyOf('擦式消毒薬がある'))).toBe('A');
    expect(east.ratings.get(keyOf('手袋を適切に外している'))).toBeUndefined();
    expect(westCol.ratings.get(keyOf('手袋を適切に外している'))).toBe('C');
    expect(westCol.ratings.get(keyOf('擦式消毒薬がある'))).toBeUndefined();
  });

  it('部署が多すぎると表が読みにくくなる旨を警告する', () => {
    const many = Array.from({ length: READABLE_DEPT_MAX }, (_, i) =>
      makeExport(`${i + 1}階病棟`, [HYGIENE])
    );

    expect(mergeRounds(many).warnings).toEqual([]);
    expect(mergeRounds([...many, makeExport('外来', [HYGIENE])]).warnings).toEqual([
      expect.stringContaining(`部署が ${READABLE_DEPT_MAX + 1} 件あります`),
    ]);
  });

  it('同じ項目IDが違うカテゴリに属していると警告する', () => {
    const moved: ChecklistCategory = {
      category: '環境整備',
      items: [{ id: 'shushi-1', category: '環境整備', description: '擦式消毒薬がある' }],
    };

    const merged = mergeRounds([makeExport('3階東病棟', [HYGIENE]), makeExport('4階西病棟', [moved])]);

    expect(conflictWarnings(merged.warnings)).toHaveLength(1);
    expect(conflictWarnings(merged.warnings)[0]).toContain('環境整備');
  });

  it('同じ項目IDの食い違いが3部署にまたがっても警告は1件にまとめる', () => {
    const renamed = (description: string): ChecklistCategory => ({
      category: '手指衛生',
      items: [{ id: 'shushi-1', category: '手指衛生', description }],
    });

    const merged = mergeRounds([
      makeExport('3階東病棟', [HYGIENE]),
      makeExport('4階西病棟', [renamed('手袋を適切に外している')]),
      makeExport('5階南病棟', [renamed('手指消毒のタイミングを守っている')]),
    ]);

    expect(conflictWarnings(merged.warnings)).toHaveLength(1);
  });

  it('項目IDが違えば同じ文言でも警告しない', () => {
    const another: ChecklistCategory = {
      category: '手指衛生',
      items: [{ id: 'shushi-2', category: '手指衛生', description: '擦式消毒薬がある' }],
    };

    const merged = mergeRounds([makeExport('3階東病棟', [HYGIENE]), makeExport('4階西病棟', [another])]);

    expect(conflictWarnings(merged.warnings)).toEqual([]);
  });
});
