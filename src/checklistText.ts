import { newKey, type DraftCategory, type DraftItem } from './checklistEditor';
import {
  DIGIT,
  ITEM_ENDING,
  PARTICLE_COMMA_END,
  RATING_ONLY,
  SENTENCE_END,
  dropNotes,
  isHeaderWord,
  isNoiseLine,
  looksLikeSentence,
  normalizeLine,
  stripItemFields,
  stripTrailingRating,
  stripTrailingRemark,
} from './checklistTextLines';

export { isNoiseLine, normalizeLine, stripAnswerColumn, stripTrailingRating, stripTrailingRemark } from './checklistTextLines';

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


/** Marks at the start of a line that make it a category: ■ □ ● ◆ ◇ 【 # */
const CATEGORY_MARK = /^[■□●◆◇【#＃]+\s*/;
/** A label in brackets with text after it ("【入所系】高齢者施設等…"): part of the line, not a mark. */
const LABEL_BEFORE_TEXT = /^【[^】]*】\s*\S/;
/** A label in brackets at the start of a line, left out of the title's length. */
const LEADING_LABEL = /^【[^】]*】/;
/**
 * A check box with a space after it: "☐ " "✓ ", or "□" misread as "口 " / "ロ ". Stuck to the text ("口換気扇…")
 * it is left: "口腔ケア" and "ロッカー" start the same way. "□ " and "■ " are category marks (see isCheckBoxRest).
 */
const CHECK_BOX = /^[☐☑✓✔口ロ]\s+/;
/** A marked line longer than this is a check box when the rest is a sentence of any kind (see isCheckBoxRest). */
const MARKED_HEADING_MAX_LENGTH = 40;
/** A comma inside a line: a category name has none. */
const COMMA = /[、，,]/;
/**
 * A heading number stuck to a name starting with a kanji: "2手洗い", "3排泄ケア（おむつ交換を含む）". A unit after
 * the number ("15秒以上…", "3階") is part of an item, and a number stuck to kana is a row number (GLUED_ROW_NUMBER).
 */
const GLUED_HEADING_NUMBER = new RegExp(`^${DIGIT}+(?=[\u3400-\u9fff])`);
const UNIT_START = /^[秒分時日月年回階人名本枚個台件]/;
/** The title of a form: "…チェックリスト", "…点検表", also with a bracket after it ("…チェックリスト（職員向け）"). */
const TITLE = /(?:チェックリスト|チェックシート|チェック表|点検表|点検票|管理票|項目表|一覧表|一覧)(?:[（(][^（()）]*[)）])?$/;
/**
 * A bullet at the start of a line: "・ " ("•" is tidied to "・"). Not a category mark: Live Text also reads
 * a list bullet or a misread "1." as one.
 */
const BULLET_MARK = /^・\s+/;
/** A katakana sub-number: "ア." "イ．" "ウ、" "エ，", or one before a bracket ("ア（"). Not a word ("アルコール"). */
const KATAKANA_NUMBER = '[アイウエオカキクケコ](?:[.．、，]|(?=[（(]))';
/**
 * A heading number at the start of a line: "1." "1．" "1、" "1)" "(1)" "（1）" "①" "A." "D．", a section number
 * before a space ("1ー3 ", "1-4 "), and a katakana sub-number, also after one of these ("(1)ア.").
 */
const HEADING_NUMBER = new RegExp(
  `^(?:(?:${DIGIT}+[.．、)）]|[(（]${DIGIT}+[)）]|[①-⑳]|[A-ZＡ-Ｚ][.．]|${DIGIT}+[-－ー‐]${DIGIT}+(?=\\s))\\s*(?:${KATAKANA_NUMBER})?|${KATAKANA_NUMBER})\\s*`,
);
/** A lettered section heading: "A." "D．", or a letter before a space ("C 院内組織体制"). */
const LETTER_HEADING = /^[A-ZＡ-Ｚ](?:[.．]|\s+)/;
/** A Roman numeral heading with a space or a delimiter after it: "Ⅳ " "IV " "Ⅱ．" (Live Text reads "Ⅰ" as "I"). */
const ROMAN_HEADING = /^(?:[Ⅰ-Ⅻ]|VIII|VII|VI|IV|IX|III|II|I|V|X)(?:\s+|[.．、]\s*)/;
/**
 * A number column without delimiters: "91 点滴の…", with a star for a key item stuck to it ("109★ 化学…").
 * A star after a space ("108 ★ 給水…") stays with the item.
 */
const ROW_NUMBER = new RegExp(`^${DIGIT}+[★☆]?\\s+`);
/** A row number stuck to kana: "9パータオルを…", the middle line of an item wrapped over three lines. */
const GLUED_ROW_NUMBER = new RegExp(`^${DIGIT}+(?=[\u3040-\u30ff])`);
/** A dot without a space before a subheading: "・共通項目" ("•" is tidied to "・"). */
const DOT_HEADING = /^・(?=\S)/;




/** Text that stops in the middle of a word, as the first line of a wrapped item does: "…配置してい". */
const OPEN_ENDING = /[\u3040-\u30ff\u3400-\u9fffA-Za-z0-9０-９]$/;
/** The tail of a wrapped item starts with Japanese text, so a bare number ("1.") is never taken for one. */
const TAIL_START = /^[\u3040-\u30ff\u3400-\u9fff]/;
/** Hiragana at the start of a line: a verb ending cut off its noun ("交換" then "されている"). */
const HIRAGANA_START = /^[\u3040-\u309f]/;

/**
 * How a wrapped tail ends: with a full stop (or a comma read in its place), or with a predicate ending
 * starting in hiragana ("…交換" then "されている", "…配置され" then "ている"). An item of its own starts
 * with its noun ("確認する").
 */
function endsLikeTail(line: string): boolean {
  if (SENTENCE_END.test(line)) return true;
  return ITEM_ENDING.test(line) && HIRAGANA_START.test(line);
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
    endsLikeTail(line)
  );
}

/** Opening minus closing brackets: above 0 the text leaves a bracket open, below 0 it closes one opened before. */
export function bracketDepth(text: string): number {
  return (text.match(/[（(]/g)?.length ?? 0) - (text.match(/[）)]/g)?.length ?? 0);
}

/**
 * A particle at the end of a line: the sentence goes on in the next line ("…チェックが" then "行われている",
 * "…共同して" then "行っている。"). "…について" ends a heading-like line more often than it wraps.
 */
const PARTICLE_END = /[のがをにとはでもへや]$|(?<!につい)て$/;
/**
 * The start of a line that cannot start an item: a particle, a long vowel mark, a small kana,
 * a closing bracket or a comma ("の適正手技…", "ーション、…", "ル）暴露対策…" after "…フタラー").
 */
const CONTINUATION_START = /^[のがをにとはでもへやーぁぃぅぇぉっゃゅょァィゥェォッャュョ）)、，,]/;
/** A particle that starts the next line of an unfinished item ("…手指" then "から手全体…"); "から拭き" can start one. */
const PARTICLE_START = /^から/;
/** The "か" of a question cut off its predicate ("…行われている" then "か定期的に確認し…"), before a kanji or a comma. */
const QUESTION_START = /^か(?=[\u3400-\u9fff、，,])/;
/** A katakana word cut at the end of a line ("…ディスポーザブ" then "ル製品を…"). */
const KATAKANA_END = /[\u30a1-\u30fc]$/;
const KATAKANA_START = /^[\u30a1-\u30fa]/;

/**
 * Whether a line starts with a particle cut off the item above: "から" after an item that does not end like a
 * sentence, or the "か" of a question after a predicate ("…行われている" then "か定期的に…").
 */
function startsWithCutParticle(item: string, line: string): boolean {
  if (PARTICLE_START.test(line)) return !looksLikeSentence(item);
  return QUESTION_START.test(line) && ITEM_ENDING.test(item);
}

/** A katakana word wrapped over two lines: an unfinished item that filled its cell ends in katakana, the line starts in it. */
function continuesKatakana(item: string, line: string): boolean {
  return item.length > CATEGORY_MAX_LENGTH && !looksLikeSentence(item) && KATAKANA_END.test(item) && KATAKANA_START.test(line);
}

/**
 * Whether a line goes on from the item above rather than starting an item:
 * the item is unfinished (a bracket left open, or a particle at the end, also before a comma), unless both
 * start with a heading number (a numbered list, where Live Text may have dropped a closing bracket); or the
 * line starts like a continuation (or with a particle cut off the item, see startsWithCutParticle), or
 * closes a bracket it did not open; or it is a short wrapped tail or the rest of a katakana word.
 */
export function continuesItem(item: string, line: string, bothNumbered: boolean): boolean {
  const unfinished = bracketDepth(item) > 0 || PARTICLE_END.test(item) || PARTICLE_COMMA_END.test(item);
  if (unfinished && !bothNumbered) return true;
  if (startsWithCutParticle(item, line)) return true;
  if (continuesKatakana(item, line)) return true;
  return CONTINUATION_START.test(line) || bracketDepth(line) < 0 || isWrappedItemTail(item, line);
}

/** A verb's joining form before a comma at the end of a line: "…研修を実施し、". */
const JOINING_COMMA_END = /し[、，,]$/;
/** Text in brackets, left out when looking for a comma between clauses ("物資（マスク、ガウン）の確保" has none). */
const BRACKETED = /[（(][^（()）]*[)）]/g;
/** A full stop inside a line: the item already holds a sentence ("…湿式清掃を行う。手指が…ベッド"). */
const INNER_FULL_STOP = /[。．]./;

/** Whether a numbered item stops mid-sentence: mid-word ("…目的とした改") or after a verb's joining form ("…実施し、"). */
function stopsMidSentence(item: string): boolean {
  return (OPEN_ENDING.test(item) && !looksLikeSentence(item)) || JOINING_COMMA_END.test(item);
}

/**
 * Whether an unnumbered sentence goes on from a numbered item above that stopped mid-sentence (see
 * stopsMidSentence): the item is longer than a category name, has a comma between clauses (a heading has none, see
 * isNumberedHeading) and no full stop inside ("④…推進を目的とした改" then "善のための方策を実施していますか。",
 * "A. …規則または規" then "格に従っている", "②…研修を実施し、" then "実施記録…を残していますか。").
 */
export function continuesNumberedItem(item: string, line: string): boolean {
  return (
    item.length > CATEGORY_MAX_LENGTH &&
    COMMA.test(item.replace(BRACKETED, '')) &&
    !INNER_FULL_STOP.test(item) &&
    stopsMidSentence(item) &&
    TAIL_START.test(line) &&
    looksLikeSentence(line)
  );
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

/** A note in brackets at the end of a line: "（推奨）", "（おむつ交換を含む）". */
const TRAILING_NOTE = /[（(][^（()）]*[)）]$/;

/**
 * Whether a piece of text reads as a category name: short, and not ending like a sentence, also before a
 * note in brackets ("用している（推奨）" is the end of an item).
 */
export function looksLikeCategory(text: string): boolean {
  return text.length <= CATEGORY_MAX_LENGTH && !endsLikeSentence(text);
}

/** Whether text ends like a sentence, also before a note in brackets ("用している（推奨）"). */
function endsLikeSentence(text: string): boolean {
  return looksLikeSentence(text) || looksLikeSentence(text.replace(TRAILING_NOTE, ''));
}

/** Whether a line starts with a category mark ("■手指衛生", "【手指衛生】"), not with a label before text ("【入所系】…"). */
function hasCategoryMark(line: string): boolean {
  return CATEGORY_MARK.test(line) && !LABEL_BEFORE_TEXT.test(line);
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
  else if (!marksOnly && LETTER_HEADING.test(line)) name = line.replace(LETTER_HEADING, '').trim();
  else if (!marksOnly && ROMAN_HEADING.test(line)) name = line.replace(ROMAN_HEADING, '');
  return name !== null && isSubheadingName(name) ? name : null;
}

/**
 * Whether the rest of a marked line is an item behind a check box ("■" read for "□"), not a category name:
 * longer than a category name and a sentence (also before a rating or a note in brackets: "…している（推奨）"),
 * or with a comma, or longer than any heading. A remark column after the sentence ("…しているか。 汚染防止") is
 * left out of the sentence check.
 */
function isCheckBoxRest(rest: string): boolean {
  if (rest.length <= CATEGORY_MAX_LENGTH) return false;
  const sentence = stripTrailingRemark(stripTrailingRating(rest));
  return endsLikeSentence(sentence) || COMMA.test(rest) || rest.length > MARKED_HEADING_MAX_LENGTH;
}

/** The rest of a marked line, without the mark, a closing "】" and a heading number. */
function markedRest(line: string): string {
  return line.replace(CATEGORY_MARK, '').replace(/】/g, ' ').trim().replace(HEADING_NUMBER, '');
}

/** The rest of a marked line as a row whose item has a heading number ("病室 1）…"), which no check box is before; or null. */
function numberedRow(rest: string): LineKind | null {
  const row = splitRow(rest);
  return row?.kind === 'row' && row.numbered ? row : null;
}

/**
 * Whether a line is marked as a category or a row by the user ("■手指衛生"), not a check box before an item.
 * The check box is told before an unnumbered row, so a sentence behind it that splits like one
 * ("■ 必要時 …している。") marks nothing.
 */
function isMarkedHeading(line: string): boolean {
  if (!hasCategoryMark(line)) return false;
  const rest = markedRest(line);
  return numberedRow(rest) !== null || !isCheckBoxRest(rest);
}

/**
 * The name of a heading with its number stuck to it ("2手洗い" → "手洗い", "4感染症予防のための環境整備について"),
 * up to a subheading's length, or null.
 */
function gluedHeadingName(line: string): string | null {
  if (!GLUED_HEADING_NUMBER.test(line)) return null;
  const name = line.replace(GLUED_HEADING_NUMBER, '');
  return UNIT_START.test(name) || name.length > SUBHEADING_MAX_LENGTH || endsLikeSentence(name) ? null : name;
}

/** Whether a line is the title of the form ("…チェックリスト"), counted without a leading label ("【入所系】"). */
function isTitle(line: string): boolean {
  return line.replace(LEADING_LABEL, '').length <= SUBHEADING_MAX_LENGTH && TITLE.test(line);
}

/** A whole line in title brackets: "«…»", "≪…≫", "「…」", "『…』". */
const TITLE_BRACKETS = /^(?:«(.+)»|≪(.+)≫|「(.+)」|『(.+)』)$/;

/** The title of the form, without title brackets around it ("«…チェックリスト»" → "…チェックリスト"), or null. */
function titleName(line: string): string | null {
  const match = TITLE_BRACKETS.exec(line);
  const name = match ? match.slice(1).find((group) => group !== undefined) ?? '' : line;
  return isTitle(name) ? name : null;
}

/**
 * A marked line ("■"): a row whose item has a heading number; else, if the mark is a check box, the rest read
 * as in the marks-only mode (an item, never split into a row); else a row if it splits into one, else a category.
 */
function classifyMarkedLine(line: string): LineKind {
  const name = markedRest(line);
  const numbered = numberedRow(name);
  if (numbered) return numbered;
  if (isCheckBoxRest(name)) return classifyLine(stripTrailingRemark(name), true);
  return splitRow(name) ?? { kind: 'category', name };
}

/**
 * Classifies one normalised, non-noise line of recognised text. A check box ("口 ", "ロ ", or "■" before an
 * item, see isCheckBoxRest) is dropped and the rest is classified; behind "■" the whole rest is an item. A subheading ("・共通項目", "Ⅰ 全般") is a
 * category. Otherwise a bullet ("・ "), a row number ("91 ") and then a heading number are dropped first.
 * Any other marked line ("■") is a row if it splits into one, otherwise a category.
 * With marksOnly (the text has marked lines, so the user has said which lines are categories)
 * every other line is an item. Otherwise the line is guessed by its shape: a row, the form's title, a
 * heading with its number stuck to it ("2手洗い"), a short category name, or an item.
 */
export function classifyLine(line: string, marksOnly = false): LineKind {
  if (CHECK_BOX.test(line)) return classifyLine(line.replace(CHECK_BOX, ''), marksOnly);
  if (hasCategoryMark(line)) return classifyMarkedLine(line);
  const subheading = subheadingName(line, marksOnly);
  if (subheading !== null) return { kind: 'category', name: subheading };
  const body = line.replace(BULLET_MARK, '').replace(ROW_NUMBER, '').replace(HEADING_NUMBER, '').replace(ROMAN_HEADING, '');
  if (marksOnly) return { kind: 'item', text: body };
  const title = titleName(body);
  if (title !== null) return { kind: 'category', name: title };
  const row = splitRow(body);
  if (row) return row;
  const glued = gluedHeadingName(body);
  if (glued !== null) return { kind: 'category', name: glued };
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
      : continuesItem(item, line, numbered && this.lastItemNumbered) ||
        (this.lastItemNumbered && !numbered && continuesNumberedItem(item, line));
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

/**
 * Whether the user marked any line as a category ("■手指衛生"); a bare mark ("■") names nothing, and a check
 * box before an item ("■必要に応じて、…") marks no category. Lines are checked without the columns printed beside
 * items (see stripItemFields), as they are read, so an answer-only line ("□はい □いいえ") marks nothing. A "【x】" followed by text marks
 * nothing either: a label in brackets is common in a form's title ("【入所系】…チェックリスト"). A line of
 * "【x】" alone ("【手指衛生】") still marks a category.
 */
function hasMarkedLine(lines: string[]): boolean {
  return lines
    .map(stripItemFields)
    .some((line) => !LABEL_BEFORE_TEXT.test(line) && isMarkedHeading(line) && line.replace(CATEGORY_MARK, '') !== '');
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

function toReadLine(line: string, marksOnly: boolean): ReadLine {
  // A marked line is a category name, so a trailing letter there ("■ 病棟 A") is not a rating. A check box
  // ("■" before an item) keeps its remark here: the remark counts in its length, and classifyLine drops it
  const unrated = isMarkedHeading(line) ? line : stripTrailingRating(line);
  const text = hasCategoryMark(unrated) ? unrated : stripTrailingRemark(unrated);
  const kind = classifyLine(text, marksOnly);
  const numbered = startsWithNumber(text) || (kind.kind === 'row' && kind.numbered);
  return { text, kind, numbered, rowNumbered: ROW_NUMBER.test(text) || GLUED_ROW_NUMBER.test(text) };
}

/**
 * Whether a numbered item line is a heading: "1）職員の感染防止に関する意識の徹底" names its items when the rest
 * is a subheading name and the next line is an unnumbered sentence of its own ("…行動を取っている"). Before
 * another numbered line, or a line that does not end like a sentence, the line keeps its shape.
 */
function isNumberedHeading(line: ReadLine, next: ReadLine | undefined): boolean {
  if (line.kind.kind !== 'item' || !line.numbered || !isSubheadingName(line.kind.text)) return false;
  if (next?.kind.kind !== 'item' || next.numbered || next.rowNumbered) return false;
  const name = line.kind.text;
  return looksLikeSentence(next.kind.text) && !continuesItem(name, next.kind.text, false) && !continuesNumberedItem(name, next.kind.text);
}

/**
 * Whether a lettered subheading ("A. 歯科特有の…利用可能") is the first line of an item: the next line is an
 * unnumbered item that goes on from it ("で最新な状態であり…").
 */
function isLetteredItem(line: ReadLine, next: ReadLine | undefined): boolean {
  if (line.kind.kind !== 'category' || !LETTER_HEADING.test(line.text)) return false;
  if (next?.kind.kind !== 'item' || next.numbered || next.rowNumbered) return false;
  return continuesItem(line.kind.name, next.kind.text, false);
}

/** A line read again with the line after it: a numbered item that is a heading, or a lettered heading that is an item. */
function rereadWithNext(line: ReadLine, next: ReadLine | undefined): ReadLine {
  if (line.kind.kind === 'item' && isNumberedHeading(line, next)) return { ...line, kind: { kind: 'category', name: line.kind.text } };
  if (line.kind.kind === 'category' && isLetteredItem(line, next)) return { ...line, kind: { kind: 'item', text: line.kind.name } };
  return line;
}

function toReadLines(lines: string[], marksOnly: boolean): ReadLine[] {
  const read = dropNotes(lines)
    .map(stripItemFields)
    .filter((line) => line !== '' && !isNoiseLine(line))
    .map((line) => toReadLine(line, marksOnly));
  if (marksOnly) return read;
  return read.map((line, i) => rereadWithNext(line, read[i + 1]));
}

/** Whether a category line names itself as a heading: a subheading ("・共通項目", "Ⅰ 全般"), a title or "2手洗い". */
function isNamedHeading(text: string): boolean {
  return subheadingName(text, false) !== null || titleName(text) !== null || gluedHeadingName(text) !== null;
}

/**
 * The text a line would add to the item above: an item's text (without a row number stuck to it) or a
 * category name, without the heading number. A row keeps its own category, and a marked, check-boxed,
 * bulleted or heading line (see isNamedHeading) was marked as a new entry.
 */
function joinableText({ text, kind }: ReadLine): string {
  if (hasCategoryMark(text) || CHECK_BOX.test(text) || BULLET_MARK.test(text)) return '';
  if (kind.kind === 'item') return kind.text.replace(GLUED_ROW_NUMBER, '');
  if (kind.kind !== 'category' || isNamedHeading(text)) return '';
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

/** A cell holding a number alone: "12", "１２". */
const NUMBER_CELL = new RegExp(`^${DIGIT}+$`);

/** Every row starts with a number, all different, followed by at least two more cells. */
function startsWithDistinctNumbers(rows: string[][]): boolean {
  const firsts = rows.map((cells) => cells[0]);
  return (
    rows.length > 0 &&
    rows.every((cells) => cells.length >= 3 && NUMBER_CELL.test(cells[0])) &&
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
