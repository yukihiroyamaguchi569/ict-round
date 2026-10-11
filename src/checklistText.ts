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
 * "…配置してい" and "る．", or "…定期的に交換" and "されている", as two lines.
 */
export const WRAP_TAIL_MAX_LENGTH = 8;

/**
 * A subheading after a Roman numeral, a letter or a dot ("Ⅳ 擦式アルコール手指消毒剤による手洗い") is a
 * category up to this many characters, longer than a bare category name: the numeral already marks it.
 */
export const SUBHEADING_MAX_LENGTH = 40;

/** A row's head needs this many characters: a single one is picked up from a vertical category column ("フ"). */
const ROW_HEAD_MIN_LENGTH = 2;

/** Header cells of a checklist table, e.g. the report's "ジャンル | チェック項目 | 評価". */
const HEADER_WORDS = new Set([
  'ジャンル', 'カテゴリ', 'カテゴリー', 'カテゴリ名', '分類', '区分', '大項目',
  'チェック項目', '点検項目', '確認項目', '項目', '内容', '評価', '判定', '結果', '備考', 'no', 'no.', '番号',
  'category', 'description', 'item', 'items', 'rating', 'コメント', '根拠',
]);

/**
 * Fill-in fields and the rating legend at the top of a form. Only dropped as recognised lines: in a table
 * they can be real cells (a "部署" category, a "できている" item).
 */
const FORM_WORDS = new Set([
  '場所', '部署', '施設名', '評価日', '評価者', '点検者', '点検日', '記入者', '日付',
  'できている', 'できていない', '該当なし', 'na', 'n/a',
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

/** Page number lines: "3", "- 3 -", "3/5", "P.3", "3ページ", "（3）". */
const PAGE_NUMBERS = [
  /^[-－]?\s*\d+\s*[-－]?$/,
  /^\d+\s*[/／]\s*\d+$/,
  /^p\.?\s*\d+$/i,
  /^\d+\s*(?:ページ|頁)$/,
  /^（\d+）$/,
];

/** Marks at the start of a line that make it a category: ■ □ ● ◆ ◇ 【 # */
const CATEGORY_MARK = /^[■□●◆◇【#＃]+\s*/;
/**
 * A bullet at the start of a line: "・ " ("•" is tidied to "・"). Not a category mark: Live Text also reads
 * a list bullet or a misread "1." as one.
 */
const BULLET_MARK = /^・\s+/;
/** A heading number at the start of a line: "1." "1．" "1、" "1)" "(1)" "（1）" "①" "A." "D．". */
const HEADING_NUMBER = /^(?:\d+[.．、)）]|[(（]\d+[)）]|[①-⑳]|[A-ZＡ-Ｚ][.．])\s*/;
/** A lettered section heading: "A." "D．". */
const LETTER_HEADING = /^[A-ZＡ-Ｚ][.．]/;
/** A Roman numeral heading with a space or a delimiter after it: "Ⅳ " "IV " "Ⅱ．" (Live Text reads "Ⅰ" as "I"). */
const ROMAN_HEADING = /^(?:[Ⅰ-Ⅻ]|VIII|VII|VI|IV|IX|III|II|I|V|X)(?:\s+|[.．、]\s*)/;
/**
 * A number column without delimiters: "91 点滴の…", with a star for a key item stuck to it ("109★ 化学…").
 * A star after a space ("108 ★ 給水…") stays with the item.
 */
const ROW_NUMBER = /^\d+[★☆]?\s+/;
/** A row number stuck to kana: "9パータオルを…", the middle line of an item wrapped over three lines. */
const GLUED_ROW_NUMBER = /^\d+(?=[\u3040-\u30ff])/;
/** A dot without a space before a subheading: "・共通項目" ("•" is tidied to "・"). */
const DOT_HEADING = /^・(?=\S)/;

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

/** A word as looked up in the word sets: lower case, without a colon after a label ("施設名："). */
function toLookupWord(word: string): string {
  return word.trim().toLowerCase().replace(/[：:]$/, '');
}

/** A table header word. */
function isHeaderWord(word: string): boolean {
  return HEADER_WORDS.has(toLookupWord(word));
}

/** A header word or a fill-in field / legend word. */
function isHeaderOrFormWord(word: string): boolean {
  return isHeaderWord(word) || FORM_WORDS.has(toLookupWord(word));
}

/**
 * Lines that carry no checklist content: headers, fill-in fields, rating marks and their legend, page numbers.
 * Words are split at spaces and at "・" ("評価・できている"), so "汚物室・トイレ" stays.
 */
export function isNoiseLine(line: string): boolean {
  if (PAGE_NUMBERS.some((re) => re.test(line))) return true;
  return line.split(/[ ・]/).every((word) => isHeaderOrFormWord(word) || RATING_ONLY.test(word));
}

/** Removes a rating left at the end of an item line ("…いる． A" → "…いる．"). */
export function stripTrailingRating(line: string): string {
  const spaced = line.replace(RATING_AFTER_SENTENCE, '$1').replace(RATING_AFTER_SPACE, '').trim();
  const glued = spaced.replace(RATING_AFTER_JAPANESE, '$1');
  return looksLikeSentence(glued) ? glued : spaced;
}

/** A particle before a comma: the sentence goes on in the next line ("…記録がない場合は、" then "清掃担当…"). */
const PARTICLE_COMMA_END = /[のがをにとはでもへや][、，,]$/;

/**
 * Whether text ends like a sentence (full stop or predicate), as checklist items do. A comma after a
 * particle ("…場合は、") is a pause inside a sentence, not a full stop read as a comma.
 */
function looksLikeSentence(text: string): boolean {
  return (SENTENCE_END.test(text) && !PARTICLE_COMMA_END.test(text)) || ITEM_ENDING.test(text);
}

/** Text that stops in the middle of a word, as the first line of a wrapped item does: "…配置してい". */
const OPEN_ENDING = /[\u3040-\u30ff\u3400-\u9fffA-Za-z0-9０-９]$/;
/** The tail of a wrapped item starts with Japanese text, so a bare number ("1.") is never taken for one. */
const TAIL_START = /^[\u3040-\u30ff\u3400-\u9fff]/;
/** Hiragana at the start of a line: a verb ending cut off its noun ("交換" then "されている"). */
const HIRAGANA_START = /^[\u3040-\u309f]/;
/** Hiragana at the end of an item: the item stops inside a verb ending ("…配置してい"). */
const HIRAGANA_END = /[\u3040-\u309f]$/;

/**
 * How a wrapped tail ends: with a full stop (or a comma read in its place), or with a predicate ending
 * that carries on a noun ("…交換" then "されている"). An item that already stops inside a verb ending
 * ("…配置してい") needs the full stop, so "いる" or an item of its own ("確認する") is not glued on.
 */
function endsLikeTail(item: string, line: string): boolean {
  if (SENTENCE_END.test(line)) return true;
  return ITEM_ENDING.test(line) && HIRAGANA_START.test(line) && !HIRAGANA_END.test(item);
}

/**
 * Whether a line is the rest of the item above, wrapped in its table cell ("…してい" then "る．"):
 * the item fills its cell (longer than a category name) and stops mid-word, and the line is short,
 * starts with Japanese text and ends like a tail (see endsLikeTail). Two short items
 * ("清掃を実施", "確認する"), or a long one and a short one of its own, stay apart.
 */
export function isWrappedItemTail(item: string, line: string): boolean {
  return (
    item.length > CATEGORY_MAX_LENGTH &&
    OPEN_ENDING.test(item) &&
    !looksLikeSentence(item) &&
    line.length <= WRAP_TAIL_MAX_LENGTH &&
    TAIL_START.test(line) &&
    endsLikeTail(item, line)
  );
}

/** Opening minus closing brackets: above 0 the text leaves a bracket open, below 0 it closes one opened before. */
export function bracketDepth(text: string): number {
  return (text.match(/[（(]/g)?.length ?? 0) - (text.match(/[）)]/g)?.length ?? 0);
}

/** A particle at the end of a line: the sentence goes on in the next line ("…チェックが" then "行われている"). */
const PARTICLE_END = /[のがをにとはでもへや]$/;
/**
 * The start of a line that cannot start an item: a particle, a long vowel mark, a small kana,
 * a closing bracket or a comma ("の適正手技…", "ーション、…", "ル）暴露対策…" after "…フタラー").
 */
const CONTINUATION_START = /^[のがをにとはでもへやーぁぃぅぇぉっゃゅょァィゥェォッャュョ）)、，,]/;
/** A particle that starts the next line of an unfinished item ("…手指" then "から手全体…"); "から拭き" can start one. */
const PARTICLE_START = /^から/;

/**
 * Whether a line goes on from the item above rather than starting an item:
 * the item is unfinished (a bracket left open, or a particle at the end, also before a comma), unless both
 * start with a heading number (a numbered list, where Live Text may have dropped a closing bracket); or the
 * line starts like a continuation (or with "から" after an item that does not end like a sentence), or
 * closes a bracket it did not open; or it is a short wrapped tail.
 */
export function continuesItem(item: string, line: string, bothNumbered: boolean): boolean {
  const unfinished = bracketDepth(item) > 0 || PARTICLE_END.test(item) || PARTICLE_COMMA_END.test(item);
  if (unfinished && !bothNumbered) return true;
  if (PARTICLE_START.test(line) && !looksLikeSentence(item)) return true;
  return CONTINUATION_START.test(line) || bracketDepth(line) < 0 || isWrappedItemTail(item, line);
}

/** An item ending with a closed bracket ("…検査（1日1回）") is complete. */
const CLOSED_BRACKET_END = /[）)]$/;

/**
 * Whether a line starting with a row number goes on from the item above. The number column is centred in
 * its cell, so a wrapped item has its number on the second or middle line ("…適切に配" then "1 置している").
 * Not after an item that ends like a sentence or with a closed bracket, nor after one that started with a
 * heading number ("③…を行う" then "106 廃棄物は…"): a new number in a numbered list starts a new item.
 */
export function rowNumberContinues(item: string, itemNumbered: boolean): boolean {
  return !itemNumbered && !looksLikeSentence(item) && !CLOSED_BRACKET_END.test(item);
}

/** Whether a piece of text reads as a category name: short, and not ending like a sentence. */
export function looksLikeCategory(text: string): boolean {
  return text.length <= CATEGORY_MAX_LENGTH && !looksLikeSentence(text);
}

/** A row's item says whether it started with a heading number ("外来処置室 1）…"). */
export type LineKind =
  | { kind: 'category'; name: string }
  | { kind: 'item'; text: string }
  | { kind: 'row'; category: string; text: string; numbered: boolean };

/** Whether a line, without a bullet, starts with a heading number. */
function startsWithNumber(line: string): boolean {
  return HEADING_NUMBER.test(line.replace(BULLET_MARK, ''));
}

/**
 * Splits "短い語 文" (a table row read as one line) into a category and an item, if it has that shape.
 * The item's heading number is dropped. Only split when the item starts with a number or the line's
 * brackets are balanced, so the first line of a wrapped item ("個人用防護具 Personal … （手") stays whole.
 */
function splitRow(line: string): LineKind | null {
  const space = line.indexOf(' ');
  if (space < 0) return null;
  const head = line.slice(0, space);
  if (head.length < ROW_HEAD_MIN_LENGTH) return null;
  const rest = line.slice(space + 1).trim();
  const text = rest.replace(HEADING_NUMBER, '');
  const numbered = text !== rest;
  if (!numbered && bracketDepth(line) !== 0) return null;
  if (!looksLikeCategory(head) || looksLikeCategory(text)) return null;
  return { kind: 'row', category: head, text, numbered };
}

/** Whether text reads as a subheading name after a numeral or a dot: not too long, not a sentence. */
function isSubheadingName(text: string): boolean {
  return text !== '' && text.length <= SUBHEADING_MAX_LENGTH && !looksLikeSentence(text);
}

/**
 * The name of a subheading: a dot without a space ("・共通項目"), read in both modes, or (without marks) a
 * Roman numeral or a letter ("Ⅳ 擦式…", "A.病棟"), when the rest reads as a subheading name. Null otherwise.
 */
function subheadingName(line: string, marksOnly: boolean): string | null {
  let name: string | null = null;
  if (DOT_HEADING.test(line)) name = line.slice(1);
  else if (!marksOnly && LETTER_HEADING.test(line)) name = line.replace(HEADING_NUMBER, '');
  else if (!marksOnly && ROMAN_HEADING.test(line)) name = line.replace(ROMAN_HEADING, '');
  return name !== null && isSubheadingName(name) ? name : null;
}

/**
 * Classifies one normalised, non-noise line of recognised text. A subheading ("・共通項目", "Ⅰ 全般") is a
 * category. Otherwise a bullet ("・ "), a row number ("91 ") and then a heading number are dropped first.
 * A marked line ("■") is a row if it splits into one, otherwise a category.
 * With marksOnly (the text has marked lines, so the user has said which lines are categories)
 * every other line is an item. Otherwise the line is guessed by its shape: a row, a short category
 * name, or an item.
 */
export function classifyLine(line: string, marksOnly = false): LineKind {
  if (CATEGORY_MARK.test(line)) {
    const name = line.replace(CATEGORY_MARK, '').replace(/】/g, ' ').trim().replace(HEADING_NUMBER, '');
    return splitRow(name) ?? { kind: 'category', name };
  }
  const subheading = subheadingName(line, marksOnly);
  if (subheading !== null) return { kind: 'category', name: subheading };
  const body = line.replace(BULLET_MARK, '').replace(ROW_NUMBER, '').replace(HEADING_NUMBER, '').replace(ROMAN_HEADING, '');
  if (marksOnly) return { kind: 'item', text: body };
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
  /** Whether the item just added started with a heading number. */
  private lastItemNumbered = false;

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

  add(text: string, numbered: boolean): void {
    this.lastItem = { key: newKey(), description: text };
    this.lastItemNumbered = numbered;
    this.categoryNamed(this.current).items.push(this.lastItem);
  }

  /**
   * Joins a line (without its heading or row number) to the item just added when it goes on from it; false
   * otherwise. rowNumbered: the line started with a row number ("1 置している"); then rowNumberContinues alone
   * decides, so a numbered line after a numbered item ending with a particle still starts a new item.
   */
  joinItemTail(line: string, numbered: boolean, rowNumbered: boolean): boolean {
    if (!this.lastItem) return false;
    const item = this.lastItem.description;
    const goesOn = rowNumbered
      ? rowNumberContinues(item, this.lastItemNumbered)
      : continuesItem(item, line, numbered && this.lastItemNumbered);
    if (!goesOn) return false;
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
  /** Whether the line (or a row's item) starts with a heading number. */
  numbered: boolean;
  /** Whether the line starts with a row number, spaced ("1 置している") or stuck to kana ("9パータオル…"). */
  rowNumbered: boolean;
}

function toReadLines(lines: string[], marksOnly: boolean): ReadLine[] {
  return lines
    .filter((line) => !isNoiseLine(line))
    .map((line) => {
      // A marked line is a category name, so a trailing letter there ("■ 病棟 A") is not a rating
      const text = CATEGORY_MARK.test(line) ? line : stripTrailingRating(line);
      const kind = classifyLine(text, marksOnly);
      const numbered = startsWithNumber(text) || (kind.kind === 'row' && kind.numbered);
      return { text, kind, numbered, rowNumbered: ROW_NUMBER.test(text) || GLUED_ROW_NUMBER.test(text) };
    });
}

/**
 * The text a line would add to the item above: an item's text (without a row number stuck to it) or a
 * category name, without the heading number. A row keeps its own category, and a marked, bulleted or
 * subheading line ("・共通項目", "Ⅰ 全般") was marked as a new entry.
 */
function joinableText({ text, kind }: ReadLine): string {
  if (CATEGORY_MARK.test(text) || BULLET_MARK.test(text)) return '';
  if (kind.kind === 'item') return kind.text.replace(GLUED_ROW_NUMBER, '');
  if (kind.kind !== 'category' || subheadingName(text, false) !== null) return '';
  return kind.name.replace(GLUED_ROW_NUMBER, '');
}

function rowCategoryOf(line: ReadLine | undefined): string | undefined {
  return line?.kind.kind === 'row' ? line.kind.category : undefined;
}

function readLines(lines: string[], collector: CategoryCollector, marksOnly: boolean): void {
  const read = toReadLines(lines, marksOnly);
  read.forEach((line, i) => {
    const { kind, numbered, rowNumbered } = line;
    // A short row ("薬品 有．") or a marked line keeps its category; a bare number ("17.") joins nothing
    const joinable = joinableText(line);
    if (joinable && collector.joinItemTail(joinable, numbered, rowNumbered)) return;
    // A bare mark or number ("■", "1.") names nothing; keep the current category
    if (kind.kind === 'category') {
      const rowCategory = rowCategoryOf(read[i - 1]);
      if (rowCategory !== undefined && collector.joinCategoryTail(rowCategory, kind.name, rowCategoryOf(read[i + 1]))) return;
      if (kind.name) collector.setCategory(kind.name);
    } else if (kind.kind === 'row') {
      collector.setCategory(kind.category);
      collector.add(kind.text, kind.numbered);
    } else if (kind.text) {
      collector.add(kind.text, numbered);
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
    if (item) collector.add(item, false);
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
