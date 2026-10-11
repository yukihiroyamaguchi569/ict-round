import { describe, it, expect } from 'vitest';
import { CATEGORY_MAX_LENGTH, classifyLine, parseChecklistText } from '../checklistText';
import type { DraftCategory } from '../checklistEditor';

// Rule M, continued: a "■" check box before an item is told from a category mark before anything else
// is read from the rest, so a sentence behind it is never split into a row or taken for a category.

function simplify(categories: DraftCategory[]) {
  return categories.map((cat) => ({ name: cat.name, items: cat.items.map((item) => item.description) }));
}

const lines = (...rows: string[]) => rows.join('\n');

describe('classifyLine: a "■" check box before "short word + sentence" (rule M)', () => {
  it('reads the whole rest as an item instead of splitting it into a row', () => {
    expect(classifyLine('■ 必要時 使い捨て手袋を着用している。')).toEqual({ kind: 'item', text: '必要時 使い捨て手袋を着用している。' });
    expect(classifyLine('■ 必要時 使い捨て手袋を着用している。', true)).toEqual({
      kind: 'item',
      text: '必要時 使い捨て手袋を着用している。',
    });
  });

  it(`still splits a marked row of up to ${CATEGORY_MAX_LENGTH} characters`, () => {
    const rest = '必要時 手袋を着用している。';
    expect(rest.length).toBeLessThanOrEqual(CATEGORY_MAX_LENGTH);
    expect(classifyLine(`■ ${rest}`)).toEqual({ kind: 'row', category: '必要時', text: '手袋を着用している。', numbered: false });
  });

  it('does not enter the marks-only mode, so a heading after it is read by its shape', () => {
    expect(simplify(parseChecklistText(lines('1 体調管理', '■ 必要時 使い捨て手袋を着用している。', '2手洗い', 'ケア前後に手洗いをしている。')))).toEqual([
      { name: '体調管理', items: ['必要時 使い捨て手袋を着用している。'] },
      { name: '手洗い', items: ['ケア前後に手洗いをしている。'] },
    ]);
  });
});
