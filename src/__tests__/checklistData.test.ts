import { describe, it, expect } from 'vitest';
import type { ChecklistCategory } from '../types';
import { CHECKLIST_CATEGORIES, getAllItems, getTotalItems, findItemById } from '../checklistData';

const categories: ChecklistCategory[] = [
  {
    category: '手指衛生',
    items: [
      { id: 'a-1', category: '手指衛生', description: '項目1' },
      { id: 'a-2', category: '手指衛生', description: '項目2' },
    ],
  },
  {
    category: '水回り',
    items: [{ id: 'b-1', category: '水回り', description: '項目3' }],
  },
];

describe('checklistData', () => {
  it('getAllItems は全カテゴリの項目を定義順にフラットに集約する', () => {
    expect(getAllItems(categories).map((item) => item.id)).toEqual(['a-1', 'a-2', 'b-1']);
  });

  it('getTotalItems は項目の総数を返す', () => {
    expect(getTotalItems(categories)).toBe(3);
  });

  it('findItemById は ID に一致する項目を返す', () => {
    expect(findItemById(categories, 'b-1')).toEqual({
      id: 'b-1',
      category: '水回り',
      description: '項目3',
    });
  });

  it('findItemById は存在しない ID には undefined を返す', () => {
    expect(findItemById(categories, 'not-exist')).toBeUndefined();
  });

  it('標準チェックリスト（CHECKLIST_CATEGORIES）は1件以上のカテゴリと項目を持つ', () => {
    expect(CHECKLIST_CATEGORIES.length).toBeGreaterThan(0);
    expect(getTotalItems(CHECKLIST_CATEGORIES)).toBeGreaterThan(0);
  });

  // Item IDs key saved rounds and the merge page, so they must be unique and present.
  it('標準チェックリストの項目 ID は空でなく重複しない', () => {
    const ids = getAllItems(CHECKLIST_CATEGORIES).map((item) => item.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('標準チェックリストの各カテゴリは名前と1件以上の項目を持ち、項目は所属カテゴリ名と説明文を持つ', () => {
    for (const cat of CHECKLIST_CATEGORIES) {
      expect(cat.category).not.toBe('');
      expect(cat.items.length).toBeGreaterThan(0);
      for (const item of cat.items) {
        expect(item.category).toBe(cat.category);
        expect(item.description).not.toBe('');
      }
    }
  });
});
