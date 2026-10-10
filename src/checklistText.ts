import { newKey, type DraftCategory, type DraftItem } from './checklistEditor';

// Splits pasted text of a checklist table into editor draft categories.
// Two sources are expected: a table copied from Excel / Word (tab-separated cells), and
// text recognised from a photo of a paper table by the OS (iPhone Live Text, Google Lens),
// which arrives as plain lines. The rules below are guesses to be tuned against real output,
// so each threshold and pattern is a named constant.

export type TextFormat = 'table' | 'lines';

/** A line up to this many characters, without a sentence ending, is read as a category name. */
export const CATEGORY_MAX_LENGTH = 15;

/**
 * The tail of an item wrapped in its table cell is at most this long: Live Text reads
 * "…配置してい" and "る．" as two lines.
 */
export const WRAP_TAIL_MAX_LENGTH = 4;

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
const RATING_AFTER_SENTENCE = new RegExp(`([。．.、，,）)])\\s*${RATING}$`);
/** A rating separated by a space at the end of a line: "…いる A" */
const RATING_AFTER_SPACE = new RegExp(`\\s+${RATING}$`);
/**
 * A rating stuck to Japanese text: "…しているA". Dash-like marks are left out because "ー" ends
 * katakana words. Only removed when the rest ends like a sentence, so "病棟A" or "ビタミンC" stay.
 */
const RATING_AFTER_JAPANESE = /([\u3040-\u30ff\u3400-\u9fff」])[ABCＡＢＣ○◯〇×✕✖△▲]$/;

/** Page number lines: "3", "- 3 -", "3/5", "P.3", "3ページ". */
const PAGE_NUMBERS = [/^[-－]?\s*\d+\s*[-－]?$/, /^\d+\s*[/／]\s*\d+$/, /^p\.?\s*\d+$/i, /^\d+\s*(?:ページ|頁)$/];

/** Marks at the start of a line that make it a category: ■ □ ● ◆ ◇ 【 # */
const CATEGORY_MARK = /^[■□●◆◇【#＃]+\s*/;
/** A heading number at the start of a line: "1." "1．" "1、" "1)" "(1)" "（1）" "①". */
const HEADING_NUMBER = /^(?:\d+[.．、)）]|[(（]\d+[)）]|[①-⑳])\s*/;

/**
 * The end of a sentence; items usually end with one. A comma counts too: text recognised from a
 * photo often reads "．" at the end of an item as "、" or "，", and a category name never ends with one.
 */
const SENTENCE_END = /[。．.、，,]$/;
/** Predicate endings that mark an item even without a full stop: "…いる", "…ない". */
const ITEM_ENDING = /(?:いる|ない|ある|する|れる|こと)$/;

/** Dots recognised in place of "・" (nakaguro): "汚物室•トイレ". */
const NAKAGURO_LOOKALIKES = /[\u2022\u00b7\uff65]/g;

/**
 * Tidies one line: full-width and repeated spaces become one space; tabs (empty cells) are kept.
 * Dots recognised in place of "・" become "・", so the same name read twice is one category.
 */
export function normalizeLine(line: string): string {
  return line.replace(/[\u3000\u00a0 ]+/g, ' ').replace(/^ | $/g, '').replace(NAKAGURO_LOOKALIKES, '・');
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
  const spaced = line.replace(RATING_AFTER_SENTENCE, '$1').replace(RATING_AFTER_SPACE, '').trim();
  const glued = spaced.replace(RATING_AFTER_JAPANESE, '$1');
  return looksLikeSentence(glued) ? glued : spaced;
}

/** Whether text ends like a sentence (full stop or predicate), as checklist items do. */
function looksLikeSentence(text: string): boolean {
  return SENTENCE_END.test(text) || ITEM_ENDING.test(text);
}

/** Text that stops in the middle of a word, as the first line of a wrapped item does: "…配置してい". */
const OPEN_ENDING = /[\u3040-\u30ff\u3400-\u9fffA-Za-z0-9０-９]$/;
/** The tail of a wrapped item starts with Japanese text, so a bare number ("1.") is never taken for one. */
const TAIL_START = /^[\u3040-\u30ff\u3400-\u9fff]/;

/**
 * Whether a line is the rest of the item above, wrapped in its table cell ("…してい" then "る．"):
 * the item fills its cell (longer than a category name) and stops mid-word, and the line is short,
 * starts with Japanese text and ends like a sentence. Two short items ("清掃を実施", "確認する") stay apart.
 */
export function isWrappedItemTail(item: string, line: string): boolean {
  return (
    item.length > CATEGORY_MAX_LENGTH &&
    OPEN_ENDING.test(item) &&
    !looksLikeSentence(item) &&
    line.length <= WRAP_TAIL_MAX_LENGTH &&
    TAIL_START.test(line) &&
    looksLikeSentence(line)
  );
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
 * Classifies one normalised, non-noise line of recognised text. A marked line is a category.
 * With marksOnly (the text has marked lines, so the user has said which lines are categories)
 * every other line is an item. Otherwise a numbered line is a category unless it ends like a
 * sentence (then the number is dropped), and the remaining lines are guessed by their shape.
 */
export function classifyLine(line: string, marksOnly = false): LineKind {
  if (CATEGORY_MARK.test(line)) {
    return { kind: 'category', name: line.replace(CATEGORY_MARK, '').replace(/】/g, ' ').trim() };
  }
  const body = line.replace(HEADING_NUMBER, '');
  if (marksOnly) return { kind: 'item', text: body };
  if (body !== line && !looksLikeSentence(body)) return { kind: 'category', name: body };

  const row = splitRow(body);
  if (row) return row;
  return looksLikeCategory(body) ? { kind: 'category', name: body } : { kind: 'item', text: body };
}

/**
 * Collects items into categories in order of first appearance; the same name is one category.
 * A category stays even with no items, so a line wrongly taken for a category shows in the preview
 * instead of disappearing (the editor leaves empty categories out on save).
 */
class CategoryCollector {
  private readonly categories: DraftCategory[] = [];
  private readonly byName = new Map<string, DraftCategory>();
  /** Names read with their end wrapped off ("汚物室・トイ") mapped to the whole name ("汚物室・トイレ"). */
  private readonly wrappedNames = new Map<string, string>();
  private current = '';
  private lastItem: DraftItem | null = null;

  private categoryNamed(name: string): DraftCategory {
    let category = this.byName.get(name);
    if (!category) {
      category = { key: newKey(), name, items: [] };
      this.byName.set(name, category);
      this.categories.push(category);
    }
    return category;
  }

  setCategory(name: string): void {
    this.current = this.wrappedNames.get(name) ?? name;
    this.categoryNamed(this.current);
    this.lastItem = null;
  }

  add(text: string): void {
    this.lastItem = { key: newKey(), description: text };
    this.categoryNamed(this.current).items.push(this.lastItem);
  }

  /** Joins a line to the item just added when it is that item's wrapped tail; false otherwise. */
  joinItemTail(line: string): boolean {
    if (!this.lastItem || !isWrappedItemTail(this.lastItem.description, line)) return false;
    this.lastItem.description += line;
    return true;
  }

  /**
   * Handles a category line that is the end of a category name wrapped in its cell: "汚物室・トイ 汚物処理室…"
   * then "レ". It is taken as one only when the row after it starts with the same cut name again (so a
   * real category after a row is not glued on), and then that cut name stands for the whole name from
   * here on. A later line with the same end after a row of the cut name is dropped. False otherwise.
   */
  joinCategoryTail(rowCategory: string, tail: string, nextRowCategory: string | undefined): boolean {
    const whole = rowCategory + tail;
    if (this.wrappedNames.get(rowCategory) === whole) return true;
    const category = this.byName.get(rowCategory);
    const isWrap = nextRowCategory === rowCategory && looksLikeCategory(whole) && !this.byName.has(whole);
    if (!category || this.wrappedNames.has(rowCategory) || !isWrap) return false;
    this.byName.delete(rowCategory);
    category.name = whole;
    this.byName.set(whole, category);
    this.wrappedNames.set(rowCategory, whole);
    this.current = whole;
    return true;
  }

  result(): DraftCategory[] {
    return this.categories;
  }
}

/** Whether the user marked any line as a category ("■手指衛生"); a bare mark ("■") names nothing. */
function hasMarkedLine(lines: string[]): boolean {
  return lines.some((line) => CATEGORY_MARK.test(line) && line.replace(CATEGORY_MARK, '') !== '');
}

interface ReadLine {
  /** The line without a trailing rating. */
  text: string;
  kind: LineKind;
}

function toReadLines(lines: string[], marksOnly: boolean): ReadLine[] {
  return lines
    .filter((line) => !isNoiseLine(line))
    .map((line) => {
      // A marked line is a category name, so a trailing letter there ("■ 病棟 A") is not a rating
      const text = CATEGORY_MARK.test(line) ? line : stripTrailingRating(line);
      return { text, kind: classifyLine(text, marksOnly) };
    });
}

function rowCategoryOf(line: ReadLine | undefined): string | undefined {
  return line?.kind.kind === 'row' ? line.kind.category : undefined;
}

function readLines(lines: string[], collector: CategoryCollector, marksOnly: boolean): void {
  const read = toReadLines(lines, marksOnly);
  read.forEach(({ text, kind }, i) => {
    if (!CATEGORY_MARK.test(text) && collector.joinItemTail(text)) return;
    // A bare mark or number ("■", "1.") names nothing; keep the current category
    if (kind.kind === 'category') {
      const rowCategory = rowCategoryOf(read[i - 1]);
      if (rowCategory !== undefined && collector.joinCategoryTail(rowCategory, kind.name, rowCategoryOf(read[i + 1]))) return;
      if (kind.name) collector.setCategory(kind.name);
    } else if (kind.kind === 'row') {
      collector.setCategory(kind.category);
      collector.add(kind.text);
    } else if (kind.text) {
      collector.add(kind.text);
    }
  });
}

/** Every row starts with a number, all different, followed by at least two more cells. */
function startsWithDistinctNumbers(rows: string[][]): boolean {
  const firsts = rows.map((cells) => cells[0]);
  return (
    rows.length > 0 &&
    rows.every((cells) => cells.length >= 3 && /^\d+$/.test(cells[0])) &&
    new Set(firsts).size === firsts.length
  );
}

/**
 * Whether the first column of the data rows is a row number ("No."): distinct numbers, then a
 * category column and an item column. Category names that happen to be numbers repeat, are left
 * blank in merged cells, or are followed by an item (a sentence in the second column) and only a
 * rating column (the third cells all ratings or blank), so they are not taken for a number column.
 * A table of numbered categories with one item each and a remark column is indistinguishable from
 * a numbered table when the items do not end like sentences.
 */
export function hasNumberColumn(rows: string[][]): boolean {
  return (
    startsWithDistinctNumbers(rows) &&
    rows.every((cells) => !looksLikeSentence(cells[1])) &&
    !rows.every((cells) => cells[2] === '' || RATING_ONLY.test(cells[2]))
  );
}

/**
 * A cell Excel wrapped in quotes because it holds a line break, a tab or a quote:
 * it starts a row or follows a tab, and ends at a tab, a line break or the end of the text.
 */
const QUOTED_CELL = /(^|[\t\n])"((?:[^"]|"")*)"(?=[\t\r\n]|$)/g;

/**
 * Unwraps quoted cells so that a line break or a tab inside a cell does not split the row or the cell;
 * broken lines are joined and a tab becomes a space.
 */
export function unquoteCells(text: string): string {
  return text.replace(QUOTED_CELL, (_, lead: string, body: string) =>
    lead + body.replace(/""/g, '"').replace(/\r\n|\r|\n/g, '').replace(/\t/g, ' '),
  );
}

function readTable(lines: string[], collector: CategoryCollector, marksOnly: boolean): void {
  const rows = lines.map((line) => (line.includes('\t') ? line.split('\t').map(normalizeLine) : null));
  const isHeaderRow = (cells: string[]) => cells.some(isHeaderWord);
  const dataRows = rows.filter(
    (cells): cells is string[] => cells !== null && !isHeaderRow(cells) && cells.some((cell) => cell !== ''),
  );
  const skip = hasNumberColumn(dataRows) ? 1 : 0;

  lines.forEach((line, i) => {
    const cells = rows[i];
    // A line without cells (a title, or text typed in by hand) is read like recognised text
    if (!cells) return readLines([line], collector, marksOnly);
    if (isHeaderRow(cells)) return;
    const [category = '', item = ''] = cells.slice(skip);
    // An empty category cell continues the category above (merged cells)
    if (category) collector.setCategory(category);
    if (item) collector.add(item);
  });
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
  if (detectTextFormat(text) === 'table') {
    const lines = toLines(unquoteCells(text));
    readTable(lines, collector, hasMarkedLine(lines));
  } else {
    const lines = toLines(text);
    readLines(lines, collector, hasMarkedLine(lines));
  }
  return collector.result();
}
