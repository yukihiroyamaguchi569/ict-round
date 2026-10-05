import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { buildMergedDocxBlob } from '../merge/mergedDocx';
import { mergeRounds } from '../merge/mergeRounds';
import type { ChecklistCategory, Rating, RoundExport } from '../types';
import { HYGIENE_ONLY, makeRoundExport } from './fixtures/roundDocx';

// getDocxColors は CSS 変数を読むため、environment: 'node' では最小限の stub を置く
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));

const PIXEL_JPEG = readFileSync(
  fileURLToPath(new URL('./fixtures/pixel.jpg', import.meta.url))
).toString('base64');

/** One report with a single checklist table; the overall evaluation names the inspector */
function makeShared(wardName: string, inspectorName: string, ratings: Record<string, Rating>): RoundExport {
  return makeRoundExport({
    wardName,
    inspectorName,
    ratings,
    categories: HYGIENE_ONLY,
    overallEvaluation: `${inspectorName}の所見`,
  });
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

async function readDocumentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const part = zip.file('word/document.xml');
  if (!part) throw new Error('word/document.xml がありません');
  return part.async('string');
}

function allTexts(xml: string): string[] {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/g)].map(([, text]) => text);
}

function deptHeadings(xml: string): string[] {
  return allTexts(xml).filter((text) => text.startsWith('■'));
}

/**
 * 段落の書式と文字列を1行に要約する。
 * 例: `[Heading2 before=200 after=160] | *1(26) | *  チェックリスト（部署別）(26)`（* は太字、括弧は文字サイズ）
 */
function describeParagraph(p: string): string {
  const pPr = p.match(/<w:pPr>(.*?)<\/w:pPr>/)?.[1] ?? '';
  const props = [
    pPr.match(/<w:pStyle w:val="(\w+)"/)?.[1],
    pPr.match(/<w:jc w:val="(\w+)"/)?.[1],
    ...['before', 'after'].map((side) => {
      const value = pPr.match(new RegExp(`<w:spacing [^>]*w:${side}="(\\d+)"`))?.[1];
      return value && `${side}=${value}`;
    }),
    pPr.match(/<w:pBdr><w:(top|bottom) /)?.[1] && `border-${pPr.match(/<w:pBdr><w:(top|bottom) /)![1]}`,
  ].filter(Boolean);
  const runs = [...p.matchAll(/<w:r>(.*?)<\/w:r>/g)].map(([, run]) => {
    const size = run.match(/<w:sz w:val="(\d+)"/)?.[1];
    const bold = run.includes('<w:b/>') ? '*' : '';
    const sizeSuffix = size ? `(${size})` : '';
    return `${bold}${allTexts(run).join('')}${sizeSuffix}`;
  });
  return [`[${props.join(' ')}]`, ...runs].join(' | ');
}

/** 本文の段落を上から要約する。表は中身を見ずに TABLE の1行にする */
function bodyLayout(xml: string): string[] {
  const body = xml.replace(/<w:tbl>.*?<\/w:tbl>/g, '<w:p>TABLE</w:p>');
  return [...body.matchAll(/<w:p(?:\s[^>]*)?>(.*?)<\/w:p>/g)].map(([, p]) =>
    p === 'TABLE' ? 'TABLE' : describeParagraph(p)
  );
}

/** 表のセルを「塗り色 段落の要約」に落とす（行ごと → セルごと） */
function tableLayout(xml: string, index: number): string[][] {
  const table = [...xml.matchAll(/<w:tbl>(.*?)<\/w:tbl>/g)][index][1];
  return [...table.matchAll(/<w:tr>(.*?)<\/w:tr>/g)].map(([, row]) =>
    [...row.matchAll(/<w:tc>(.*?)<\/w:tc>/g)].map(([, cell]) => {
      const fill = cell.match(/<w:shd w:fill="(\w+)"/)?.[1] ?? 'none';
      const p = cell.match(/<w:p(?:\s[^>]*)?>(.*?)<\/w:p>/)?.[1] ?? '';
      return `${fill} ${describeParagraph(p)}`;
    })
  );
}

describe('buildMergedDocxBlob（報告書の書式）', () => {
  const EMPTY: ChecklistCategory = { category: '項目の無いカテゴリ', items: [] };

  function makeLayoutInput() {
    const yamada = makeRoundExport({
      wardName: '1病棟',
      inspectorName: '山田',
      ratings: { h1: 'A' },
      categories: [...HYGIENE_ONLY, EMPTY],
      startTime: '2026-09-19 10:00',
      overallEvaluation: '良好\n二行目',
    });
    const tanaka = makeRoundExport({
      wardName: '1病棟',
      inspectorName: '田中',
      ratings: { h2: 'C' },
      categories: HYGIENE_ONLY,
      startTime: '2026-09-19 11:00',
    });
    // 読み込み順は後でも実施日時が最も早い
    const sato = makeRoundExport({
      wardName: '2病棟',
      inspectorName: '佐藤',
      ratings: { h1: 'B' },
      categories: HYGIENE_ONLY,
      startTime: '2026-09-19 09:00',
    });
    const unnamed = makeRoundExport({
      wardName: '3病棟',
      inspectorName: '',
      ratings: { h1: 'A' },
      categories: HYGIENE_ONLY,
      overallEvaluation: '3病棟の所見',
    });
    return mergeRounds([yamada, tanaka, sato, unnamed]);
  }

  it('表紙・節見出し・総評の段落を決まった書式で並べ、項目の無いカテゴリは出さない', async () => {
    const xml = await readDocumentXml(await buildMergedDocxBlob(makeLayoutInput()));

    expect(bodyLayout(xml)).toEqual([
      '[Heading1 center after=160] | *感染対策ラウンド報告書（統合）(32)',
      // 実施日時は全部署で最も早いもの、担当者は空の名前を除いて重複なく並べる
      '[after=80] | *実施日時:  | 2026-09-19 09:00',
      '[after=80] | *対象部署:  | 1病棟、2病棟、3病棟',
      '[after=80] | *担当者:  | 山田、田中、佐藤',
      '[after=300 border-bottom]',
      '[Heading2 before=200 after=160] | *1(26) | *  チェックリスト（部署別）(26)',
      '[before=160 after=80] | *【手指衛生】(22)',
      'TABLE',
      '[before=300 border-top]',
      '[Heading2 before=200 after=160] | *2(26) | *  総評（部署別）(26)',
      '[before=200 after=80] | *■ 1病棟(22)',
      // 担当者名は総評の1行目にだけ添える
      '[after=80] | 山田：良好(22)',
      '[after=80] | 二行目(22)',
      '[before=200 after=80] | *■ 2病棟（担当: 佐藤）(22)',
      '[after=80]',
      '[before=200 after=80] | *■ 3病棟(22)',
      '[after=80] | 3病棟の所見(22)',
    ]);
  });

  it('評価表は見出し行を塗って各ページで繰り返し、部署の列と評価を中央に揃えて太字にする', async () => {
    const xml = await readDocumentXml(await buildMergedDocxBlob(makeLayoutInput()));

    // getDocxColors は stub 環境では既定色（CCCCCC）になるため、見出しの塗りは白との違いで確かめる
    expect(tableLayout(xml, 0)).toEqual([
      ['CCCCCC [left] | *チェック項目(18)', 'CCCCCC [center] | *1病棟(18)', 'CCCCCC [center] | *2病棟(18)', 'CCCCCC [center] | *3病棟(18)'],
      ['FFFFFF [] | 手指消毒剤が配置されている(18)', 'FFFFFF [center] | *A(22)', 'FFFFFF [center] | *B(22)', 'FFFFFF [center] | *A(22)'],
      ['FFFFFF [] | 5つのタイミングが掲示されている(18)', 'FFFFFF [center] | *C(22)', 'FFFFFF [center] | *—(22)', 'FFFFFF [center] | *—(22)'],
    ]);
    expect(xml.match(/<w:trPr>.*?<\/w:trPr>/g)).toEqual(['<w:trPr><w:tblHeader/></w:trPr>']);
  });

  it('用紙は A4 横にする（列幅は横向きの本文幅で計算している）', async () => {
    const xml = await readDocumentXml(await buildMergedDocxBlob(makeLayoutInput()));

    expect(xml).toContain('<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>');
  });

  it('写真がある部署だけ、写真の節を見出し付きで出す', async () => {
    const merged = mergeRounds([
      withGeneralPhoto(makeShared('1病棟', '山田', { h1: 'A' }), '山田の写真'),
      makeShared('2病棟', '田中', { h1: 'C' }),
    ]);

    const layout = bodyLayout(await readDocumentXml(await buildMergedDocxBlob(merged)));

    const start = layout.indexOf('[Heading2 before=200 after=160] | *3(26) | *  写真記録とICTコメント（部署別）(26)');
    expect(layout[start - 1]).toBe('[before=300 border-top]');
    expect(layout[start + 1]).toBe('[before=200 after=80] | *■ 1病棟（担当: 山田）(22)');
    expect(layout.slice(start).filter((line) => line.includes('■'))).toEqual([
      '[before=200 after=80] | *■ 1病棟（担当: 山田）(22)',
    ]);
  });

  it('担当者名の前後の空白は、節見出しと総評に添える名前から落とす', async () => {
    const single = makeShared('1病棟', ' 山田 ', { h1: 'A' });
    const shared = [makeShared('2病棟', ' 田中 ', { h1: 'A' }), makeShared('2病棟', '佐藤', { h2: 'B' })];

    const xml = await readDocumentXml(await buildMergedDocxBlob(mergeRounds([single, ...shared])));

    expect(deptHeadings(xml)).toEqual(['■ 1病棟（担当: 山田）', '■ 2病棟']);
    expect(allTexts(xml)).toContain('田中： 田中 の所見');
  });
});
