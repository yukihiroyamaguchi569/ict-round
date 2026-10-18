import { describe, it, expect } from 'vitest';
import {
  addImportedCategories,
  emptyCategory,
  emptyDraft,
  isEmptyDraft,
  type DraftCategory,
  type EditorDraft,
} from '../checklistEditor';

function category(name: string, ...items: string[]): DraftCategory {
  return { key: `c-${name}`, name, items: items.map((description, i) => ({ key: `i-${name}-${i}`, description })) };
}

const IMPORTED = [category('手指衛生', '消毒剤がある．'), category('環境', '清掃されている．')];

describe('isEmptyDraft', () => {
  it('is true for a fresh emptyDraft()', () => {
    expect(isEmptyDraft(emptyDraft())).toBe(true);
  });

  it('treats whitespace-only text as empty', () => {
    expect(isEmptyDraft({ name: ' 　', categories: [category(' ', '  ')] })).toBe(true);
  });

  it.each<[string, EditorDraft]>([
    ['a name', { name: '医療安全', categories: [category('', '')] }],
    ['a category name', { name: '', categories: [category('転倒', '')] }],
    ['an item text', { name: '', categories: [category('', '柵が上がっている')] }],
    ['a second item', { name: '', categories: [category('', '', '')] }],
    ['no item', { name: '', categories: [category('')] }],
    ['a second category', { name: '', categories: [emptyCategory(), emptyCategory()] }],
    ['no category', { name: '', categories: [] }],
  ])('is false with %s', (_, draft) => {
    expect(isEmptyDraft(draft)).toBe(false);
  });
});

describe('addImportedCategories', () => {
  it('replaces the categories of an empty draft', () => {
    const draft = emptyDraft();
    expect(addImportedCategories(draft, IMPORTED)).toEqual({ name: '', categories: IMPORTED });
  });

  it('appends to a draft that has content, keeping its name and categories', () => {
    const existing = category('転倒', '柵が上がっている');
    const draft: EditorDraft = { name: '医療安全', categories: [existing] };
    expect(addImportedCategories(draft, IMPORTED)).toEqual({ name: '医療安全', categories: [existing, ...IMPORTED] });
  });

  it('appends after the empty category when only the name was typed', () => {
    const blank = emptyCategory();
    const draft: EditorDraft = { name: '医療安全', categories: [blank] };
    expect(addImportedCategories(draft, IMPORTED).categories).toEqual([blank, ...IMPORTED]);
  });

  it('does not change the draft it was given', () => {
    const draft: EditorDraft = { name: '医療安全', categories: [category('転倒', '柵')] };
    const before = structuredClone(draft);
    addImportedCategories(draft, IMPORTED);
    expect(draft).toEqual(before);
  });
});
