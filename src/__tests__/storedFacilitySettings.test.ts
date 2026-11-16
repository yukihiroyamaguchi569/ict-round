import { describe, it, expect } from 'vitest';
import { parseStoredSettings } from '../facility/storedFacilitySettings';

function stored() {
  return {
    version: 1,
    groups: [
      { name: '病棟', visit: 'always' },
      { name: '外来', visit: 'select' },
    ],
    departments: [{ name: '3階東', group: '病棟' }],
    themes: [
      {
        name: '環境',
        items: [{ id: 'a1', text: '床', targetGroups: ['病棟'], excludedDepartments: ['3階東'] }],
      },
    ],
    members: [{ name: '山田', role: '看護師' }],
  };
}

describe('parseStoredSettings', () => {
  it('正しい形ならそのまま読み戻す', () => {
    expect(parseStoredSettings(stored())).toEqual(stored());
  });

  it('JSON を往復した値も読める', () => {
    expect(parseStoredSettings(JSON.parse(JSON.stringify(stored())))).toEqual(stored());
  });

  it('空の配列は正しい形として扱う', () => {
    const value = { version: 1, groups: [], departments: [], themes: [{ name: 'T', items: [] }], members: [] };
    expect(parseStoredSettings(value)).toEqual(value);
  });

  it('知らないフィールドは落とし、元の値と配列を共有しない', () => {
    const value = stored();
    const withExtra = {
      ...value,
      extra: 1,
      groups: [{ ...value.groups[0], extra: 1 }],
      members: [{ ...value.members[0], extra: 1 }],
    };
    const parsed = parseStoredSettings(withExtra);
    expect(parsed).toEqual({ ...value, groups: [value.groups[0]] });
    expect(parsed?.themes[0].items[0].targetGroups).not.toBe(value.themes[0].items[0].targetGroups);
    expect(parsed?.themes[0].items[0].excludedDepartments).not.toBe(value.themes[0].items[0].excludedDepartments);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['文字列', '{}'],
    ['配列', [stored()]],
  ])('オブジェクトでない値（%s）は null', (_label, value) => {
    expect(parseStoredSettings(value)).toBeNull();
  });

  it.each([
    ['version が無い', { version: undefined }],
    ['version が 2', { version: 2 }],
    ['version が文字列の 1', { version: '1' }],
    ['groups が配列でない', { groups: {} }],
    ['departments が無い', { departments: undefined }],
    ['themes が null', { themes: null }],
    ['members が文字列', { members: '山田' }],
  ])('%s なら null', (_label, patch) => {
    expect(parseStoredSettings({ ...stored(), ...patch })).toBeNull();
  });

  it.each([
    ['グループが null', { groups: [null] }],
    ['グループ名が数値', { groups: [{ name: 1, visit: 'always' }] }],
    ['visit が不正', { groups: [{ name: '病棟', visit: '毎回' }] }],
    ['visit が無い', { groups: [{ name: '病棟' }] }],
    ['部署名が無い', { departments: [{ group: '病棟' }] }],
    ['部署のグループが無い', { departments: [{ name: '3階東' }] }],
    ['テーマが配列', { themes: [[]] }],
    ['テーマ名が無い', { themes: [{ items: [] }] }],
    ['テーマの items が無い', { themes: [{ name: '環境' }] }],
    ['項目が文字列', { themes: [{ name: '環境', items: ['床'] }] }],
    ['項目の id が無い', { themes: [{ name: '環境', items: [{ text: '床', targetGroups: [], excludedDepartments: [] }] }] }],
    ['項目の text が無い', { themes: [{ name: '環境', items: [{ id: 'a', targetGroups: [], excludedDepartments: [] }] }] }],
    [
      'targetGroups が文字列',
      { themes: [{ name: '環境', items: [{ id: 'a', text: '床', targetGroups: '病棟', excludedDepartments: [] }] }] },
    ],
    [
      'excludedDepartments に数値が混ざる',
      { themes: [{ name: '環境', items: [{ id: 'a', text: '床', targetGroups: ['病棟'], excludedDepartments: ['3階東', 1] }] }] },
    ],
    ['参加者の氏名が無い', { members: [{ role: '看護師' }] }],
    ['参加者の職種が無い', { members: [{ name: '山田' }] }],
  ])('%s なら null', (_label, patch) => {
    expect(parseStoredSettings({ ...stored(), ...patch })).toBeNull();
  });

  it('壊れた要素が後ろの方にあっても null', () => {
    const value = stored();
    expect(parseStoredSettings({ ...value, members: [...value.members, { name: '佐藤' }] })).toBeNull();
  });
});
