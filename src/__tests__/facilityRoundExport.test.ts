import { describe, it, expect } from 'vitest';
import type { FacilityRound } from '../facility/facilityRound';
import { buildFacilityRoundExport, parseFacilityRoundExport } from '../facility/facilityRoundExport';

function round(): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-18T01:02:03.000Z',
    themeName: '手指衛生',
    items: [{ id: 'h1', text: '消毒剤がある', targetGroups: [], excludedDepartments: [] }],
    departments: [{ name: '3階東', group: '病棟' }],
    members: [{ name: '山田', role: '看護師' }],
    marks: { '3階東': { h1: 'ng' } },
    departmentComments: { '3階東': '良好' },
    overallComment: '全体に良好',
    photos: [
      { id: 'p1', department: '3階東', itemId: 'h1', comment: '', takenAt: '2026-11-18T01:05:00.000Z' },
      { id: 'p2', department: '3階東', itemId: 'h1', comment: 'x', takenAt: '2026-11-18T01:06:00.000Z' },
    ],
  };
}

const NOW = new Date('2026-11-18T09:00:00.000Z');
const IMG1 = 'data:image/jpeg;base64,AAA';
const IMG2 = 'data:image/jpeg;base64,BBB';

function exported(patch: Record<string, unknown> = {}) {
  return { ...buildFacilityRoundExport(round(), { p1: IMG1, p2: IMG2 }, NOW), ...patch };
}

const text = (value: unknown) => JSON.stringify(value);

describe('buildFacilityRoundExport', () => {
  it('形式・版・書き出した時刻・ラウンドを入れる', () => {
    const e = buildFacilityRoundExport(round(), { p1: IMG1, p2: IMG2 }, NOW);
    expect(e.format).toBe('meguru-facility-round');
    expect(e.version).toBe(1);
    expect(e.exportedAt).toBe('2026-11-18T09:00:00.000Z');
    expect(e.round).toEqual(round());
  });

  it('写真は round.photos の順に入れる（本体の並びに依らない）', () => {
    const e = buildFacilityRoundExport(round(), { p2: IMG2, p1: IMG1 }, NOW);
    expect(e.photos).toEqual([
      { id: 'p1', dataUrl: IMG1 },
      { id: 'p2', dataUrl: IMG2 },
    ]);
  });

  it('本体の無い写真は入れず、参照の無い本体も入れない', () => {
    const e = buildFacilityRoundExport(round(), { p2: IMG2, other: IMG1 }, NOW);
    expect(e.photos).toEqual([{ id: 'p2', dataUrl: IMG2 }]);
  });

  it('写真が無ければ空', () => {
    expect(buildFacilityRoundExport({ ...round(), photos: [] }, { p1: IMG1 }, NOW).photos).toEqual([]);
  });

  it('"__proto__" のような ID でも Object.prototype を読まない', () => {
    const r = { ...round(), photos: [{ ...round().photos[0], id: 'toString' }] };
    expect(buildFacilityRoundExport(r, {}, NOW).photos).toEqual([]);
  });
});

describe('parseFacilityRoundExport', () => {
  it('書き出したものを読み戻せる', () => {
    expect(parseFacilityRoundExport(text(exported()))).toEqual(exported());
  });

  it('知らない欄は落とす', () => {
    expect(parseFacilityRoundExport(text(exported({ extra: 1 })))).toEqual(exported());
  });

  it('JSON でなければ null', () => {
    expect(parseFacilityRoundExport('{')).toBeNull();
    expect(parseFacilityRoundExport('')).toBeNull();
  });

  it('オブジェクトでなければ null', () => {
    expect(parseFacilityRoundExport('null')).toBeNull();
    expect(parseFacilityRoundExport('[]')).toBeNull();
    expect(parseFacilityRoundExport('"x"')).toBeNull();
  });

  it('format 違いは null', () => {
    expect(parseFacilityRoundExport(text(exported({ format: 'meguru-round' })))).toBeNull();
    expect(parseFacilityRoundExport(text(exported({ format: undefined })))).toBeNull();
  });

  it('version 2 や文字の "1" は null', () => {
    expect(parseFacilityRoundExport(text(exported({ version: 2 })))).toBeNull();
    expect(parseFacilityRoundExport(text(exported({ version: '1' })))).toBeNull();
  });

  it('exportedAt が文字列でなければ null', () => {
    expect(parseFacilityRoundExport(text(exported({ exportedAt: 1 })))).toBeNull();
  });

  it('round が壊れていれば null', () => {
    expect(parseFacilityRoundExport(text(exported({ round: { ...round(), version: 2 } })))).toBeNull();
    expect(parseFacilityRoundExport(text(exported({ round: undefined })))).toBeNull();
  });

  it('photos の形が違えば null', () => {
    expect(parseFacilityRoundExport(text(exported({ photos: {} })))).toBeNull();
    expect(parseFacilityRoundExport(text(exported({ photos: [null] })))).toBeNull();
    expect(parseFacilityRoundExport(text(exported({ photos: [{ id: 1, dataUrl: IMG1 }] })))).toBeNull();
    expect(parseFacilityRoundExport(text(exported({ photos: [{ id: 'p1' }] })))).toBeNull();
  });

  it('画像でない data URL は null', () => {
    expect(parseFacilityRoundExport(text(exported({ photos: [{ id: 'p1', dataUrl: 'data:text/html,x' }] })))).toBeNull();
    expect(parseFacilityRoundExport(text(exported({ photos: [{ id: 'p1', dataUrl: 'https://example.com/a.jpg' }] })))).toBeNull();
  });

  it('写真の本体が欠けていても読める（参照は残る）', () => {
    const parsed = parseFacilityRoundExport(text(exported({ photos: [{ id: 'p2', dataUrl: IMG2 }] })));
    expect(parsed?.photos).toEqual([{ id: 'p2', dataUrl: IMG2 }]);
    expect(parsed?.round.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('参照の無い本体は捨てる', () => {
    const photos = [
      { id: 'p1', dataUrl: IMG1 },
      { id: 'orphan', dataUrl: IMG2 },
    ];
    expect(parseFacilityRoundExport(text(exported({ photos })))?.photos).toEqual([{ id: 'p1', dataUrl: IMG1 }]);
  });

  it('"__proto__" の欄は ordinary な欄として扱い、プロトタイプを汚さない', () => {
    const json = text(exported()).replace('"marks":{', '"marks":{"__proto__":{"h1":"ok"},');
    const parsed = parseFacilityRoundExport(json);
    expect(parsed && Object.hasOwn(parsed.round.marks, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).h1).toBeUndefined();
  });

  it('本体に余計な欄があっても id と dataUrl だけ残す', () => {
    const photos = [{ id: 'p1', dataUrl: IMG1, extra: 1 }];
    expect(parseFacilityRoundExport(text(exported({ photos })))?.photos).toEqual([{ id: 'p1', dataUrl: IMG1 }]);
  });
});
