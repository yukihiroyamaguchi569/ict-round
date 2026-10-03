import { describe, it, expect } from 'vitest';
import {
  buildChecklist,
  draftFromChecklist,
  emptyDraft,
  moveItem,
  type BuildResult,
  type EditorDraft,
} from '../checklistEditor';
import type { SavedChecklist } from '../types';

const SOURCE: SavedChecklist = {
  id: 'default',
  name: '標準チェックリスト',
  createdAt: '2026-01-01T00:00:00.000Z',
  isDefault: true,
  categories: [
    {
      category: '手指衛生',
      items: [
        { id: 'h-1', category: '手指衛生', description: '消毒剤がある' },
        { id: 'h-2', category: '手指衛生', description: '掲示がある' },
      ],
    },
    { category: '環境', items: [{ id: 'e-1', category: '環境', description: '清掃されている' }] },
  ],
};

function sequentialIds() {
  let n = 0;
  return () => {
    n += 1;
    return `id${n}`;
  };
}

const FIXED_NOW = () => new Date('2026-10-03T00:00:00.000Z');

function draft(name: string, categories: { name: string; items: (string | [string, string])[] }[]): EditorDraft {
  return {
    name,
    categories: categories.map((cat, ci) => ({
      key: `c${ci}`,
      name: cat.name,
      items: cat.items.map((item, ii) =>
        typeof item === 'string'
          ? { key: `c${ci}i${ii}`, description: item }
          : { key: `c${ci}i${ii}`, id: item[0], description: item[1] },
      ),
    })),
  };
}

function expectChecklist(result: BuildResult): SavedChecklist {
  if ('error' in result) throw new Error(`unexpected error: ${result.error}`);
  return result.checklist;
}

function expectError(result: BuildResult): string {
  if (!('error' in result)) throw new Error('expected an error');
  return result.error;
}

describe('emptyDraft', () => {
  it('starts with one blank category holding one blank item', () => {
    const d = emptyDraft();
    expect(d.name).toBe('');
    expect(d.categories).toHaveLength(1);
    expect(d.categories[0].name).toBe('');
    expect(d.categories[0].items).toEqual([{ key: expect.any(String), description: '' }]);
  });

  it('gives each draft fresh keys', () => {
    const a = emptyDraft();
    const b = emptyDraft();
    expect(a.categories[0].key).not.toBe(b.categories[0].key);
    expect(a.categories[0].items[0].key).not.toBe(b.categories[0].items[0].key);
  });
});

describe('draftFromChecklist', () => {
  it('copies categories, descriptions and item IDs under the given name', () => {
    const d = draftFromChecklist(SOURCE, '標準チェックリストのコピー');
    expect(d.name).toBe('標準チェックリストのコピー');
    expect(d.categories.map((c) => c.name)).toEqual(['手指衛生', '環境']);
    expect(d.categories[0].items.map((i) => [i.id, i.description])).toEqual([
      ['h-1', '消毒剤がある'],
      ['h-2', '掲示がある'],
    ]);
    const keys = d.categories.flatMap((c) => [c.key, ...c.items.map((i) => i.key)]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not share item arrays with the source', () => {
    const d = draftFromChecklist(SOURCE, 'x');
    d.categories[0].items[0].description = '変更';
    expect(SOURCE.categories[0].items[0].description).toBe('消毒剤がある');
  });
});

describe('moveItem', () => {
  const arr = ['a', 'b', 'c'];

  it('moves an element up and down', () => {
    expect(moveItem(arr, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(arr, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(arr).toEqual(['a', 'b', 'c']);
  });

  it('leaves the array unchanged at either end', () => {
    expect(moveItem(arr, 0, -1)).toBe(arr);
    expect(moveItem(arr, 2, 1)).toBe(arr);
  });

  it('leaves the array unchanged for an out-of-range index', () => {
    expect(moveItem(arr, -1, 1)).toBe(arr);
    expect(moveItem(arr, 3, -1)).toBe(arr);
    expect(moveItem([], 0, 1)).toEqual([]);
  });
});

describe('buildChecklist', () => {
  it('builds a new checklist with trimmed text and fresh IDs', () => {
    const result = buildChecklist(
      draft('  外来用  ', [{ name: ' 手指衛生 ', items: [' 消毒剤がある ', '掲示がある'] }]),
      sequentialIds(),
      FIXED_NOW,
    );
    expect(expectChecklist(result)).toEqual({
      id: 'id3',
      name: '外来用',
      createdAt: '2026-10-03T00:00:00.000Z',
      categories: [
        {
          category: '手指衛生',
          items: [
            { id: 'item-id1', category: '手指衛生', description: '消毒剤がある' },
            { id: 'item-id2', category: '手指衛生', description: '掲示がある' },
          ],
        },
      ],
    });
  });

  it('never marks the result as the default checklist', () => {
    const c = expectChecklist(buildChecklist(draftFromChecklist(SOURCE, 'コピー')));
    expect(c.isDefault).toBeUndefined();
    expect(c.id).not.toBe(SOURCE.id);
  });

  it('drops blank items and categories left without items', () => {
    const c = expectChecklist(
      buildChecklist(
        draft('x', [
          { name: '手指衛生', items: ['', '消毒剤がある', '   '] },
          { name: '空カテゴリ', items: ['', ' '] },
          { name: '', items: [''] },
          { name: '環境', items: ['清掃'] },
        ]),
      ),
    );
    expect(c.categories.map((cat) => cat.category)).toEqual(['手指衛生', '環境']);
    expect(c.categories[0].items.map((i) => i.description)).toEqual(['消毒剤がある']);
  });

  it('rejects an empty or whitespace-only name', () => {
    expect(expectError(buildChecklist(draft('   ', [{ name: 'a', items: ['b'] }])))).toBe(
      'チェックリストの名前を入力してください。',
    );
  });

  it('rejects a draft with no non-blank item', () => {
    expect(expectError(buildChecklist(draft('x', [{ name: 'a', items: [' '] }])))).toBe(
      '点検項目を1つ以上入力してください。',
    );
    expect(expectError(buildChecklist(draft('x', [])))).toBe('点検項目を1つ以上入力してください。');
  });

  it('rejects a category that has items but no name', () => {
    expect(expectError(buildChecklist(draft('x', [{ name: '  ', items: ['b'] }])))).toBe(
      '項目のあるカテゴリには名前を入力してください。',
    );
  });

  it('rejects two categories with the same name after trimming', () => {
    const error = expectError(
      buildChecklist(
        draft('x', [
          { name: '手指衛生', items: ['a'] },
          { name: '環境', items: ['b'] },
          { name: ' 手指衛生 ', items: ['c'] },
        ]),
      ),
    );
    expect(error).toBe('カテゴリ名「手指衛生」が重複しています。別の名前にしてください。');
  });

  it('allows a duplicate category name when one of them has no items (it is dropped)', () => {
    const c = expectChecklist(
      buildChecklist(
        draft('x', [
          { name: '手指衛生', items: ['a'] },
          { name: '手指衛生', items: [''] },
        ]),
      ),
    );
    expect(c.categories).toHaveLength(1);
  });

  it('keeps item IDs from a copied checklist and sets category to the renamed category', () => {
    const d = draftFromChecklist(SOURCE, 'コピー');
    d.categories[0].name = '手洗い';
    const c = expectChecklist(buildChecklist(d, sequentialIds()));
    expect(c.categories[0]).toEqual({
      category: '手洗い',
      items: [
        { id: 'h-1', category: '手洗い', description: '消毒剤がある' },
        { id: 'h-2', category: '手洗い', description: '掲示がある' },
      ],
    });
    expect(c.categories[1].items[0]).toEqual({ id: 'e-1', category: '環境', description: '清掃されている' });
  });

  it('keeps the ID of a copied item that moved to another category', () => {
    const d = draft('x', [
      { name: 'A', items: [] },
      { name: 'B', items: [['h-1', '消毒剤がある']] },
    ]);
    const c = expectChecklist(buildChecklist(d));
    expect(c.categories[0].items[0]).toEqual({ id: 'h-1', category: 'B', description: '消毒剤がある' });
  });

  it('reassigns the second and later occurrences of a duplicate ID', () => {
    const d = draft('x', [
      { name: 'A', items: [['dup', 'one'], ['dup', 'two']] },
      { name: 'B', items: [['dup', 'three']] },
    ]);
    const c = expectChecklist(buildChecklist(d, sequentialIds()));
    expect(c.categories.flatMap((cat) => cat.items.map((i) => i.id))).toEqual(['dup', 'item-id1', 'item-id2']);
  });

  it('does not let a new ID collide with an existing one', () => {
    // The generator first returns a value that collides with a kept ID
    const ids = ['x', 'x', 'y', 'list'];
    const makeId = () => ids.shift() ?? 'unexpected';
    const d = draft('x', [{ name: 'A', items: ['new', ['item-x', 'kept']] }]);
    const c = expectChecklist(buildChecklist(d, makeId));
    // The first item takes item-x, so the kept item-x is now a duplicate and is reassigned
    expect(c.categories[0].items.map((i) => i.id)).toEqual(['item-x', 'item-y']);
    expect(c.id).toBe('list');
  });

  it('gives every new item a unique ID with the default generator', () => {
    const items = Array.from({ length: 200 }, (_, i) => `項目${i}`);
    const c = expectChecklist(buildChecklist(draft('x', [{ name: 'A', items }])));
    const ids = c.categories[0].items.map((i) => i.id);
    expect(new Set(ids).size).toBe(200);
    expect(ids.every((id) => /^item-[0-9a-z]+$/.test(id))).toBe(true);
  });

  it('does not modify the draft', () => {
    const d = draft(' x ', [{ name: ' A ', items: [' b '] }]);
    const before = structuredClone(d);
    buildChecklist(d);
    expect(d).toEqual(before);
  });
});
