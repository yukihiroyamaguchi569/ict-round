import { describe, it, expect } from 'vitest';
import { markOf, type FacilityRound, type RoundPhotoRef } from '../facility/facilityRound';
import { mergeFacilityRounds, type MergeResult } from '../facility/mergeFacilityRounds';
import { parseStoredRound } from '../facility/storedFacilityRound';

/** This device's round: item ids a*, two ward departments. */
function baseRound(patch: Partial<FacilityRound> = {}): FacilityRound {
  return {
    version: 1,
    id: 'round-a',
    startedAt: '2026-11-18T01:00:00.000Z',
    themeName: '手指衛生',
    items: [
      { id: 'a1', text: '消毒剤がある', targetGroups: [], excludedDepartments: [] },
      { id: 'a2', text: '手順の掲示', targetGroups: [], excludedDepartments: ['3階西'] },
      { id: 'a3', text: '外来の掲示', targetGroups: ['外来'], excludedDepartments: [] },
    ],
    departments: [
      { name: '3階東', group: '病棟' },
      { name: '3階西', group: '病棟' },
    ],
    members: [{ name: '山田', role: '看護師' }],
    marks: {},
    departmentComments: {},
    overallComment: '',
    photos: [],
    ...patch,
  };
}

/** The other device's round: same texts under other ids (b*), plus one item missing here. */
function incomingRound(patch: Partial<FacilityRound> = {}): FacilityRound {
  return {
    version: 1,
    id: 'round-b',
    startedAt: '2026-11-18T03:00:00.000Z',
    themeName: '手指衛生',
    items: [
      { id: 'b2', text: '手順の掲示', targetGroups: [], excludedDepartments: [] },
      { id: 'b1', text: '消毒剤がある', targetGroups: [], excludedDepartments: [] },
      { id: 'b3', text: 'ゴミ箱のふた', targetGroups: [], excludedDepartments: [] },
      { id: 'b4', text: '外来の掲示', targetGroups: ['外来'], excludedDepartments: [] },
    ],
    departments: [
      { name: '3階東', group: '病棟' },
      { name: '内科外来', group: '外来' },
    ],
    members: [{ name: '山田', role: '看護師' }],
    marks: {},
    departmentComments: {},
    overallComment: '',
    photos: [],
    ...patch,
  };
}

function photo(patch: Partial<RoundPhotoRef> = {}): RoundPhotoRef {
  return { id: 'p1', department: '3階東', itemId: 'b1', comment: '空', takenAt: '2026-11-18T03:10:00.000Z', ...patch };
}

function merged(result: MergeResult) {
  if (!result.ok) throw new Error(`merge failed: ${result.reason}`);
  return result;
}

describe('mergeFacilityRounds', () => {
  it('refuses a round of another theme and changes nothing', () => {
    const base = baseRound();
    const before = structuredClone(base);
    expect(mergeFacilityRounds(base, incomingRound({ themeName: '環境' }))).toEqual({
      ok: false,
      reason: 'theme-mismatch',
    });
    expect(base).toEqual(before);
  });

  it('takes a mark found on one side only, moved onto this round item ids', () => {
    const base = baseRound({ marks: { '3階東': { a2: 'ok' } } });
    const incoming = incomingRound({ marks: { '3階東': { b1: 'ng' } } });
    const { round, report } = merged(mergeFacilityRounds(base, incoming));
    expect(round.marks['3階東']).toEqual({ a2: 'ok', a1: 'ng' });
    expect(report.conflicts).toEqual([]);
  });

  it('keeps the same mark on both sides without a conflict', () => {
    const base = baseRound({ marks: { '3階東': { a1: 'ok' } } });
    const { round, report } = merged(mergeFacilityRounds(base, incomingRound({ marks: { '3階東': { b1: 'ok' } } })));
    expect(round.marks['3階東']).toEqual({ a1: 'ok' });
    expect(report.conflicts).toEqual([]);
  });

  it.each([
    ['ok', 'ng'],
    ['ng', 'ok'],
  ] as const)('takes × when this round has %s and the other %s, and reports the cell', (mine, theirs) => {
    const base = baseRound({ marks: { '3階東': { a1: mine } } });
    const { round, report } = merged(mergeFacilityRounds(base, incomingRound({ marks: { '3階東': { b1: theirs } } })));
    expect(round.marks['3階東']).toEqual({ a1: 'ng' });
    expect(report.conflicts).toEqual([{ department: '3階東', itemText: '消毒剤がある' }]);
  });

  it('adds departments only the other device visited, at the end in its order with its group', () => {
    const incoming = incomingRound({
      departments: [
        { name: '検査室', group: '検査' },
        { name: '3階東', group: '別' },
        { name: '内科外来', group: '外来' },
      ],
      marks: { 内科外来: { b4: 'ok' } },
    });
    const { round, report } = merged(mergeFacilityRounds(baseRound(), incoming));
    expect(round.departments).toEqual([
      { name: '3階東', group: '病棟' },
      { name: '3階西', group: '病棟' },
      { name: '検査室', group: '検査' },
      { name: '内科外来', group: '外来' },
    ]);
    expect(report.addedDepartments).toEqual(['検査室', '内科外来']);
    expect(round.marks['内科外来']).toEqual({ a3: 'ok' });
  });

  it('leaves out marks and photos of items missing here and lists each text once', () => {
    const incoming = incomingRound({
      marks: { '3階東': { b3: 'ng' }, 内科外来: { b3: 'ng' } },
      photos: [photo({ id: 'p9', itemId: 'b3' })],
    });
    const { round, newPhotoIds, report } = merged(mergeFacilityRounds(baseRound(), incoming));
    expect(round.marks).toEqual({});
    expect(round.photos).toEqual([]);
    expect(newPhotoIds).toEqual([]);
    expect(report.unknownItems).toEqual(['ゴミ箱のふた']);
  });

  it('does not list items missing here that carry no mark or photo', () => {
    const { report } = merged(mergeFacilityRounds(baseRound(), incomingRound()));
    expect(report.unknownItems).toEqual([]);
  });

  it('leaves out cells that do not apply here, and counts them', () => {
    // 手順の掲示 excludes 3階西 here but not on the other device; 外来の掲示 applies only to 外来 here.
    const incoming = incomingRound({
      departments: [{ name: '3階西', group: '病棟' }],
      items: [
        { id: 'b2', text: '手順の掲示', targetGroups: [], excludedDepartments: [] },
        { id: 'b4', text: '外来の掲示', targetGroups: [], excludedDepartments: [] },
      ],
      marks: { '3階西': { b2: 'ng', b4: 'ok' } },
      photos: [photo({ department: '3階西', itemId: 'b2' })],
    });
    const { round, newPhotoIds, report } = merged(mergeFacilityRounds(baseRound(), incoming));
    expect(round.marks).toEqual({});
    expect(newPhotoIds).toEqual([]);
    expect(report.notApplicableCells).toBe(2);
  });

  it('does not take marks the other device left on cells it did not show', () => {
    const incoming = incomingRound({ marks: { '3階東': { b4: 'ng' } } });
    const { round, report } = merged(mergeFacilityRounds(baseRound(), incoming));
    expect(round.marks).toEqual({});
    expect(report.notApplicableCells).toBe(0);
  });

  it('ignores marks and photos of departments or items the other round does not hold', () => {
    const incoming = incomingRound({
      marks: { 検査室: { b1: 'ng' }, '3階東': { zz: 'ng' } },
      photos: [photo({ id: 'p1', department: '検査室' }), photo({ id: 'p2', itemId: 'zz' })],
    });
    const { round, newPhotoIds, report } = merged(mergeFacilityRounds(baseRound(), incoming));
    expect(round.marks).toEqual({});
    expect(newPhotoIds).toEqual([]);
    expect(report).toMatchObject({ unknownItems: [], notApplicableCells: 0, addedPhotos: 0 });
  });

  it('adds new photos on this round item ids and marks their cells ×', () => {
    const incoming = incomingRound({
      marks: { '3階東': { b1: 'ng' } },
      photos: [photo({ id: 'p1', width: 640, height: 480 })],
    });
    const { round, newPhotoIds, report } = merged(mergeFacilityRounds(baseRound(), incoming));
    expect(round.photos).toEqual([{ ...photo({ id: 'p1', width: 640, height: 480 }), itemId: 'a1' }]);
    expect(round.marks['3階東']).toEqual({ a1: 'ng' });
    expect(newPhotoIds).toEqual(['p1']);
    expect(report.addedPhotos).toBe(1);
  });

  it('does not add a photo whose id is already here, nor the same id twice', () => {
    const existing = { ...photo({ id: 'p1' }), itemId: 'a1' };
    const base = baseRound({ marks: { '3階東': { a1: 'ng' } }, photos: [existing] });
    const incoming = incomingRound({
      marks: { '3階東': { b1: 'ng', b2: 'ng' } },
      photos: [photo({ id: 'p1' }), photo({ id: 'p2', itemId: 'b2' }), photo({ id: 'p2', itemId: 'b2' })],
    });
    const { round, newPhotoIds, report } = merged(mergeFacilityRounds(base, incoming));
    expect(round.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(newPhotoIds).toEqual(['p2']);
    expect(report.addedPhotos).toBe(1);
  });

  it('takes × when the other device has a photo on a cell marked ○ here, reporting the cell once', () => {
    const base = baseRound({ marks: { '3階東': { a1: 'ok' } } });
    const incoming = incomingRound({
      marks: { '3階東': { b1: 'ng' } },
      photos: [photo({ id: 'p1' }), photo({ id: 'p2' })],
    });
    const { round, report } = merged(mergeFacilityRounds(base, incoming));
    expect(round.marks['3階東']).toEqual({ a1: 'ng' });
    expect(report.conflicts).toEqual([{ department: '3階東', itemText: '消毒剤がある' }]);
    expect(round.photos).toHaveLength(2);
  });

  it('marks × the cell of a photo even when the other device has no mark on it', () => {
    const base = baseRound({ marks: { '3階東': { a1: 'ok' } } });
    const { round, report } = merged(mergeFacilityRounds(base, incomingRound({ photos: [photo()] })));
    expect(round.marks['3階東']).toEqual({ a1: 'ng' });
    expect(report.conflicts).toHaveLength(1);
  });

  it('marks × the cell of a photo when neither side has a mark on it', () => {
    const { round, report } = merged(mergeFacilityRounds(baseRound(), incomingRound({ photos: [photo()] })));
    expect(round.marks['3階東']).toEqual({ a1: 'ng' });
    expect(report.conflicts).toEqual([]);
  });

  it('ignores a photo of a department here that the other round does not hold', () => {
    const incoming = incomingRound({ photos: [photo({ department: '3階西' })] });
    const { round, newPhotoIds } = merged(mergeFacilityRounds(baseRound(), incoming));
    expect(round.marks).toEqual({});
    expect(newPhotoIds).toEqual([]);
  });

  it('reports every conflicting cell', () => {
    const base = baseRound({ marks: { '3階東': { a1: 'ok', a2: 'ng' } } });
    const incoming = incomingRound({ marks: { '3階東': { b1: 'ng', b2: 'ok' } } });
    expect(merged(mergeFacilityRounds(base, incoming)).report.conflicts).toEqual([
      { department: '3階東', itemText: '手順の掲示' },
      { department: '3階東', itemText: '消毒剤がある' },
    ]);
  });

  it('gives the same round when the same round is merged twice', () => {
    const incoming = incomingRound({
      departments: [...incomingRound().departments, { name: '検査室', group: '検査' }],
      members: [{ name: '佐藤', role: '医師' }],
      marks: { '3階東': { b1: 'ng', b2: 'ok' }, 内科外来: { b4: 'ok' } },
      departmentComments: { '3階東': '向こうの所見', 内科外来: '良好' },
      overallComment: '全体に良い\n二行目',
      photos: [photo()],
    });
    const base = baseRound({
      marks: { '3階東': { a1: 'ok' } },
      departmentComments: { '3階東': 'こちらの所見' },
      overallComment: 'こちらの総評',
    });
    const once = merged(mergeFacilityRounds(base, incoming));
    const twice = merged(mergeFacilityRounds(once.round, incoming));
    expect(twice.round).toEqual(once.round);
    expect(twice.newPhotoIds).toEqual([]);
    expect(twice.report).toMatchObject({ addedDepartments: [], conflicts: [], addedPhotos: 0 });
  });

  it('returns a round that reads back through parseStoredRound unchanged', () => {
    const incoming = incomingRound({
      marks: { '3階東': { b1: 'ng' }, 内科外来: { b4: 'ok' } },
      departmentComments: { 内科外来: '良好' },
      photos: [photo()],
    });
    const { round } = merged(mergeFacilityRounds(baseRound(), incoming));
    expect(parseStoredRound(structuredClone(round))).toEqual(round);
  });

  it('keeps this round id, start, theme and items', () => {
    const base = baseRound();
    const { round } = merged(mergeFacilityRounds(base, incomingRound()));
    expect(round).toMatchObject({ id: 'round-a', startedAt: base.startedAt, themeName: '手指衛生' });
    expect(round.items).toEqual(base.items);
  });

  it('does not change either input', () => {
    const base = baseRound({ marks: { '3階東': { a1: 'ok' } }, departmentComments: { '3階東': 'x' } });
    const incoming = incomingRound({
      marks: { '3階東': { b1: 'ng' } },
      departmentComments: { '3階東': 'y' },
      members: [{ name: '佐藤', role: '医師' }],
      photos: [photo()],
    });
    const [baseBefore, incomingBefore] = [structuredClone(base), structuredClone(incoming)];
    const { round } = merged(mergeFacilityRounds(base, incoming));
    round.items[0].targetGroups.push('x');
    round.departments[0].group = 'x';
    round.members[0].name = 'x';
    round.photos[0].comment = 'x';
    round.marks['3階東'].a1 = 'ok';
    expect(base).toEqual(baseBefore);
    expect(incoming).toEqual(incomingBefore);
  });

  it.each([
    ['2026-11-18T01:00:00', '2026-11-18T23:00:00', false],
    ['2026-11-18T23:00:00', '2026-11-19T00:30:00', true],
  ])('reports whether %s and %s fall on different local days', (a, b, expected) => {
    // Without a zone suffix the strings are read as device-local time, matching the local-date rule.
    const base = baseRound({ startedAt: new Date(a).toISOString() });
    const incoming = incomingRound({ startedAt: new Date(b).toISOString() });
    expect(merged(mergeFacilityRounds(base, incoming)).report.differentDay).toBe(expected);
  });

  describe('comments', () => {
    function mergeComments(mine: string, theirs: string) {
      const base = baseRound({ departmentComments: mine ? { '3階東': mine } : {}, overallComment: mine });
      const incoming = incomingRound({ departmentComments: theirs ? { '3階東': theirs } : {}, overallComment: theirs });
      const { round } = merged(mergeFacilityRounds(base, incoming));
      return { department: round.departmentComments['3階東'], overall: round.overallComment };
    }

    it.each([
      ['mine only', 'こちら', '', 'こちら'],
      ['theirs only', '', 'むこう', 'むこう'],
      ['the same', '同じ', '同じ', '同じ'],
      ['the same but for spaces', '同じ', ' 同じ\n', '同じ'],
      ['mine with spaces, the same', ' 同じ ', '同じ', ' 同じ '],
      ['mine only spaces', '  ', 'むこう', 'むこう'],
      ['different', 'こちら', 'むこう', 'こちら\nむこう'],
      ['theirs already inside mine', 'こちら\nむこう', 'むこう', 'こちら\nむこう'],
      ['mine already inside theirs', 'こちら', 'むこう\nこちら', 'むこう\nこちら'],
      ['a part of a line is not the same', 'こちらの所見', 'こちら', 'こちらの所見\nこちら'],
    ])('%s', (_label, mine, theirs, expected) => {
      expect(mergeComments(mine, theirs)).toEqual({ department: expected, overall: expected });
    });

    it('keeps comments of departments the other round lacks, adds comments of added departments, drops empty ones', () => {
      const base = baseRound({ departmentComments: { '3階西': 'こちら' } });
      const incoming = incomingRound({ departmentComments: { 内科外来: '外来の所見', '3階東': '  ', 検査室: '無関係' } });
      const { round } = merged(mergeFacilityRounds(base, incoming));
      expect(round.departmentComments).toEqual({ '3階西': 'こちら', 内科外来: '外来の所見' });
    });
  });

  it('joins members, the same name and role being one person, mine first', () => {
    const base = baseRound({
      members: [
        { name: '山田', role: '看護師' },
        { name: '鈴木', role: '薬剤師' },
      ],
    });
    const incoming = incomingRound({
      members: [
        { name: '佐藤', role: '医師' },
        { name: '山田', role: '看護師' },
        { name: '鈴木', role: '検査技師' },
        { name: '佐藤', role: '医師' },
      ],
    });
    expect(merged(mergeFacilityRounds(base, incoming)).round.members).toEqual([
      { name: '山田', role: '看護師' },
      { name: '鈴木', role: '薬剤師' },
      { name: '佐藤', role: '医師' },
      { name: '鈴木', role: '検査技師' },
    ]);
  });

  it('keeps an item id "__proto__" here as an own key when a mark moves onto it', () => {
    const base = baseRound({ items: [{ id: '__proto__', text: '消毒剤がある', targetGroups: [], excludedDepartments: [] }] });
    const { round } = merged(mergeFacilityRounds(base, incomingRound({ marks: { '3階東': { b1: 'ng' } } })));
    expect(Object.hasOwn(round.marks['3階東'], '__proto__')).toBe(true);
    expect(markOf(round, '3階東', '__proto__')).toBe('ng');
    expect(parseStoredRound(structuredClone(round))).toEqual(round);
  });

  it('keeps a department or item named "__proto__" as an own key', () => {
    const base = baseRound({ departments: [{ name: '__proto__', group: '病棟' }] });
    const incoming = incomingRound({
      departments: [{ name: '__proto__', group: '病棟' }],
      // A computed key defines an own property, as a round read back from storage has it.
      marks: { ['__proto__']: { b1: 'ng' } },
    });
    const { round } = merged(mergeFacilityRounds(base, incoming));
    expect(Object.hasOwn(round.marks, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(round.marks)).toBe(Object.prototype);
  });
});
