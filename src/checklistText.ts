import { newKey, type DraftCategory } from './checklistEditor';

// Splits pasted text of a checklist table into editor draft categories.
// Two sources are expected: a table copied from Excel / Word (tab-separated cells), and
// text recognised from a photo of a paper table by the OS (iPhone Live Text, Google Lens),
// which arrives as plain lines. The rules below are guesses to be tuned against real output,
// so each threshold and pattern is a named constant.

export type TextFormat = 'table' | 'lines';

/** A line up to this many characters, without a sentence ending, is read as a category name. */
export const CATEGORY_MAX_LENGTH = 15;

/** Header cells of a checklist table, e.g. the report's "ジャンル | チェック項目 | 評価". */
const HEADER_WORDS = new Set([
  'ジャンル', 'カテゴリ', 'カテゴリー', 'カテゴリ名', '分類', '区分', '大項目',
  'チェック項目', '点検項目', '確認項目', '項目', '内容', '評価', '判定', '結果', '備考', 'no', 'no.', '番号',
  'category', 'description', 'item', 'items', 'rating',
]);

/** A rating cell: A / B / C (half or full width), or a mark such as ○ × △ －. */
const RATING = '(?:[ABCＡＢＣ]|[○◯〇×✕✖△▲－\\-ー―])';
const RATING_ONLY = new RegExp(`^${RATING}$`);
/** A rating after an item's sentence ending, with or without a space: "…いる．A" */
const RATING_AFTER_SENTENCE = new RegExp(`([。．.）)])\\s*${RATING}$`);
/** A rating separated by a space at the end of a line: "…いる A" */
const RATING_AFTER_SPACE = new RegExp(`\\s+${RATING}$`);

/** Page number lines: "3", "- 3 -", "3/5", "P.3", "3ページ". */
const PAGE_NUMBERS = [/^[-－]?\s*\d+\s*[-－]?$/, /^\d+\s*[/／]\s*\d+$/, /^p\.?\s*\d+$/i, /^\d+\s*(?:ページ|頁)$/];

/** Marks at the start of a line that make it a category: ■ □ ● ◆ ◇ 【 # */
const CATEGORY_MARK = /^[■□●◆◇【#＃]+\s*/;
/** A heading number at the start of a line: "1." "1．" "1、" "1)" "(1)" "（1）" "①". */
const HEADING_NUMBER = /^(?:\d+[.．、)）]|[(（]\d+[)）]|[①-⑳])\s*/;

/** The end of a sentence; items usually end with one. */
const SENTENCE_END = /[。．.]$/;
/** Predicate endings that mark an item even without a full stop: "…いる", "…ない". */
const ITEM_ENDING = /(?:いる|ない|ある|する|れる|こと)$/;

/** Tidies one line: full-width and repeated spaces become one space; tabs (empty cells) are kept. */
export function normalizeLine(line: string): string {
  return line.replace(/[\u3000\u00a0 ]+/g, ' ').replace(/^ | $/g, '');
}

function isHeaderWord(word: string): boolean {
  return HEADER_WORDS.has(word.trim().toLowerCase());
}

/** Lines that carry no checklist content: headers, rating marks, page numbers. */
export function isNoiseLine(line: string): boolean {
  if (PAGE_NUMBERS.some((re) => re.test(line))) return true;
  return line.split(' ').every((word) => isHeaderWord(word) || RATING_ONLY.test(word));
}

/** Removes a rating left at the end of an item line ("…いる． A" → "…いる．"). */
export function stripTrailingRating(line: string): string {
  return line.replace(RATING_AFTER_SENTENCE, '$1').replace(RATING_AFTER_SPACE, '').trim();
}

/** Whether text ends like a sentence (full stop or predicate), as checklist items do. */
function looksLikeSentence(text: string): boolean {
  return SENTENCE_END.test(text) || ITEM_ENDING.test(text);
}

/** Whether a piece of text reads as a category name: short, and not ending like a sentence. */
export function looksLikeCategory(text: string): boolean {
  return text.length <= CATEGORY_MAX_LENGTH && !looksLikeSentence(text);
}

export type LineKind =
  | { kind: 'category'; name: string }
  | { kind: 'item'; text: string }
  | { kind: 'row'; category: string; text: string };

/** Splits "短い語 文" (a table row read as one line) into a category and an item, if it has that shape. */
function splitRow(line: string): LineKind | null {
  const space = line.indexOf(' ');
  if (space < 0) return null;
  const head = line.slice(0, space);
  const rest = line.slice(space + 1).trim();
  if (!looksLikeCategory(head) || looksLikeCategory(rest)) return null;
  return { kind: 'row', category: head, text: rest };
}

/**
 * Classifies one normalised, non-noise line of recognised text. A marked line is a category;
 * a numbered line is a category unless it ends like a sentence (then the number is dropped).
 */
export function classifyLine(line: string): LineKind {
  if (CATEGORY_MARK.test(line)) {
    return { kind: 'category', name: line.replace(CATEGORY_MARK, '').replace(/】/g, ' ').trim() };
  }
  const body = line.replace(HEADING_NUMBER, '');
  if (body !== line && !looksLikeSentence(body)) return { kind: 'category', name: body };

  const row = splitRow(body);
  if (row) return row;
  return looksLikeCategory(body) ? { kind: 'category', name: body } : { kind: 'item', text: body };
}

/** Collects items into categories in order of first appearance; the same name is one category. */
class CategoryCollector {
  private readonly categories: DraftCategory[] = [];
  private readonly byName = new Map<string, DraftCategory>();
  current = '';

  add(text: string): void {
    let category = this.byName.get(this.current);
    if (!category) {
      category = { key: newKey(), name: this.current, items: [] };
      this.byName.set(this.current, category);
      this.categories.push(category);
    }
    category.items.push({ key: newKey(), description: text });
  }

  result(): DraftCategory[] {
    return this.categories;
  }
}

function readLines(lines: string[], collector: CategoryCollector): void {
  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    const kind = classifyLine(stripTrailingRating(line));
    // A bare mark or number ("■", "1.") names nothing; keep the current category
    if (kind.kind === 'category') {
      if (kind.name) collector.current = kind.name;
    } else if (kind.kind === 'row') {
      collector.current = kind.category;
      collector.add(kind.text);
    } else {
      collector.add(kind.text);
    }
  }
}

/** Cells of one tab-separated row, with a leading number column ("1", "2", …) dropped. */
export function rowCells(line: string): string[] {
  const cells = line.split('\t').map((cell) => normalizeLine(cell.replace(/^"(.*)"$/, '$1')));
  while (cells.length > 1 && /^\d+$/.test(cells[0])) cells.shift();
  return cells;
}

function readTable(lines: string[], collector: CategoryCollector): void {
  for (const line of lines) {
    if (!line.includes('\t')) {
      // A line without cells (a title, or text typed in by hand) is read like recognised text
      readLines([line], collector);
      continue;
    }
    const [category = '', item = ''] = rowCells(line);
    if (isHeaderWord(category) || isHeaderWord(item)) continue;
    // An empty category cell continues the category above (merged cells)
    if (category) collector.current = category;
    if (item) collector.add(item);
  }
}

/** Splits text into normalised, non-empty lines. */
function toLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map(normalizeLine)
    .filter((line) => line.trim() !== '');
}

/** 'table' when any line has a tab (copied from Excel / Word), otherwise 'lines'. */
export function detectTextFormat(text: string): TextFormat {
  return text.includes('\t') ? 'table' : 'lines';
}

/**
 * Splits pasted checklist text into draft categories. Items before any category go into a
 * category with an empty name, which the editor asks the user to fill in on save.
 */
export function parseChecklistText(text: string): DraftCategory[] {
  const collector = new CategoryCollector();
  const lines = toLines(text);
  if (detectTextFormat(text) === 'table') readTable(lines, collector);
  else readLines(lines, collector);
  return collector.result();
}
