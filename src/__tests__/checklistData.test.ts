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
  it('getAllItems は全カテゴリの項目をフラットに集約する', () => {
    expect(getAllItems(categories)).toHaveLength(3);
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
});
