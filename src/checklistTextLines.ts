// Tidies the lines of pasted checklist text before they are classified (see checklistText.ts): which lines carry
// no content (headers, fill-in fields, page numbers), the columns a form prints beside each item (a rating, the
// answer column, a column of choices, a law reference, a remark) and notes under items; and whether text ends
// like a sentence, which both these rules and the classification rely on.

/** Header cells of a checklist table, e.g. the report's "ジャンル | チェック項目 | 評価". */
const HEADER_WORDS = new Set([
  'ジャンル', 'カテゴリ', 'カテゴリー', 'カテゴリ名', '分類', '区分', '大項目',
  'チェック項目', '点検項目', '確認項目', '項目', '内容', '評価', '判定', '結果', '備考', 'no', 'no.', '番号',
  'category', 'description', 'item', 'items', 'rating', 'コメント', '根拠', '確認事項', '対策のポイント',
  '改善箇所', '評価項目',
  // Single-character header cells read with a space inside: "項 目", "備 考"
  '項', '目', '備', '考',
]);

/**
 * Fill-in fields and the rating legend at the top of a form. Only dropped as recognised lines: in a table
 * they can be real cells (a "部署" category, a "できている" item).
 */
const FORM_WORDS = new Set([
  '場所', '部署', '施設名', '評価日', '評価者', '点検者', '点検日', '記入者', '日付',
  'できている', 'できていない', '該当なし', 'na', 'n/a',
  '検査日', '担当者名', '電話番号', '事業所番号', '施設類型', '施設所在市町村名', 'チェック欄', 'チェック', '欄',
  '自己評価', '他者評価',
]);

/** A rating cell: A / B / C (half or full width), or a mark such as ○ × △ －. */
const RATING = '(?:[ABCＡＢＣ]|[○◯〇×✕✖△▲－\\-ー―])';
export const RATING_ONLY = new RegExp(`^${RATING}$`);
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

/**
 * A "□はい □いいえ" answer column at the end of a line, read as "口はい 口いいえ", "口はいいいえ", "口はい一口いいえ"…
 */
const ANSWER_COLUMN = / ?[□■口ロ［[「]? ?はい ?[一ー]? ?[□■口ロ［[「]? ?いいえ$/;
/**
 * A rating column of choices printed at the end of each line, read as "A ・B・C・X", "A B・ C X", "…事前にA ・B・C・X":
 * two or more single capital letters separated by "・" or spaces, not following another letter.
 */
const CHOICE_COLUMN = /(?<![A-Za-zＡ-Ｚａ-ｚ]) ?[A-ZＡ-Ｚ](?:[ ・]+[A-ZＡ-Ｚ])+$/;
/** A dot left alone at the end of a heading ("1ー3 院内感染対策のための体制の確保 •"; "•" is tidied to "・"). */
const TRAILING_DOT = / ・$/;
/** Words of a law or a notice: "規則第1条の11第2項第1号", "医政発0330010", "H19.3.30". */
const LAW_WORDS = '(?:第\\d+[条項号]|規則|医政発|告示|通知|平成\\d|令和\\d|昭和\\d|[HRS]\\d+\\.\\d)';
/** A line of a law reference in brackets, with a note after it or not: "（規則第1条の11第2項第1号）※…". */
const LAW_REFERENCE_LINE = new RegExp(`^[（(][^（()）]*${LAW_WORDS}[^（()）]*[)）](?:\\s*※.*)?$`);
/** A law reference in brackets at the end of an item: "…実施していますか。（規則第1条の11第2項第1号ニ）". */
const TRAILING_LAW_REFERENCE = new RegExp(`\\s*[（(][^（()）]*${LAW_WORDS}[^（()）]*[)）]$`);
/** A note under an item: "注：…", "注:…", "注）…". */
const NOTE_START = /^注[：:）)]/;

/**
 * The end of a sentence; items usually end with one. A comma counts too: text recognised from a
 * photo often reads "．" at the end of an item as "、" or "，", and a category name never ends with one.
 */
export const SENTENCE_END = /[。．.、，,]$/;
/**
 * Predicate endings that mark an item even without a full stop: "…いる", "…ない", and after hiragana a past
 * tense ("…確認した", "…行った") or a question ("…しているか"). A name ends in a kanji ("〜の仕方", "〜か否か").
 */
export const ITEM_ENDING = /(?:いる|ない|ある|する|れる|こと|[\u3040-\u309f][たか])$/;

/** Dots recognised in place of "・" (nakaguro): "汚物室•トイレ". */
const NAKAGURO_LOOKALIKES = /[\u2022\u00b7\uff65]/g;

/**
 * Tidies one line: full-width and repeated spaces become one space; tabs (empty cells) are kept.
 * Dots recognised in place of "・" become "・", so the same name read twice is one category.
 */
export function normalizeLine(line: string): string {
  return line.replace(/[\u3000\u00a0 ]+/g, ' ').replace(/^ | $/g, '').replace(NAKAGURO_LOOKALIKES, '・');
}

/** A header word in angle brackets: "＜備考＞", "〈備考〉", "<備考>". */
const ANGLE_BRACKETED = /^[＜〈<](.*)[＞〉>]$/;

/** A word as looked up in the word sets: lower case, without angle brackets or a colon after a label ("施設名："). */
function toLookupWord(word: string): string {
  return word.trim().toLowerCase().replace(ANGLE_BRACKETED, '$1').replace(/[：:]$/, '');
}

/** A table header word. */
export function isHeaderWord(word: string): boolean {
  return HEADER_WORDS.has(toLookupWord(word));
}

/** A header word or a fill-in field / legend word. */
function isHeaderOrFormWord(word: string): boolean {
  return isHeaderWord(word) || FORM_WORDS.has(toLookupWord(word));
}

/**
 * Lines that carry no checklist content: headers, fill-in fields, rating marks and their legend, page numbers.
 * Words are split at spaces, at "・" ("評価・できている") and at slashes ("備考／改善箇所"), so "汚物室・トイレ" stays.
 */
export function isNoiseLine(line: string): boolean {
  if (PAGE_NUMBERS.some((re) => re.test(line))) return true;
  return line.split(/[ ・]/).every(isNoiseWord);
}

/** A header, form or rating word, or header words joined by slashes ("備考／改善箇所"; "n/a" is a word of its own). */
function isNoiseWord(word: string): boolean {
  if (isHeaderOrFormWord(word) || RATING_ONLY.test(word)) return true;
  return word.split(/[／/]/).every(isHeaderOrFormWord);
}

/** A remark column read after an item's full stop and a space: "…使用しているか。 汚染防止". */
const REMARK_AFTER_SENTENCE = /([。．]) ([^。．]{1,12})$/;

/**
 * Removes a remark left at the end of an item line ("…しているか。 汚染防止" → "…しているか。"), unless it ends
 * like a sentence: then it is a second sentence ("…か。 実施している。").
 */
export function stripTrailingRemark(line: string): string {
  const match = REMARK_AFTER_SENTENCE.exec(line);
  if (!match || looksLikeSentence(match[2])) return line;
  return line.slice(0, match.index + 1);
}

/** Removes a rating left at the end of an item line ("…いる． A" → "…いる．"). */
export function stripTrailingRating(line: string): string {
  const spaced = line.replace(RATING_AFTER_SENTENCE, '$1').replace(RATING_AFTER_SPACE, '').trim();
  const glued = spaced.replace(RATING_AFTER_JAPANESE, '$1');
  return looksLikeSentence(glued) ? glued : spaced;
}

/**
 * A particle before a comma: the sentence goes on in the next line ("…記録がない場合は、" then "清掃担当…",
 * "…拭き取ってから、" then "持続殺菌…").
 */
export const PARTICLE_COMMA_END = /(?:[のがをにとはでもへやて]|から)[、，,]$/;

/**
 * Whether text ends like a sentence (full stop or predicate), as checklist items do. A comma after a
 * particle ("…場合は、") is a pause inside a sentence, not a full stop read as a comma.
 */
export function looksLikeSentence(text: string): boolean {
  return (SENTENCE_END.test(text) && !PARTICLE_COMMA_END.test(text)) || ITEM_ENDING.test(text);
}

/**
 * Removes a "□はい □いいえ" answer column from the end of a line. A line left empty or with only its row
 * number ("7 口はい口いいえ") is returned empty, to be dropped.
 */
export function stripAnswerColumn(line: string): string {
  if (!ANSWER_COLUMN.test(line)) return line;
  const rest = line.replace(ANSWER_COLUMN, '');
  return /^\d*$/.test(rest) ? '' : rest;
}

/** Removes a column of choices from the end of a line ("…整備されている A ・B・C・X"); a line of choices alone is returned empty. */
export function stripChoiceColumn(line: string): string {
  return line.replace(CHOICE_COLUMN, '').trim();
}

/** Removes a law reference in brackets: a line of one alone is returned empty, one at the end of an item is cut off. */
export function stripLawReference(line: string): string {
  if (LAW_REFERENCE_LINE.test(line)) return '';
  return line.replace(TRAILING_LAW_REFERENCE, '');
}

/** Removes what a form prints beside each item: the answer column, the choices, a law reference and a lone dot. */
export function stripItemFields(line: string): string {
  return stripLawReference(stripChoiceColumn(stripAnswerColumn(line))).replace(TRAILING_DOT, '');
}

/**
 * Drops notes under items ("注：…"). A note that does not end like a sentence was wrapped, so the lines after it
 * are dropped too, up to one that ends like a sentence.
 */
export function dropNotes(lines: string[]): string[] {
  let inNote = false;
  return lines.filter((line) => {
    if (!inNote && !NOTE_START.test(line)) return true;
    inNote = !looksLikeSentence(line);
    return false;
  });
}
