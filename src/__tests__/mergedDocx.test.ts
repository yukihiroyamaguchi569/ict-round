import { describe, it, expect, vi } from 'vitest';
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
