import { describe, it, expect } from 'vitest';
import { parseStoredRound } from '../facility/storedFacilityRound';

function stored() {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-18T01:02:03.000Z',
    themeName: '手指衛生',
    items: [{ id: 'h1', text: '消毒剤がある', targetGroups: ['病棟'], excludedDepartments: ['3階西'] }],
    departments: [{ name: '3階東', group: '病棟' }],
    members: [{ name: '山田', role: '看護師' }],
    marks: { '3階東': { h1: 'ng' } },
    departmentComments: { '3階東': '良好' },
    overallComment: '全体に良好',
    photos: [
      { id: 'p1', department: '3階東', itemId: 'h1', comment: '', takenAt: '2026-11-18T01:05:00.000Z', width: 640, height: 480 },
      { id: 'p2', department: '3階東', itemId: 'h1', comment: 'x', takenAt: '2026-11-18T01:06:00.000Z' },
    ],
  };
}

const photoPatch = (photo: Record<string, unknown>) => ({ photos: [{ ...stored().photos[1], ...photo }] });

describe('parseStoredRound', () => {
  it('正しい形ならそのまま読み戻す', () => {
    expect(parseStoredRound(stored())).toEqual(stored());
  });

  it('JSON を往復した値も読める', () => {
    expect(parseStoredRound(JSON.parse(JSON.stringify(stored())))).toEqual(stored());
  });

  it('空の配列・空のオブジェクト・空の文字列は正しい形として扱う', () => {
    const value = {
      ...stored(),
      items: [],
      members: [],
      marks: { '3階東': {} },
      departmentComments: {},
      overallComment: '',
      photos: [],
    };
    expect(parseStoredRound(value)).toEqual(value);
  });

  it('知らないフィールドは落とし、元の値とオブジェクトを共有しない', () => {
    const value = stored();
    const withExtra = {
      ...value,
      extra: 1,
      items: [{ ...value.items[0], extra: 1 }],
      departments: [{ ...value.departments[0], extra: 1 }],
      members: [{ ...value.members[0], extra: 1 }],
      photos: value.photos.map((p) => ({ ...p, extra: 1 })),
    };
    const parsed = parseStoredRound(withExtra);
    expect(parsed).toEqual(value);
    expect(parsed?.marks).not.toBe(value.marks);
    expect(parsed?.marks['3階東']).not.toBe(value.marks['3階東']);
    expect(parsed?.departmentComments).not.toBe(value.departmentComments);
    expect(parsed?.photos[0]).not.toBe(value.photos[0]);
  });

  it('width / height は数値のときだけ写す', () => {
    const parsed = parseStoredRound({ ...stored(), ...photoPatch({ width: '640', height: null }) });
    expect(parsed?.photos[0]).toEqual(stored().photos[1]);
    expect(parsed?.photos[0]).not.toHaveProperty('width');
    expect(parsed?.photos[0]).not.toHaveProperty('height');
  });

  it('"__proto__" という部署名もふつうのキーとして読み、プロトタイプを変えない', () => {
    const value = JSON.parse('{"__proto__": {"h1": "ok"}}');
    const parsed = parseStoredRound({ ...stored(), marks: value });
    expect(parsed).not.toBeNull();
    expect(Object.getPrototypeOf(parsed?.marks)).toBe(Object.prototype);
    expect(Object.hasOwn(parsed?.marks ?? {}, '__proto__')).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['文字列', '{}'],
    ['配列', [stored()]],
  ])('オブジェクトでない値（%s）は null', (_label, value) => {
    expect(parseStoredRound(value)).toBeNull();
  });

  it.each([
    ['version が無い', { version: undefined }],
    ['version が 2', { version: 2 }],
    ['version が文字列の 1', { version: '1' }],
    ['id が数値', { id: 1 }],
    ['startedAt が無い', { startedAt: undefined }],
    ['themeName が null', { themeName: null }],
    ['overallComment が無い', { overallComment: undefined }],
    ['items が配列でない', { items: {} }],
    ['項目の id が無い', { items: [{ text: '床', targetGroups: [], excludedDepartments: [] }] }],
    ['departments が無い', { departments: undefined }],
    ['部署のグループが無い', { departments: [{ name: '3階東' }] }],
    ['members が文字列', { members: '山田' }],
    ['参加者の職種が無い', { members: [{ name: '山田' }] }],
    ['marks が配列', { marks: [] }],
    ['marks が null', { marks: null }],
    ['部署の marks が配列', { marks: { '3階東': [] } }],
    ['部署の marks が文字列', { marks: { '3階東': 'ok' } }],
    ['印が ok / ng 以外', { marks: { '3階東': { h1: 'na' } } }],
    ['印が数値', { marks: { '3階東': { h1: 1 } } }],
    ['departmentComments が無い', { departmentComments: undefined }],
    ['部署のコメントが数値', { departmentComments: { '3階東': 1 } }],
    ['photos が無い', { photos: undefined }],
    ['写真が null', { photos: [null] }],
    ['写真の id が無い', photoPatch({ id: undefined })],
    ['写真の department が数値', photoPatch({ department: 1 })],
    ['写真の itemId が無い', photoPatch({ itemId: undefined })],
    ['写真の comment が null', photoPatch({ comment: null })],
    ['写真の takenAt が無い', photoPatch({ takenAt: undefined })],
  ])('%s なら null', (_label, patch) => {
    expect(parseStoredRound({ ...stored(), ...patch })).toBeNull();
  });

  it('壊れた要素が後ろの方にあっても null', () => {
    const value = stored();
    expect(parseStoredRound({ ...value, photos: [...value.photos, { id: 'p3' }] })).toBeNull();
    expect(parseStoredRound({ ...value, marks: { ...value.marks, '3階西': { h1: 'x' } }})).toBeNull();
  });
});
