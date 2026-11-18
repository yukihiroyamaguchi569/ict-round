import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import {
  buildFacilityDocxBlob, facilityPhotoEntries, formatReportDateTime, memberLines, splitDepartments,
  FACILITY_TABLE_DEPT_MAX, NOT_APPLICABLE_FILL,
} from '../facility/facilityDocx';
import type { FacilityRound } from '../facility/facilityRound';
import type { FacilityDepartment } from '../facility/facilitySettings';

// getDocxColors reads CSS variables; give the node environment a minimal stub.
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));

const PIXEL = `data:image/jpeg;base64,${readFileSync(new URL('./fixtures/pixel.jpg', import.meta.url)).toString('base64')}`;

/**
 * Three departments in two groups. i2 targets 病棟 only (外来 C is not applicable),
 * i3 excludes B. C has a stale mark on its not-applicable cell, which must not show or count.
 */
function round(patch: Partial<FacilityRound> = {}): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: new Date(2026, 10, 18, 9, 5).toISOString(),
    themeName: '手指衛生',
    items: [
      { id: 'i1', text: '消毒剤がある', targetGroups: [], excludedDepartments: [] },
      { id: 'i2', text: '手袋が補充されている', targetGroups: ['病棟'], excludedDepartments: [] },
      { id: 'i3', text: '掲示がある', targetGroups: [], excludedDepartments: ['B病棟'] },
    ],
    departments: [
      { name: 'A病棟', group: '病棟' },
      { name: 'B病棟', group: '病棟' },
      { name: 'C外来', group: '外来' },
    ],
    members: [
      { name: '山田', role: '看護師' },
      { name: '鈴木', role: '医師' },
      { name: '佐藤', role: '看護師' },
    ],
    marks: { A病棟: { i1: 'ok', i2: 'ok', i3: 'ng' }, B病棟: { i1: 'ng' }, C外来: { i2: 'ok' } },
    departmentComments: { A病棟: '良好\n継続する', B病棟: '  ', C外来: '' },
    overallComment: '',
    photos: [
      { id: 'p1', department: 'A病棟', itemId: 'i3', comment: '剥がれていた', takenAt: '2026-11-18T00:10:00.000Z', width: 1, height: 1 },
      { id: 'p2', department: 'B病棟', itemId: 'i1', comment: '', takenAt: '2026-11-18T00:11:00.000Z' },
    ],
    ...patch,
  };
}

async function readZip(blob: Blob): Promise<JSZip> {
  return JSZip.loadAsync(await blob.arrayBuffer());
}

async function documentXml(blob: Blob): Promise<string> {
  const part = (await readZip(blob)).file('word/document.xml');
  if (!part) throw new Error('word/document.xml がありません');
  return part.async('string');
}

function texts(xml: string): string[] {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/g)].map(([, t]) => t);
}

/** Text per paragraph; a line break inside a paragraph becomes "\n". */
function paragraphs(xml: string): string[] {
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>(.*?)<\/w:p>/g)].map(([, p]) =>
    texts(p.replaceAll('<w:br/>', '<w:t>\\n</w:t>')).join('').replaceAll('\\n', '\n')
  );
}

const count = (list: string[], value: string) => list.filter((t) => t === value).length;
const tableCount = (xml: string) => (xml.match(/<w:tbl>/g) ?? []).length;

function departments(n: number, group = '病棟', prefix = 'D'): FacilityDepartment[] {
  return Array.from({ length: n }, (_, i) => ({ name: `${prefix}${i + 1}`, group }));
}

describe('buildFacilityDocxBlob', () => {
  it('A4 横で、見出し・日時・職種ごとの参加者・凡例を出す', async () => {
    const xml = await documentXml(await buildFacilityDocxBlob(round(), {}));
    const ps = paragraphs(xml);
    expect(xml).toContain('w:orient="landscape"');
    expect(ps).toContain('感染対策ラウンド　手指衛生');
    expect(ps).toContain('2026/11/18 9:05');
    expect(ps).toContain('看護師：山田、佐藤');
    expect(ps).toContain('医師：鈴木');
    expect(ps).toContain('○ できている　× できていない　／ 確認なし　　　 対象外');
  });

  it('参加者がいなければ参加者の行を出さない', async () => {
    const xml = await documentXml(await buildFacilityDocxBlob(round({ members: [] }), {}));
    expect(paragraphs(xml).some((p) => p.includes('：') && !p.includes('感染対策'))).toBe(false);
  });

  it('表にグループ行・部署の列見出し・項目の番号と文を出す。見出しの 2 行はページごとに繰り返す', async () => {
    const xml = await documentXml(await buildFacilityDocxBlob(round(), {}));
    const t = texts(xml);
    for (const name of ['病棟', '外来', 'A病棟', 'B病棟', 'C外来', 'No', '項目', '1', '2', '3', '消毒剤がある', '遵守率']) {
      expect(t).toContain(name);
    }
    // 病棟 spans its two departments; the blank corner spans No and 項目.
    expect(xml.match(/<w:gridSpan w:val="2"\/>/g)?.length).toBeGreaterThanOrEqual(3);
    expect(xml.match(/<w:tblHeader\/>/g)).toHaveLength(2);
  });

  it('マスは ○ / × / ／ / 灰色の塗りで出す（凡例の 1 つずつを含む）。対象外のマスに残った印は出さない', async () => {
    const xml = await documentXml(await buildFacilityDocxBlob(round(), {}));
    const t = texts(xml);
    expect(count(t, '○')).toBe(2 + 1);
    expect(count(t, '×')).toBe(2 + 1);
    // B i2, C i1, C i3.
    expect(count(t, '／')).toBe(3);
    // B i3 and C i2, plus the legend swatch.
    expect(xml.split(`w:fill="${NOT_APPLICABLE_FILL}"`).length - 1).toBe(2 + 1);
  });

  it('最後の行に部署ごとの遵守率を出す（印が無ければ「－」）', async () => {
    const t = texts(await documentXml(await buildFacilityDocxBlob(round(), {})));
    const rateIndex = t.indexOf('遵守率');
    expect(t.slice(rateIndex + 1, rateIndex + 4)).toEqual(['67%', '0%', '－']);
  });

  it('部署ごとのコメントは空の部署を出さず、総評が空なら「（未記入）」', async () => {
    const ps = paragraphs(await documentXml(await buildFacilityDocxBlob(round(), {})));
    const heading = ps.indexOf('部署ごとのコメント');
    // The second line stays in the department's paragraph as a line break.
    expect(ps.slice(heading + 1, heading + 3)).toEqual(['・A病棟　良好\n継続する', '総評']);
    expect(ps[heading + 3]).toBe('（未記入）');
  });

  it('コメントが 1 つも無ければ「（なし）」、総評は 1 つの段落の中で改行する', async () => {
    const ps = paragraphs(await documentXml(await buildFacilityDocxBlob(
      round({ departmentComments: {}, overallComment: '良好\n改善あり' }), {}
    )));
    const heading = ps.indexOf('部署ごとのコメント');
    expect(ps.slice(heading + 1, heading + 4)).toEqual(['（なし）', '総評', '良好\n改善あり']);
  });

  it('日時と職種ごとの行は同じ間隔で並べる', async () => {
    const xml = await documentXml(await buildFacilityDocxBlob(round(), {}));
    const lines = ['2026/11/18 9:05', '看護師：山田、佐藤', '医師：鈴木'].map((line) =>
      [...xml.matchAll(/<w:p(?:\s[^>]*)?>(.*?)<\/w:p>/g)].find(([, p]) => texts(p).join('') === line)?.[1]
    );
    const spacing = lines.map((p) => p?.match(/<w:spacing [^>]*\/>/)?.[0]);
    expect(spacing[0]).toBeDefined();
    expect(new Set(spacing).size).toBe(1);
  });

  it('マスの ○ と × は大きく太く、濃い緑と濃い赤で出す', async () => {
    const xml = await documentXml(await buildFacilityDocxBlob(round(), {}));
    const runOf = (mark: string) =>
      [...xml.matchAll(/<w:r>(.*?)<\/w:r>/g)].map(([, r]) => r).filter((r) => r.endsWith(`>${mark}</w:t>`));
    for (const [mark, color] of [['○', '006B3C'], ['×', 'B00020']]) {
      const cells = runOf(mark).filter((r) => r.includes('<w:sz w:val="36"/>'));
      expect(cells).toHaveLength(2);
      for (const r of cells) {
        expect(r).toContain('<w:b/>');
        expect(r).toContain(`<w:color w:val="${color}"/>`);
      }
    }
  });

  it('写真の表は横向きの本文幅いっぱいに 3 列で広げる', async () => {
    const xml = await documentXml(await buildFacilityDocxBlob(round(), { p1: PIXEL }));
    const photoTable = [...xml.matchAll(/<w:tbl>(.*?)<\/w:tbl>/g)].map(([, t]) => t).at(-1) ?? '';
    expect(photoTable).toContain('<w:tblW w:type="dxa" w:w="13958"/>');
    expect([...photoTable.matchAll(/<w:gridCol w:w="(\d+)"\/>/g)].map(([, w]) => Number(w))).toEqual([4653, 4653, 4652]);
  });

  it('写真は本体のあるものだけ、ラベル「部署名：項目の文」とコメントを付けて表のあとに出す', async () => {
    const blob = await buildFacilityDocxBlob(round(), { p1: PIXEL });
    const zip = await readZip(blob);
    expect(Object.keys(zip.files).filter((p) => p.startsWith('word/media/') && !zip.files[p].dir)).toHaveLength(1);
    const ps = paragraphs(await documentXml(blob));
    expect(ps.indexOf('写真')).toBeGreaterThan(ps.indexOf('総評'));
    expect(ps).toContain('A病棟：掲示がある');
    expect(ps).toContain('剥がれていた');
    expect(ps).not.toContain('B病棟：消毒剤がある');
  });

  it('節の見出しは次の段落と同じページに置く（写真の見出しだけがページの末尾に残らない）', async () => {
    const xml = await documentXml(await buildFacilityDocxBlob(round(), { p1: PIXEL }));
    const headings = [...xml.matchAll(/<w:p>(?:(?!<\/w:p>).)*?<\/w:p>/g)]
      .map(([p]) => p)
      .filter((p) => ['部署ごとのコメント', '総評', '写真'].some((t) => p.includes(`<w:t xml:space="preserve">${t}</w:t>`) || p.includes(`<w:t>${t}</w:t>`)));
    expect(headings).toHaveLength(3);
    for (const p of headings) expect(p).toContain('<w:keepNext/>');
  });

  it('写真が 1 枚も無ければ写真の見出しを出さない', async () => {
    const ps = paragraphs(await documentXml(await buildFacilityDocxBlob(round(), {})));
    expect(ps).not.toContain('写真');
  });

  it('ひな形の 11 部署は 1 つの表に収まる', async () => {
    const xml = await documentXml(await buildFacilityDocxBlob(round({ departments: departments(11), marks: {}, photos: [] }), {}));
    expect(tableCount(xml)).toBe(1);
  });

  it('部署が上限を超えるとグループの切れ目で表を分ける', async () => {
    const many = [...departments(10, '病棟', 'W'), ...departments(10, '外来', 'O')];
    const xml = await documentXml(await buildFacilityDocxBlob(round({ departments: many, marks: {}, photos: [] }), {}));
    expect(tableCount(xml)).toBe(2);
  });
});

describe('splitDepartments', () => {
  it('上限以内なら 1 つにまとめる', () => {
    const ds = departments(FACILITY_TABLE_DEPT_MAX);
    expect(splitDepartments(ds)).toEqual([ds]);
  });

  it('グループの途中では切らない', () => {
    const a = departments(3, '病棟', 'W');
    const b = departments(3, '外来', 'O');
    expect(splitDepartments([...a, ...b], 4)).toEqual([a, b]);
  });

  it('上限ちょうどまでは同じ表に入れる', () => {
    const a = departments(2, '病棟', 'W');
    const b = departments(2, '外来', 'O');
    expect(splitDepartments([...a, ...b], 4)).toEqual([[...a, ...b]]);
  });

  it('1 つのグループが上限を超えるときはそのグループの中で分ける', () => {
    const a = departments(5, '病棟', 'W');
    const b = departments(1, '外来', 'O');
    expect(splitDepartments([...a, ...b], 2)).toEqual([a.slice(0, 2), a.slice(2, 4), [a[4], b[0]]]);
  });

  it('部署が無ければ空', () => {
    expect(splitDepartments([])).toEqual([]);
  });

  it('上限は 11 部署以上', () => {
    expect(FACILITY_TABLE_DEPT_MAX).toBeGreaterThanOrEqual(11);
  });
});

describe('formatReportDateTime', () => {
  it('端末の時刻で yyyy/m/d H:mm にする（分は 2 桁）', () => {
    expect(formatReportDateTime(new Date(2026, 0, 5, 14, 30).toISOString())).toBe('2026/1/5 14:30');
    expect(formatReportDateTime(new Date(2026, 11, 31, 0, 0).toISOString())).toBe('2026/12/31 0:00');
  });

  it('日時として読めなければそのまま返す', () => {
    expect(formatReportDateTime('不明')).toBe('不明');
  });
});

describe('memberLines', () => {
  it('職種は最初に出た順で、名前を「、」でつなぐ', () => {
    expect(memberLines(round())).toEqual(['看護師：山田、佐藤', '医師：鈴木']);
  });
});

describe('facilityPhotoEntries', () => {
  it('部署の順、項目の順に並べ、写真の寸法とコメントを渡す', () => {
    const r = round({
      photos: [
        { id: 'b', department: 'B病棟', itemId: 'i1', comment: 'b', takenAt: 't' },
        { id: 'a3', department: 'A病棟', itemId: 'i3', comment: 'a3', takenAt: 't', width: 4, height: 3 },
        { id: 'a1', department: 'A病棟', itemId: 'i1', comment: 'a1', takenAt: 't' },
      ],
    });
    const entries = facilityPhotoEntries(r, { a1: PIXEL, a3: PIXEL, b: PIXEL });
    expect(entries.map((e) => e.label)).toEqual(['A病棟：消毒剤がある', 'A病棟：掲示がある', 'B病棟：消毒剤がある']);
    expect(entries[1].photo).toEqual({ id: 'a3', dataUrl: PIXEL, comment: 'a3', timestamp: 't', width: 4, height: 3 });
  });

  it('"__proto__" のような ID でも Object.prototype を本体と見なさない', () => {
    const r = round({ photos: [{ id: 'toString', department: 'A病棟', itemId: 'i1', comment: '', takenAt: 't' }] });
    expect(facilityPhotoEntries(r, {})).toEqual([]);
  });
});
