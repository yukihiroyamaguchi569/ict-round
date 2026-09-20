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

/** 1つの病棟を2人で分担するため、項目が2つあるカテゴリを使う */
const HYGIENE_2: ChecklistCategory = {
  category: '手指衛生',
  items: [
    { id: 'shushi-1', category: '手指衛生', description: '擦式消毒薬がある' },
    { id: 'shushi-2', category: '手指衛生', description: '手袋を適切に外している' },
  ],
};

/** 担当者名と項目ごとの評価を指定した1件分のエクスポート（指定のない項目は未評価） */
function makeShared(
  wardName: string,
  inspectorName: string,
  ratings: Record<string, 'A' | 'B' | 'C'>,
  categories = [HYGIENE_2]
): RoundExport {
  const roundExport = makeExport(wardName, categories);
  roundExport.roundData.inspectorName = inspectorName;
  roundExport.roundData.checklistResults = categories.flatMap((cat) =>
    cat.items.map((item) => ({ itemId: item.id, rating: ratings[item.id] ?? null, photos: [] }))
  );
  return roundExport;
}

const keyOf = (description: string) =>
  itemRowKey('手指衛生', HYGIENE_2.items.find((i) => i.description === description)!);

function splitWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => w.includes('担当者間で評価が分かれました'));
}

describe('mergeRounds（同じ病棟のまとめ方）', () => {
  it('病棟名が同じ報告書は担当者名を付けずに1列にまとまる', () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'A' }),
      makeShared('1病棟', '田中', { 'shushi-2': 'B' }),
    ]);

    expect(merged.columns).toHaveLength(1);
    expect(merged.columns[0].label).toBe('1病棟');
    expect(merged.columns[0].sources.map((s) => s.inspectorName)).toEqual(['山田', '田中']);
    expect(merged.warnings).toEqual([]);
  });

  it('チェック項目を分担した場合は未評価を相手の評価で補完する', () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'A' }),
      makeShared('1病棟', '田中', { 'shushi-2': 'B' }),
    ]);

    const [column] = merged.columns;
    expect(column.ratings.get(keyOf('擦式消毒薬がある'))).toBe('A');
    expect(column.ratings.get(keyOf('手袋を適切に外している'))).toBe('B');
  });

  it('担当者間で評価が食い違う項目は厳しい方を採用し、誰がどう付けたかを警告する', () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'A', 'shushi-2': 'B' }),
      makeShared('1病棟', '田中', { 'shushi-1': 'C', 'shushi-2': 'B' }),
    ]);

    const [column] = merged.columns;
    expect(column.ratings.get(keyOf('擦式消毒薬がある'))).toBe('C');
    expect(column.ratings.get(keyOf('手袋を適切に外している'))).toBe('B');

    expect(splitWarnings(merged.warnings)).toHaveLength(1);
    const [warning] = splitWarnings(merged.warnings);
    expect(warning).toContain('1病棟');
    expect(warning).toContain('擦式消毒薬がある');
    expect(warning).toContain('山田: A');
    expect(warning).toContain('田中: C');
    expect(warning).toContain('厳しい方の評価');
    // 一致した項目は分かれていないので出さない
    expect(warning).not.toContain('手袋を適切に外している');
  });

  it('3人でA・B・Cが混ざっても読み込み順に関係なくCを採用する', () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'B' }),
      makeShared('1病棟', '田中', { 'shushi-1': 'C' }),
      makeShared('1病棟', '佐藤', { 'shushi-1': 'A' }),
    ]);

    expect(merged.columns[0].ratings.get(keyOf('擦式消毒薬がある'))).toBe('C');
    const [warning] = splitWarnings(merged.warnings);
    expect(warning).toContain('山田: B');
    expect(warning).toContain('田中: C');
    expect(warning).toContain('佐藤: A');
  });

  it('評価が一致していれば警告しない', () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'B', 'shushi-2': 'B' }),
      makeShared('1病棟', '田中', { 'shushi-1': 'B', 'shushi-2': 'B' }),
    ]);

    expect(merged.warnings).toEqual([]);
    expect(merged.columns[0].ratings.get(keyOf('擦式消毒薬がある'))).toBe('B');
  });

  it('分かれた項目が複数あっても警告は病棟ごとに1件にまとめ、どの項目かは残す', () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'A', 'shushi-2': 'A' }),
      makeShared('1病棟', '田中', { 'shushi-1': 'B', 'shushi-2': 'C' }),
    ]);

    expect(splitWarnings(merged.warnings)).toHaveLength(1);
    const [warning] = splitWarnings(merged.warnings);
    expect(warning).toContain('擦式消毒薬がある');
    expect(warning).toContain('手袋を適切に外している');
  });

  it('病棟ごとに評価をまとめるので、病棟が違えば評価が違っても警告しない', () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'A' }),
      makeShared('2病棟', '田中', { 'shushi-1': 'C' }),
    ]);

    expect(merged.columns.map((c) => c.label)).toEqual(['1病棟', '2病棟']);
    expect(merged.columns[0].ratings.get(keyOf('擦式消毒薬がある'))).toBe('A');
    expect(merged.columns[1].ratings.get(keyOf('擦式消毒薬がある'))).toBe('C');
    expect(splitWarnings(merged.warnings)).toEqual([]);
  });

  it('病棟名の前後の空白は無視して同じ列にまとめる', () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'A' }),
      makeShared(' 1病棟 ', '田中', { 'shushi-2': 'B' }),
    ]);

    expect(merged.columns).toHaveLength(1);
    expect(merged.columns[0].label).toBe('1病棟');
  });

  it('病棟名が空の報告書はまとめず、担当者名を見出しにする', () => {
    const merged = mergeRounds([
      makeShared('', '山田', { 'shushi-1': 'A' }),
      makeShared('', '田中', { 'shushi-2': 'B' }),
    ]);

    expect(merged.columns.map((c) => c.label)).toEqual(['山田', '田中']);
  });

  it('病棟名が空で担当者名も同じ報告書は連番で区別する', () => {
    const merged = mergeRounds([
      makeShared('', '山田', { 'shushi-1': 'A' }),
      makeShared('', '山田', { 'shushi-2': 'B' }),
    ]);

    expect(merged.columns.map((c) => c.label)).toEqual(['山田', '山田 2']);
  });

  it('1列にまとまった報告書の実施日時は最も早いものにする', () => {
    const early = makeShared('1病棟', '山田', { 'shushi-1': 'A' });
    early.roundData.startTime = '2026-09-19 09:00';
    const late = makeShared('1病棟', '田中', { 'shushi-2': 'B' });
    late.roundData.startTime = '2026-09-19 14:00';

    expect(mergeRounds([late, early]).columns[0].startTime).toBe('2026-09-19 09:00');
  });
});

function duplicateIdWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => w.includes('複数のチェック項目に使われています'));
}

function unknownIdWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => w.includes('チェックリストに無い項目ID'));
}

function missingItemWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => w.includes('項目がありません'));
}

describe('mergeRounds（1つの報告書の中の不整合）', () => {
  it('1つの報告書の中で項目IDが重複していたら、どの報告書のどのIDかを警告する', () => {
    // 項目IDは「カテゴリ名の短縮-連番」で作られるため、記号だけが違うカテゴリ名では衝突し得る
    const room: ChecklistCategory = {
      category: '手指衛生（病室）',
      items: [{ id: 'shushi-1', category: '手指衛生（病室）', description: '擦式消毒薬がある' }],
    };
    const treatment: ChecklistCategory = {
      category: '手指衛生(処置室)',
      items: [{ id: 'shushi-1', category: '手指衛生(処置室)', description: '擦式消毒薬がある' }],
    };

    const merged = mergeRounds([makeExport('3階東病棟', [room, treatment])]);

    expect(duplicateIdWarnings(merged.warnings)).toHaveLength(1);
    const [warning] = duplicateIdWarnings(merged.warnings);
    expect(warning).toContain('3階東病棟');
    expect(warning).toContain('山口');
    expect(warning).toContain('shushi-1');
    expect(warning).toContain('本来の行に載らない可能性があります');
    // 統合自体は止めない
    expect(merged.columns).toHaveLength(1);
    expect(merged.categories.flatMap((c) => c.items)).toHaveLength(2);
  });

  it('項目IDが重複していなければ重複の警告は出さない', () => {
    const merged = mergeRounds([makeExport('3階東病棟', [HYGIENE_2])]);

    expect(duplicateIdWarnings(merged.warnings)).toEqual([]);
  });

  it('チェックリストに無い項目IDの評価は表に反映されない旨を警告する', () => {
    const stale = makeExport('3階東病棟', [HYGIENE_2]);
    stale.roundData.checklistResults.push({ itemId: 'kankyo-9', rating: 'C', photos: [] });

    const merged = mergeRounds([stale]);

    expect(unknownIdWarnings(merged.warnings)).toHaveLength(1);
    const [warning] = unknownIdWarnings(merged.warnings);
    expect(warning).toContain('3階東病棟');
    expect(warning).toContain('kankyo-9');
    // 定義にある項目の評価は従来どおり載る
    expect(merged.columns[0].ratings.get(keyOf('擦式消毒薬がある'))).toBe('A');
  });

  it('チェックリストに無い項目IDでも未評価なら警告しない', () => {
    const stale = makeExport('3階東病棟', [HYGIENE_2]);
    stale.roundData.checklistResults.push({ itemId: 'kankyo-9', rating: null, photos: [] });

    expect(unknownIdWarnings(mergeRounds([stale]).warnings)).toEqual([]);
  });

  it('定義にある項目のチェック結果が無くても、項目が足りないとは警告しない', () => {
    const partial = makeExport('3階東病棟', [HYGIENE_2]);
    partial.roundData.checklistResults = [{ itemId: 'shushi-1', rating: 'A', photos: [] }];

    const merged = mergeRounds([partial]);

    expect(merged.warnings).toEqual([]);
    // 結果が無い項目は「その部署に無い項目」ではなく未評価として扱う
    expect(merged.columns[0].ratings.get(keyOf('手袋を適切に外している'))).toBeNull();
  });

  it('別の病棟の列にしかない項目があれば、従来どおり項目が足りない旨を警告する', () => {
    const water: ChecklistCategory = {
      category: '水回り',
      items: [{ id: 'mizumawari-1', category: '水回り', description: '流し台が清潔である' }],
    };

    const merged = mergeRounds([makeExport('1病棟', [HYGIENE]), makeExport('2病棟', [water])]);

    const warnings = missingItemWarnings(merged.warnings);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('「1病棟」には他のファイルにある 1 項目がありません');
    expect(warnings[1]).toContain('「2病棟」には他のファイルにある 1 項目がありません');
  });
});
