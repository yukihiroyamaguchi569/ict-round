import { describe, it, expect } from 'vitest';
import {
  joinWithPreviousItem,
  mergeCategoryIntoPrevious,
  splitCategoryAtItem,
  type DraftCategory,
} from '../checklistEditor';

// Categories built from names and item descriptions with predictable keys: c0, c0i0, c0i1, ...
function cats(spec: [string, string[]][]): DraftCategory[] {
  return spec.map(([name, items], ci) => ({
    key: `c${ci}`,
    name,
    items: items.map((description, ii) => ({ key: `c${ci}i${ii}`, description })),
  }));
}

const shape = (categories: DraftCategory[]) => categories.map((c) => [c.name, c.items.map((i) => i.description)]);

describe('joinWithPreviousItem', () => {
  it('appends the item to the previous one as-is and removes it', () => {
    const before = cats([['A', ['定期的に清掃してい', 'る', '次']], ['B', ['x']]]);
    const after = joinWithPreviousItem(before, 0, 1);
    expect(shape(after)).toEqual([['A', ['定期的に清掃している', '次']], ['B', ['x']]]);
    expect(after[0].items.map((i) => i.key)).toEqual(['c0i0', 'c0i2']);
  });

  it('joins without trimming or adding a separator', () => {
    const after = joinWithPreviousItem(cats([['A', [' 前 ', ' 後 ']]]), 0, 1);
    expect(after[0].items[0].description).toBe(' 前  後 ');
  });

  it('keeps the previous item empty when both are empty', () => {
    const after = joinWithPreviousItem(cats([['A', ['', '']]]), 0, 1);
    expect(shape(after)).toEqual([['A', ['']]]);
  });

  it('joins the last item of a later category and leaves other categories alone', () => {
    const before = cats([['A', ['a']], ['B', ['b1', 'b2']]]);
    const after = joinWithPreviousItem(before, 1, 1);
    expect(shape(after)).toEqual([['A', ['a']], ['B', ['b1b2']]]);
    expect(after[0]).toBe(before[0]);
  });

  it('keeps the source of the previous item', () => {
    const before = cats([['A', ['a', 'b']]]);
    before[0].items[0].source = { id: 'h-1', category: 'A', description: 'a' };
    expect(joinWithPreviousItem(before, 0, 1)[0].items[0].source).toEqual({ id: 'h-1', category: 'A', description: 'a' });
  });

  it('returns the same array for the first item', () => {
    const before = cats([['A', ['a', 'b']]]);
    expect(joinWithPreviousItem(before, 0, 0)).toBe(before);
  });

  it('does not change its argument', () => {
    const before = cats([['A', ['a', 'b']]]);
    const copy = structuredClone(before);
    joinWithPreviousItem(before, 0, 1);
    expect(before).toEqual(copy);
  });
});

describe('splitCategoryAtItem', () => {
  it('makes the item a new category after its own, taking the items that followed', () => {
    const before = cats([['A', ['a1', '小見出し', 'a3', 'a4']], ['B', ['b']]]);
    const after = splitCategoryAtItem(before, 0, 1);
    expect(shape(after)).toEqual([['A', ['a1']], ['小見出し', ['a3', 'a4']], ['B', ['b']]]);
    expect(after[1].items.map((i) => i.key)).toEqual(['c0i2', 'c0i3']);
    expect(after[0].key).toBe('c0');
    expect(after[1].key).not.toBe('c0');
    expect(after[2]).toBe(before[1]);
  });

  it('leaves the original category empty when its first item becomes the category', () => {
    const after = splitCategoryAtItem(cats([['A', ['見出し', 'a2']]]), 0, 0);
    expect(shape(after)).toEqual([['A', []], ['見出し', ['a2']]]);
  });

  it('makes an empty category from the last item', () => {
    const after = splitCategoryAtItem(cats([['A', ['a1', '見出し']]]), 0, 1);
    expect(shape(after)).toEqual([['A', ['a1']], ['見出し', []]]);
  });

  it('gives each new category a different key', () => {
    const before = cats([['A', ['a1', 'a2']]]);
    expect(splitCategoryAtItem(before, 0, 1)[1].key).not.toBe(splitCategoryAtItem(before, 0, 1)[1].key);
  });

  it('uses the given key for the new category', () => {
    expect(splitCategoryAtItem(cats([['A', ['a1', 'a2']]]), 0, 1, 'given')[1].key).toBe('given');
  });

  it('splits the last category', () => {
    const after = splitCategoryAtItem(cats([['A', ['a']], ['B', ['b1', '見出し', 'b3']]]), 1, 1);
    expect(shape(after)).toEqual([['A', ['a']], ['B', ['b1']], ['見出し', ['b3']]]);
  });

  it('does not change its argument', () => {
    const before = cats([['A', ['a1', 'a2', 'a3']]]);
    const copy = structuredClone(before);
    splitCategoryAtItem(before, 0, 1);
    expect(before).toEqual(copy);
  });
});

describe('mergeCategoryIntoPrevious', () => {
  it('moves the items to the end of the previous category and drops the name', () => {
    const before = cats([['A', ['a1', 'a2']], ['ヨ7', ['b1', 'b2']], ['C', ['c']]]);
    const after = mergeCategoryIntoPrevious(before, 1);
    expect(shape(after)).toEqual([['A', ['a1', 'a2', 'b1', 'b2']], ['C', ['c']]]);
    expect(after[0].key).toBe('c0');
    expect(after[0].items.map((i) => i.key)).toEqual(['c0i0', 'c0i1', 'c1i0', 'c1i1']);
    expect(after[1]).toBe(before[2]);
  });

  it('merges a category with one item', () => {
    const after = mergeCategoryIntoPrevious(cats([['A', ['a']], ['B', ['b']]]), 1);
    expect(shape(after)).toEqual([['A', ['a', 'b']]]);
  });

  it('removes an empty category without adding items', () => {
    const after = mergeCategoryIntoPrevious(cats([['A', ['a']], ['B', []]]), 1);
    expect(shape(after)).toEqual([['A', ['a']]]);
  });

  it('returns the same array for the first category', () => {
    const before = cats([['A', ['a']], ['B', ['b']]]);
    expect(mergeCategoryIntoPrevious(before, 0)).toBe(before);
  });

  it('does not change its argument', () => {
    const before = cats([['A', ['a']], ['B', ['b']]]);
    const copy = structuredClone(before);
    mergeCategoryIntoPrevious(before, 1);
    expect(before).toEqual(copy);
  });
});

describe('out-of-range indexes', () => {
  const before = cats([['A', ['a1', 'a2']], ['B', ['b']]]);

  it('joinWithPreviousItem returns the same array for an empty list or an index outside it', () => {
    const empty: DraftCategory[] = [];
    expect(joinWithPreviousItem(empty, 0, 1)).toBe(empty);
    for (const [ci, ii] of [[-1, 1], [2, 1], [0, 2], [1, 1], [0, -1]]) {
      expect(joinWithPreviousItem(before, ci, ii)).toBe(before);
    }
  });

  it('splitCategoryAtItem returns the same array for an empty list or an index outside it', () => {
    const empty: DraftCategory[] = [];
    expect(splitCategoryAtItem(empty, 0, 0)).toBe(empty);
    for (const [ci, ii] of [[-1, 0], [2, 0], [0, 2], [1, 1], [0, -1]]) {
      expect(splitCategoryAtItem(before, ci, ii)).toBe(before);
    }
  });

  it('mergeCategoryIntoPrevious returns the same array for an empty list or an index outside it', () => {
    const empty: DraftCategory[] = [];
    expect(mergeCategoryIntoPrevious(empty, 1)).toBe(empty);
    expect(mergeCategoryIntoPrevious(before, 2)).toBe(before);
    expect(mergeCategoryIntoPrevious(before, -1)).toBe(before);
  });
});
