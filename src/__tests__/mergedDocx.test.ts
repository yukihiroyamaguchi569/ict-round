import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { buildMergedDocxBlob, CONTENT_W, READABLE_DEPT_MAX } from '../merge/mergedDocx';
import { mergeRounds } from '../merge/mergeRounds';
import type { ChecklistCategory, Rating, RoundExport } from '../types';

// getDocxColors は CSS 変数を読むため、environment: 'node' では最小限の stub を置く
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));

const HYGIENE: ChecklistCategory = {
  category: '手指衛生',
  items: [{ id: 'shushi-1', category: '手指衛生', description: '擦式消毒薬がある' }],
};

/** 全項目を同じ評価で埋めた1部署分のエクスポート */
function makeExport(wardName: string, rating: Rating, categories = [HYGIENE]): RoundExport {
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
        cat.items.map((item) => ({ itemId: item.id, rating, photos: [] }))
      ),
      generalPhotos: [],
      overallEvaluation: `${wardName}の所見`,
    },
  };
}

async function readDocumentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const part = zip.file('word/document.xml');
  if (!part) throw new Error('word/document.xml がありません');
  return part.async('string');
}

/** 本文の文字列をすべて取り出す（w:tcPr などを拾わないよう w:t だけに絞る） */
function allTexts(xml: string): string[] {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/g)].map(([, text]) => text);
}

/** 表の中身をセルの文字列に落とす（表ごと → 行ごと → セルごと） */
function tableCells(xml: string): string[][][] {
  return [...xml.matchAll(/<w:tbl>(.*?)<\/w:tbl>/g)].map(([, table]) =>
    [...table.matchAll(/<w:tr>(.*?)<\/w:tr>/g)].map(([, row]) =>
      [...row.matchAll(/<w:tc>(.*?)<\/w:tc>/g)].map(([, cell]) => allTexts(cell).join(''))
    )
  );
}

/** 表ごとの列幅指定（w:tblGrid の w:gridCol） */
function tableGridWidths(xml: string): number[][] {
  return [...xml.matchAll(/<w:tblGrid>(.*?)<\/w:tblGrid>/g)].map(([, grid]) =>
    [...grid.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(([, width]) => Number(width))
  );
}

describe('buildMergedDocxBlob', () => {
  it('部署ごとの列に評価を並べた表と総評を出力する', async () => {
    const merged = mergeRounds([makeExport('3階東病棟', 'A'), makeExport('4階西病棟', 'C')]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(tableCells(xml)[0]).toEqual([
      ['チェック項目', '3階東病棟', '4階西病棟'],
      ['擦式消毒薬がある', 'A', 'C'],
    ]);
    expect(allTexts(xml)).toContain('3階東病棟の所見');
    expect(allTexts(xml)).toContain('4階西病棟の所見');
  });

  it('その部署に無い項目のセルは — になる', async () => {
    const water: ChecklistCategory = {
      category: '水回り',
      items: [{ id: 'mizumawari-1', category: '水回り', description: '流し台が清潔である' }],
    };
    const merged = mergeRounds([makeExport('3階東病棟', 'A'), makeExport('4階西病棟', 'B', [water])]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    const [hygiene, waterTable] = tableCells(xml);
    expect(hygiene[1]).toEqual(['擦式消毒薬がある', 'A', '—']);
    expect(waterTable[1]).toEqual(['流し台が清潔である', '—', 'B']);
  });

  it('同じ項目IDで文言が違えば別の行にし、評価を正しい文言の行に載せる', async () => {
    const renamed: ChecklistCategory = {
      category: '手指衛生',
      items: [{ id: 'shushi-1', category: '手指衛生', description: '手袋を適切に外している' }],
    };
    const merged = mergeRounds([makeExport('3階東病棟', 'A'), makeExport('4階西病棟', 'C', [renamed])]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(tableCells(xml)[0]).toEqual([
      ['チェック項目', '3階東病棟', '4階西病棟'],
      ['擦式消毒薬がある', 'A', '—'],
      ['手袋を適切に外している', '—', 'C'],
    ]);
  });

  it('部署が増えても表の指定幅の合計が本文幅を超えない', async () => {
    for (const deptCount of [1, READABLE_DEPT_MAX, READABLE_DEPT_MAX + 1, 30]) {
      const merged = mergeRounds(
        Array.from({ length: deptCount }, (_, i) => makeExport(`${i + 1}階病棟`, 'A'))
      );

      const xml = await readDocumentXml(await buildMergedDocxBlob(merged));
      const [gridWidths] = tableGridWidths(xml);

      expect(gridWidths).toHaveLength(deptCount + 1);
      expect(gridWidths.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(CONTENT_W);
      expect(Math.min(...gridWidths)).toBeGreaterThan(0);
    }
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

/** 写真の埋め込みも通すため、1x1 の JPEG を使う */
const PIXEL_JPEG = readFileSync(
  fileURLToPath(new URL('./fixtures/pixel.jpg', import.meta.url))
).toString('base64');

/** 担当者名と項目ごとの評価を指定した1件分のエクスポート（総評は担当者名入り） */
function makeShared(
  wardName: string,
  inspectorName: string,
  ratings: Record<string, 'A' | 'B' | 'C'>
): RoundExport {
  const roundExport = makeExport(wardName, null, [HYGIENE_2]);
  roundExport.roundData.inspectorName = inspectorName;
  roundExport.roundData.overallEvaluation = `${inspectorName}の所見`;
  roundExport.roundData.checklistResults = HYGIENE_2.items.map((item) => ({
    itemId: item.id,
    rating: ratings[item.id] ?? null,
    photos: [],
  }));
  return roundExport;
}

function withGeneralPhoto(roundExport: RoundExport, comment: string): RoundExport {
  roundExport.roundData.generalPhotos = [{
    id: `p-${comment}`,
    dataUrl: `data:image/jpeg;base64,${PIXEL_JPEG}`,
    comment,
    timestamp: '2026-09-19T01:00:00.000Z',
    width: 1,
    height: 1,
  }];
  return roundExport;
}

/** 部署の節見出し（■ で始まる段落）だけを取り出す */
function deptHeadings(xml: string): string[] {
  return allTexts(xml).filter((text) => text.startsWith('■'));
}

describe('buildMergedDocxBlob（同じ病棟のまとめ方）', () => {
  it('同じ病棟の報告書を1列にまとめ、列見出しに担当者名を付けない', async () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'A' }),
      makeShared('1病棟', '田中', { 'shushi-2': 'C' }),
    ]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(tableCells(xml)[0]).toEqual([
      ['チェック項目', '1病棟'],
      ['擦式消毒薬がある', 'A'],
      ['手袋を適切に外している', 'C'],
    ]);
    expect(allTexts(xml)).toContain('山田、田中');
  });

  it('総評は病棟ごとに1つの節へまとめ、担当者名を添えて並べる', async () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'A' }),
      makeShared('1病棟', '田中', { 'shushi-2': 'C' }),
    ]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(deptHeadings(xml)).toEqual(['■ 1病棟']);
    expect(allTexts(xml)).toContain('山田：山田の所見');
    expect(allTexts(xml)).toContain('田中：田中の所見');
  });

  it('担当者が1人の病棟は節見出しに担当者名を添える', async () => {
    const merged = mergeRounds([makeShared('1病棟', '山田', { 'shushi-1': 'A' })]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(deptHeadings(xml)).toEqual(['■ 1病棟（担当: 山田）']);
    // 担当者が1人なら総評に担当者名を繰り返さない
    expect(allTexts(xml)).toContain('山田の所見');
  });

  it('総評が空の担当者は担当者名付きで（記載なし）と出す', async () => {
    const yamada = makeShared('1病棟', '山田', { 'shushi-1': 'A' });
    yamada.roundData.overallEvaluation = '';
    const merged = mergeRounds([yamada, makeShared('1病棟', '田中', { 'shushi-2': 'C' })]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(allTexts(xml)).toContain('山田：（記載なし）');
    expect(allTexts(xml)).toContain('田中：田中の所見');
  });

  it('写真も病棟ごとに1つの節へ集める', async () => {
    const merged = mergeRounds([
      withGeneralPhoto(makeShared('1病棟', '山田', { 'shushi-1': 'A' }), '山田の写真'),
      withGeneralPhoto(makeShared('1病棟', '田中', { 'shushi-2': 'C' }), '田中の写真'),
    ]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    // 総評と写真でそれぞれ1回ずつ、病棟名だけの節見出しが出る
    expect(deptHeadings(xml)).toEqual(['■ 1病棟', '■ 1病棟']);
    // 2人の写真が同じ写真テーブル（同じ節）に並ぶ
    const photoTable = tableCells(xml).at(-1)!;
    expect(photoTable[0][0]).toContain('山田の写真');
    expect(photoTable[0][1]).toContain('田中の写真');
  });

  it('病棟が違えば従来どおり別の列・別の節にする', async () => {
    const merged = mergeRounds([
      makeShared('1病棟', '山田', { 'shushi-1': 'A' }),
      makeShared('2病棟', '田中', { 'shushi-1': 'C' }),
    ]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(tableCells(xml)[0][0]).toEqual(['チェック項目', '1病棟', '2病棟']);
    expect(deptHeadings(xml)).toEqual(['■ 1病棟（担当: 山田）', '■ 2病棟（担当: 田中）']);
  });

  it('病棟名に担当者名が含まれていても節見出しに担当者名を添える', async () => {
    const merged = mergeRounds([makeShared('山田病棟', '山田', { 'shushi-1': 'A' })]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(deptHeadings(xml)).toEqual(['■ 山田病棟（担当: 山田）']);
  });

  it('病棟名が空の列は見出しが担当者名なので担当者名を重ねない', async () => {
    const merged = mergeRounds([makeShared('', '山田', { 'shushi-1': 'A' })]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(deptHeadings(xml)).toEqual(['■ 山田']);
  });

  it('チェック結果が無い項目のセルは — になり、項目が足りない扱いにもしない', async () => {
    const partial = makeShared('1病棟', '山田', { 'shushi-1': 'A' });
    partial.roundData.checklistResults = [{ itemId: 'shushi-1', rating: 'A', photos: [] }];
    const merged = mergeRounds([partial]);

    const xml = await readDocumentXml(await buildMergedDocxBlob(merged));

    expect(tableCells(xml)[0]).toEqual([
      ['チェック項目', '1病棟'],
      ['擦式消毒薬がある', 'A'],
      ['手袋を適切に外している', '—'],
    ]);
    expect(merged.warnings).toEqual([]);
  });
});
