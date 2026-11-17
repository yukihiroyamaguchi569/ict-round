import { describe, it, expect } from 'vitest';
import {
  addPhotoRef,
  applicableItems,
  createFacilityRound,
  departmentProgress,
  hasPhotos,
  isApplicable,
  removePhotoRef,
  roundProgress,
  setDepartmentComment,
  setMark,
  setMembers,
  setOverallComment,
  type CreateRoundInput,
  type FacilityRound,
  type RoundPhotoRef,
} from '../facility/facilityRound';
import type { FacilitySettings, ThemeItem } from '../facility/facilitySettings';

function settings(): FacilitySettings {
  return {
    version: 1,
    groups: [
      { name: '病棟', visit: 'always' },
      { name: '外来', visit: 'select' },
      { name: '検査', visit: 'select' },
    ],
    departments: [
      { name: '内科外来', group: '外来' },
      { name: '3階東', group: '病棟' },
      { name: '検査室', group: '検査' },
      { name: '3階西', group: '病棟' },
    ],
    themes: [
      {
        name: '手指衛生',
        items: [
          { id: 'h1', text: '消毒剤がある', targetGroups: [], excludedDepartments: [] },
          { id: 'h2', text: '手順の掲示', targetGroups: ['外来'], excludedDepartments: [] },
          { id: 'h3', text: '床が清潔', targetGroups: ['病棟'], excludedDepartments: ['3階西'] },
        ],
      },
      { name: '環境', items: [{ id: 'e1', text: '棚', targetGroups: [], excludedDepartments: [] }] },
    ],
    members: [{ name: '山田', role: '看護師' }],
  };
}

function input(patch: Partial<CreateRoundInput> = {}): CreateRoundInput {
  return {
    settings: settings(),
    themeName: '手指衛生',
    selectedGroups: ['外来'],
    members: [{ name: '山田', role: '看護師' }],
    startedAt: new Date('2026-11-18T01:02:03.000Z'),
    id: 'r1',
    ...patch,
  };
}

function round(patch: Partial<CreateRoundInput> = {}): FacilityRound {
  const r = createFacilityRound(input(patch));
  if (!r) throw new Error('round expected');
  return r;
}

function photo(patch: Partial<RoundPhotoRef> = {}): RoundPhotoRef {
  return { id: 'p1', department: '3階東', itemId: 'h1', comment: '', takenAt: '2026-11-18T01:05:00.000Z', ...patch };
}

const names = (r: FacilityRound) => r.departments.map((d) => d.name);

function item(targetGroups: string[], excludedDepartments: string[]): ThemeItem {
  return { id: 'x', text: 'x', targetGroups, excludedDepartments };
}

describe('isApplicable', () => {
  const ward = { name: '3階東', group: '病棟' };
  it.each([
    ['対象グループが空なら全部署', [], [], true],
    ['対象グループに部署のグループがある', ['病棟'], [], true],
    ['対象グループが複数で、その中にある', ['外来', '病棟'], [], true],
    ['対象グループに部署のグループが無い', ['外来'], [], false],
    ['対象グループが空でも、除外にあれば対象外', [], ['3階東'], false],
    ['対象グループにあっても、除外にあれば対象外', ['病棟'], ['3階東'], false],
    ['除外にほかの部署だけがある', ['病棟'], ['3階西'], true],
    ['対象でないグループの部署を除外に書いても、対象外のまま', ['外来'], ['3階東'], false],
  ])('%s', (_label, targetGroups, excluded, expected) => {
    expect(isApplicable(item(targetGroups, excluded), ward)).toBe(expected);
  });
});

describe('createFacilityRound', () => {
  it('始めた時点の設定の写しと空の結果を持つ', () => {
    const s = settings();
    const r = createFacilityRound(input({ settings: s }));
    expect(r).toEqual({
      version: 1,
      id: 'r1',
      startedAt: '2026-11-18T01:02:03.000Z',
      themeName: '手指衛生',
      items: s.themes[0].items,
      departments: [
        { name: '内科外来', group: '外来' },
        { name: '3階東', group: '病棟' },
        { name: '3階西', group: '病棟' },
      ],
      members: [{ name: '山田', role: '看護師' }],
      marks: {},
      departmentComments: {},
      overallComment: '',
      photos: [],
    });
  });

  it('設定と入力を共有しない（あとで設定を変えてもラウンドは変わらない）', () => {
    const s = settings();
    const members = [{ name: '山田', role: '看護師' }];
    const r = round({ settings: s, members });
    s.themes[0].items[1].targetGroups.push('病棟');
    s.themes[0].items[0].text = '変更';
    s.departments[1].group = '外来';
    members[0].name = '佐藤';
    expect(r.items[1].targetGroups).toEqual(['外来']);
    expect(r.items[0].text).toBe('消毒剤がある');
    expect(r.departments[1].group).toBe('病棟');
    expect(r.members[0].name).toBe('山田');
  });

  it.each([
    ['always だけ（select を選ばない）', [], ['3階東', '3階西']],
    ['select を 1 つ', ['検査'], ['3階東', '検査室', '3階西']],
    ['select を複数（並びは設定の部署の順）', ['検査', '外来'], ['内科外来', '3階東', '検査室', '3階西']],
    ['always のグループを選んでも変わらない', ['病棟'], ['3階東', '3階西']],
    ['存在しないグループは無視する', ['手術室'], ['3階東', '3階西']],
  ])('部署の選び方: %s', (_label, selectedGroups, expected) => {
    expect(names(round({ selectedGroups }))).toEqual(expected);
  });

  it('テーマが無ければ null', () => {
    expect(createFacilityRound(input({ themeName: '無いテーマ' }))).toBeNull();
  });

  it('回る部署が 0 なら null', () => {
    const s = settings();
    s.groups = s.groups.map((g) => ({ ...g, visit: 'select' as const }));
    expect(createFacilityRound(input({ settings: s, selectedGroups: [] }))).toBeNull();
  });

  it('グループの表に無いグループの部署は回らない', () => {
    const s = settings();
    s.departments.push({ name: '謎', group: '不明' });
    expect(names(round({ settings: s, selectedGroups: ['不明'] }))).not.toContain('謎');
  });
});

describe('applicableItems', () => {
  const ids = (items: ThemeItem[]) => items.map((i) => i.id);
  it('部署ごとに当てはまる項目を、項目の順で返す', () => {
    const r = round();
    expect(ids(applicableItems(r, '内科外来'))).toEqual(['h1', 'h2']);
    expect(ids(applicableItems(r, '3階東'))).toEqual(['h1', 'h3']);
    expect(ids(applicableItems(r, '3階西'))).toEqual(['h1']);
  });

  it('ラウンドに無い部署は []', () => {
    expect(applicableItems(round(), '検査室')).toEqual([]);
  });
});

describe('setMark', () => {
  it('付ける・変える・同じ印でもう一度で消える', () => {
    const r0 = round();
    const r1 = setMark(r0, '3階東', 'h1', 'ok');
    expect(r1.marks).toEqual({ '3階東': { h1: 'ok' } });
    const r2 = setMark(r1, '3階東', 'h1', 'ng');
    expect(r2.marks).toEqual({ '3階東': { h1: 'ng' } });
    const r3 = setMark(r2, '3階東', 'h1', 'ng');
    expect(r3.marks).toEqual({ '3階東': {} });
    expect(r0.marks).toEqual({});
    expect(r1.marks).toEqual({ '3階東': { h1: 'ok' } });
  });

  it('ほかのマス・ほかの部署の印を残す', () => {
    let r = setMark(round(), '3階東', 'h1', 'ok');
    r = setMark(r, '3階東', 'h3', 'ng');
    r = setMark(r, '内科外来', 'h2', 'ok');
    expect(r.marks).toEqual({ '3階東': { h1: 'ok', h3: 'ng' }, 内科外来: { h2: 'ok' } });
  });

  it.each([
    ['対象外のマス', '3階西', 'h3'],
    ['対象グループ外のマス', '3階東', 'h2'],
    ['ラウンドに無い部署', '検査室', 'h1'],
    ['無い項目', '3階東', 'zz'],
  ])('%s は無視する（同じオブジェクトを返す）', (_label, department, itemId) => {
    const r = round();
    expect(setMark(r, department, itemId, 'ok')).toBe(r);
  });

  it('部署名が "__proto__" でも Object.prototype を読まない', () => {
    const r = round();
    expect(setMark(r, '__proto__', 'h1', 'ok')).toBe(r);
    expect(departmentProgress(r, '__proto__')).toEqual({ marked: 0, total: 0 });
  });

  it('写真のある × のマスは、消すことも ○ に変えることもできない', () => {
    const withPhoto = addPhotoRef(setMark(round(), '3階東', 'h1', 'ng'), photo());
    expect(setMark(withPhoto, '3階東', 'h1', 'ng')).toBe(withPhoto);
    expect(setMark(withPhoto, '3階東', 'h1', 'ok')).toBe(withPhoto);
  });

  it('写真を消したあとは変えられる', () => {
    const withPhoto = addPhotoRef(setMark(round(), '3階東', 'h1', 'ng'), photo());
    const r = removePhotoRef(withPhoto, 'p1');
    expect(setMark(r, '3階東', 'h1', 'ok').marks['3階東']).toEqual({ h1: 'ok' });
  });
});

describe('写真の参照', () => {
  const ngRound = () => setMark(round(), '3階東', 'h1', 'ng');

  it('× のマスには足せる', () => {
    const r = addPhotoRef(ngRound(), photo({ width: 10, height: 20 }));
    expect(r.photos).toEqual([photo({ width: 10, height: 20 })]);
    expect(hasPhotos(r, '3階東', 'h1')).toBe(true);
  });

  it('同じマスに 2 枚目も足せる', () => {
    const r = addPhotoRef(addPhotoRef(ngRound(), photo()), photo({ id: 'p2' }));
    expect(r.photos.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  // Rounds are built inside the test, not at collection time, so mutation testing sees them.
  it.each([
    ['○ のマス', () => setMark(round(), '3階東', 'h1', 'ok')],
    ['確認なしのマス', () => round()],
  ])('%s には足さない', (_label, build) => {
    const r = build();
    expect(addPhotoRef(r, photo())).toBe(r);
  });

  it('保存データの不整合で対象外のマスに × があっても足さない', () => {
    const r = { ...round(), marks: { '3階西': { h3: 'ng' as const }, 検査室: { h1: 'ng' as const } } };
    expect(addPhotoRef(r, photo({ department: '3階西', itemId: 'h3' }))).toBe(r);
    expect(addPhotoRef(r, photo({ department: '検査室' }))).toBe(r);
  });

  it('ほかの部署の × には付かない（部署とマスの組で判定する）', () => {
    const r = ngRound();
    expect(addPhotoRef(r, photo({ department: '内科外来' }))).toBe(r);
    expect(addPhotoRef(r, photo({ itemId: 'h3' }))).toBe(r);
  });

  it('同じ id の参照は足さない', () => {
    const r = addPhotoRef(ngRound(), photo());
    expect(addPhotoRef(r, photo({ comment: '別' }))).toBe(r);
  });

  it('渡した参照を共有しない', () => {
    const ref = photo();
    const r = addPhotoRef(ngRound(), ref);
    ref.comment = '変更';
    expect(r.photos[0].comment).toBe('');
  });

  it('id で消す。無い id ならそのまま', () => {
    const r = addPhotoRef(addPhotoRef(ngRound(), photo()), photo({ id: 'p2' }));
    expect(removePhotoRef(r, 'p1').photos.map((p) => p.id)).toEqual(['p2']);
    expect(removePhotoRef(r, 'zz')).toBe(r);
    expect(r.photos).toHaveLength(2);
  });

  it('hasPhotos は部署と項目の両方で判定する', () => {
    const r = addPhotoRef(ngRound(), photo());
    expect(hasPhotos(r, '3階東', 'h3')).toBe(false);
    expect(hasPhotos(r, '3階西', 'h1')).toBe(false);
  });
});

describe('コメントと参加者', () => {
  it('部署のコメントを書く。ラウンドに無い部署ならそのまま', () => {
    const r = round();
    const next = setDepartmentComment(r, '3階東', '良好');
    expect(next.departmentComments).toEqual({ '3階東': '良好' });
    expect(r.departmentComments).toEqual({});
    expect(setDepartmentComment(r, '検査室', 'x')).toBe(r);
  });

  it('全体のコメントを書く', () => {
    const r = round();
    expect(setOverallComment(r, '全体に良好').overallComment).toBe('全体に良好');
    expect(r.overallComment).toBe('');
  });

  it('参加者を差し替え、渡した配列を共有しない', () => {
    const members = [{ name: '佐藤', role: '医師' }];
    const r = setMembers(round(), members);
    members[0].name = '変更';
    expect(r.members).toEqual([{ name: '佐藤', role: '医師' }]);
  });
});

describe('進み具合', () => {
  it('対象の項目のうち印のある数', () => {
    let r = round();
    expect(departmentProgress(r, '3階東')).toEqual({ marked: 0, total: 2 });
    expect(roundProgress(r)).toEqual({ marked: 0, total: 5 });
    r = setMark(r, '3階東', 'h1', 'ok');
    r = setMark(r, '3階東', 'h3', 'ng');
    r = setMark(r, '3階西', 'h1', 'ok');
    expect(departmentProgress(r, '3階東')).toEqual({ marked: 2, total: 2 });
    expect(departmentProgress(r, '内科外来')).toEqual({ marked: 0, total: 2 });
    expect(roundProgress(r)).toEqual({ marked: 3, total: 5 });
  });

  it('消した印は数えない', () => {
    const r = setMark(setMark(round(), '3階東', 'h1', 'ok'), '3階東', 'h1', 'ok');
    expect(departmentProgress(r, '3階東')).toEqual({ marked: 0, total: 2 });
  });

  it('ラウンドに無い部署は 0 / 0', () => {
    expect(departmentProgress(round(), '検査室')).toEqual({ marked: 0, total: 0 });
  });
});
