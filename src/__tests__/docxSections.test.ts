import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { Document, Packer, type Paragraph, type Table } from 'docx';
import {
  buildCoverSection, buildChecklistSection, buildPhotoSection, buildEvaluationSection,
  type DocxColors,
} from '../docx';
import type { ChecklistCategory, Photo, RoundData } from '../types';

// Distinct colors per role, so each assertion shows which role a run or cell uses
const CLR: DocxColors = {
  primary: '0000A1',
  primaryLt: '0000A2',
  base: '0000A3',
  text: '0000A4',
  textMuted: '0000A5',
  textFaint: '0000A6',
  line: '0000A7',
};

const PIXEL_JPEG = `data:image/jpeg;base64,${readFileSync(
  fileURLToPath(new URL('./fixtures/pixel.jpg', import.meta.url))
).toString('base64')}`;

const CATEGORIES: ChecklistCategory[] = [
  {
    category: '手指衛生',
    items: [
      { id: 'h1', category: '手指衛生', description: '手指消毒剤が配置されている' },
      { id: 'h2', category: '手指衛生', description: '5つのタイミングが掲示されている' },
    ],
  },
  {
    category: '環境',
    items: [
      { id: 'e1', category: '環境', description: 'ゴミ箱に蓋がある' },
      { id: 'e2', category: '環境', description: '結果の無い項目' },
    ],
  },
];

function makeRound(overrides: Partial<RoundData> = {}): RoundData {
  return {
    inspectorName: '山口',
    wardName: '3階東病棟',
    startTime: '2026-09-19 10:00',
    checklistResults: [],
    generalPhotos: [],
    overallEvaluation: '',
    ...overrides,
  };
}

function photo(id: string, comment: string, dataUrl = PIXEL_JPEG): Photo {
  return { id, dataUrl, comment, timestamp: '2026-09-19T01:00:00.000Z', width: 1, height: 1 };
}

async function toZip(children: (Paragraph | Table)[]): Promise<JSZip> {
  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  return JSZip.loadAsync(await blob.arrayBuffer());
}

async function toXml(children: (Paragraph | Table)[]): Promise<string> {
  const zip = await toZip(children);
  const part = zip.file('word/document.xml');
  if (!part) throw new Error('word/document.xml がありません');
  const xml = await part.async('string');
  return xml.slice(xml.indexOf('<w:body>'), xml.indexOf('<w:sectPr'));
}

function allTexts(xml: string): string[] {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/g)].map(([, text]) => text);
}

/**
 * 段落の書式と文字列を1行に要約する。
 * 例: `[Heading2 before=200 after=160] | *1(26)#0000A1`（* は太字、括弧は文字サイズ、# は文字色）
 */
function describeParagraph(p: string): string {
  const pPr = p.match(/<w:pPr>(.*?)<\/w:pPr>/)?.[1] ?? '';
  const border = pPr.match(/<w:pBdr><w:(top|bottom) [^>]*w:color="(\w+)"[^>]*w:sz="(\d+)"/);
  const props = [
    pPr.match(/<w:pStyle w:val="(\w+)"/)?.[1],
    pPr.match(/<w:jc w:val="(\w+)"/)?.[1],
    ...['before', 'after'].map((side) => {
      const value = pPr.match(new RegExp(`<w:spacing [^>]*w:${side}="(\\d+)"`))?.[1];
      return value && `${side}=${value}`;
    }),
    border && `border-${border[1]}(${border[3]})#${border[2]}`,
  ].filter(Boolean);
  const runs = [...p.matchAll(/<w:r>(.*?)<\/w:r>/g)].map(([, run]) => {
    if (run.includes('<w:drawing>')) return 'IMAGE';
    const size = run.match(/<w:sz w:val="(\d+)"/)?.[1];
    const color = run.match(/<w:color w:val="(\w+)"/)?.[1];
    const bold = run.includes('<w:b/>') ? '*' : '';
    const sizeSuffix = size ? `(${size})` : '';
    const colorSuffix = color ? `#${color}` : '';
    return `${bold}${allTexts(run).join('')}${sizeSuffix}${colorSuffix}`;
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

function tables(xml: string): string[] {
  return [...xml.matchAll(/<w:tbl>(.*?)<\/w:tbl>/g)].map(([, table]) => table);
}

/** 表のセルを「幅 塗り色 段落の要約…」に落とす（行ごと → セルごと） */
function tableLayout(table: string): string[][] {
  return [...table.matchAll(/<w:tr>(.*?)<\/w:tr>/g)].map(([, row]) =>
    [...row.matchAll(/<w:tc>(.*?)<\/w:tc>/g)].map(([, cell]) => {
      const width = cell.match(/<w:tcW [^>]*w:w="(\d+)"/)?.[1] ?? '?';
      const fill = cell.match(/<w:shd [^>]*w:fill="(\w+)"/)?.[1] ?? 'none';
      // An empty paragraph is written as <w:p/>
      const paragraphs = [...cell.matchAll(/<w:p\/>|<w:p(?:\s[^>]*)?>(.*?)<\/w:p>/g)].map(([, p]) => describeParagraph(p ?? ''));
      return [`${width} ${fill}`, ...paragraphs].join(' / ');
    })
  );
}

describe('buildCoverSection', () => {
  it('表題、担当者・病棟・実施日時の1行、表題下の線を並べる', async () => {
    const xml = await toXml(buildCoverSection(makeRound(), CLR));

    expect(bodyLayout(xml)).toEqual([
      '[Heading1 center after=160] | *感染対策ラウンド報告書(32)#0000A4',
      '[after=80] | *担当者: #0000A5 | 山口#0000A4 | 　 | *病棟: #0000A5 | 3階東病棟#0000A4 | 　 | *実施日時: #0000A5 | 2026-09-19 10:00#0000A4',
      '[after=300 border-bottom(6)#0000A1]',
    ]);
  });

  it('病棟名が空なら「—」を出す', async () => {
    const xml = await toXml(buildCoverSection(makeRound({ wardName: '' }), CLR));

    expect(allTexts(xml)).toContain('—');
    expect(allTexts(xml)).not.toContain('3階東病棟');
  });
});

describe('buildChecklistSection', () => {
  const round = makeRound({
    checklistResults: [
      { itemId: 'h1', rating: 'A', photos: [] },
      { itemId: 'h2', rating: 'B', photos: [] },
      { itemId: 'e1', rating: 'C', photos: [] },
      // 定義に無い項目の結果は表に出さない
      { itemId: 'gone', rating: 'A', photos: [] },
    ],
  });

  it('節見出し、表、表の後の余白を並べる', async () => {
    const xml = await toXml(buildChecklistSection(round, CATEGORIES, CLR));

    expect(bodyLayout(xml)).toEqual([
      '[Heading2 before=200 after=160] | *1(26)#0000A1 | *  チェックリスト(26)#0000A4',
      'TABLE',
      '[after=160]',
    ]);
  });

  it('定義の順に全項目を並べ、評価を評価ごとの色で、未評価と結果の無い項目を「—」で出す', async () => {
    const xml = await toXml(buildChecklistSection(round, CATEGORIES, CLR));

    expect(tables(xml)).toHaveLength(1);
    expect(tableLayout(tables(xml)[0])).toEqual([
      ['1300 0000A2 / [] | *ジャンル(18)#0000A1', '7126 0000A2 / [] | *チェック項目(18)#0000A1', '600 0000A2 / [center] | *評価(18)#0000A1'],
      ['1300 FFFFFF / [] | 手指衛生(18)#0000A5', '7126 FFFFFF / [] | 手指消毒剤が配置されている(18)#0000A4', '600 FFFFFF / [center] | *A(22)#059669'],
      ['1300 FFFFFF / [] | 手指衛生(18)#0000A5', '7126 FFFFFF / [] | 5つのタイミングが掲示されている(18)#0000A4', '600 FFFFFF / [center] | *B(22)#D4A017'],
      ['1300 FFFFFF / [] | 環境(18)#0000A5', '7126 FFFFFF / [] | ゴミ箱に蓋がある(18)#0000A4', '600 FFFFFF / [center] | *C(22)#DC2626'],
      ['1300 FFFFFF / [] | 環境(18)#0000A5', '7126 FFFFFF / [] | 結果の無い項目(18)#0000A4', '600 FFFFFF / [center] | *—(22)#0000A6'],
    ]);
    expect(xml).toContain('<w:tblW w:type="pct" w:w="5000"/>');
  });

  it('評価が null の項目も「—」を薄い色で出す', async () => {
    const xml = await toXml(buildChecklistSection(
      makeRound({ checklistResults: [{ itemId: 'h1', rating: null, photos: [] }] }),
      [CATEGORIES[0]],
      CLR,
    ));

    expect(tableLayout(tables(xml)[0])[1][2]).toBe('600 FFFFFF / [center] | *—(22)#0000A6');
  });

  it('項目が無ければ見出し行だけの表にする', async () => {
    const xml = await toXml(buildChecklistSection(makeRound(), [], CLR));

    expect(tableLayout(tables(xml)[0])).toHaveLength(1);
  });
});

describe('buildPhotoSection', () => {
  it('写真が1枚も無ければ節ごと出さない', () => {
    const round = makeRound({ checklistResults: [{ itemId: 'h1', rating: 'A', photos: [] }] });

    expect(buildPhotoSection(round, CATEGORIES, CLR)).toEqual([]);
  });

  it('区切り線と節見出しの後に、項目の写真 → 全体写真の順で3列の表を並べる', async () => {
    const round = makeRound({
      checklistResults: [{ itemId: 'h1', rating: 'A', photos: [photo('p1', '消毒剤の写真')] }],
      generalPhotos: [photo('g1', ''), photo('g2', '全体2'), photo('g3', '全体3')],
    });

    const xml = await toXml(buildPhotoSection(round, CATEGORIES, CLR));

    expect(bodyLayout(xml)).toEqual([
      '[before=300 border-top(2)#0000A7]',
      '[Heading2 before=200 after=160] | *2(26)#0000A1 | *  写真記録とICTコメント(26)#0000A4',
      'TABLE',
      '[after=80]',
      'TABLE',
      '[after=80]',
    ]);
    const [first, second] = tables(xml).map(tableLayout);
    expect(first).toEqual([[
      '3009 none / [center after=40] | *手指衛生: 手指消毒剤が配置されている(16)#0000A1 / [center after=40] | IMAGE / [center] | 消毒剤の写真(16)',
      // コメントの無い写真はコメントの段落を出さない
      '3009 none / [center after=40] | *(16)#0000A1 / [center after=40] | IMAGE',
      '3008 none / [center after=40] | *(16)#0000A1 / [center after=40] | IMAGE / [center] | 全体2(16)',
    ]]);
    // 端数の行は空のセルで3列に揃える
    expect(second).toEqual([[
      '3009 none / [center after=40] | *(16)#0000A1 / [center after=40] | IMAGE / [center] | 全体3(16)',
      '3009 none / []',
      '3008 none / []',
    ]]);
    expect(xml).toContain('<w:tblLayout w:type="fixed"/>');
  });

  it('写真がちょうど3枚なら表は1つだけにする', async () => {
    const round = makeRound({ generalPhotos: [photo('g1', 'a'), photo('g2', 'b'), photo('g3', 'c')] });

    const xml = await toXml(buildPhotoSection(round, CATEGORIES, CLR));

    expect(tables(xml)).toHaveLength(1);
    expect(bodyLayout(xml).slice(2)).toEqual(['TABLE', '[after=80]']);
  });

  it('写真は JPEG として埋め込む', async () => {
    const zip = await toZip(buildPhotoSection(makeRound({ generalPhotos: [photo('g1', 'x')] }), CATEGORIES, CLR));

    const media = Object.keys(zip.files).filter((name) => name.startsWith('word/media/') && !zip.files[name].dir);
    expect(media).toHaveLength(1);
    expect(media[0]).toMatch(/\.jpg$/);
  });

  it('写真の付いた項目が一部だけでも節を出す', async () => {
    const round = makeRound({
      checklistResults: [
        { itemId: 'h1', rating: 'A', photos: [] },
        { itemId: 'h2', rating: 'B', photos: [photo('p1', 'x')] },
      ],
    });

    const xml = await toXml(buildPhotoSection(round, CATEGORIES, CLR));

    expect(bodyLayout(xml)[1]).toBe('[Heading2 before=200 after=160] | *2(26)#0000A1 | *  写真記録とICTコメント(26)#0000A4');
  });

  it('全体写真だけでも節を出す', async () => {
    const xml = await toXml(buildPhotoSection(makeRound({ generalPhotos: [photo('g1', 'x')] }), CATEGORIES, CLR));

    expect(bodyLayout(xml)[1]).toBe('[Heading2 before=200 after=160] | *2(26)#0000A1 | *  写真記録とICTコメント(26)#0000A4');
  });

  it('画像を読めない写真は画像を飛ばし、ラベルとコメントは残す', async () => {
    const round = makeRound({ generalPhotos: [photo('bad', '壊れた写真', 'not-a-data-url')] });

    const xml = await toXml(buildPhotoSection(round, CATEGORIES, CLR));

    expect(xml).not.toContain('<w:drawing>');
    expect(tableLayout(tables(xml)[0])[0][0]).toBe('3009 none / [center after=40] | *(16)#0000A1 / [center] | 壊れた写真(16)');
  });
});

describe('buildEvaluationSection', () => {
  it('区切り線と節見出しの後に、総評を行ごとの段落で出す（空行も空の文字列の段落にする）', async () => {
    const xml = await toXml(buildEvaluationSection('良好\n\n改善あり', CLR));

    expect(bodyLayout(xml)).toEqual([
      '[before=300 border-top(2)#0000A7]',
      '[Heading2 before=200 after=160] | *3(26)#0000A1 | *  総評(26)#0000A4',
      '[after=80] | 良好(22)#0000A4',
      '[after=80] | (22)#0000A4',
      '[after=80] | 改善あり(22)#0000A4',
    ]);
  });

  it('総評が空白だけなら書き込み用の空段落を1つ置く', async () => {
    const xml = await toXml(buildEvaluationSection(' \n ', CLR));

    expect(bodyLayout(xml).slice(2)).toEqual(['[after=80]']);
  });
});
