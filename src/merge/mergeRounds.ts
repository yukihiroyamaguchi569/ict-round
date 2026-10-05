import type { ChecklistCategory, ChecklistItemDef, Rating, RoundData, RoundExport } from '../types';
// 部署数の警告は Word の表レイアウトが決める閾値なので、出力側の値をそのまま使う
// （mergedDocx 側は型だけを import するため実行時の循環参照は発生しない）
import { READABLE_DEPT_MAX } from './mergedDocx';

/** 列にまとまった報告書1件分（1つのエクスポートファイル） */
export interface DeptSource {
  inspectorName: string;
  roundData: RoundData;
  categories: ChecklistCategory[];
}

/** 統合レポートの1列 = 1部署。同じ病棟名の報告書は1列にまとまる */
export interface DeptColumn {
  /** 表の列見出し。wardName が空なら inspectorName、それでも重なるなら連番を足す */
  label: string;
  /** 列をまとめた病棟名（前後の空白を落としたもの）。空なら見出しは担当者名に由来する */
  wardName: string;
  /** この列にまとまった報告書（読み込み順）。1つの病棟を複数名で分担すると2件以上になる */
  sources: DeptSource[];
  /** 列の中で最も早い実施日時 */
  startTime: string;
  /** 行キー（itemRowKey）-> 評価。その部署に存在しない項目はキーごと無い */
  ratings: Map<string, Rating>;
}

/** 評価の厳しさ。担当者間で食い違ったときは大きい方を採用する */
const RATING_SEVERITY: Record<Exclude<Rating, null>, number> = { A: 1, B: 2, C: 3 };

/** 担当者間で評価が分かれたかを判定するための、1項目に集まった評価 */
interface ItemVotes {
  description: string;
  votes: { inspectorName: string; rating: Exclude<Rating, null> }[];
}

/**
 * 表の行を識別するキー。
 * 項目IDは「カテゴリ名-連番」で機械生成されるため、別々に作ったチェックリストでは
 * 同じIDが違う項目に割り当たり得る。IDだけで突き合わせると別項目の評価が同じ行に
 * 並んでしまうので、カテゴリ名と文言も含めて識別する。
 */
export function itemRowKey(category: string, item: ChecklistItemDef): string {
  // 連結の境目が曖昧にならないよう JSON 配列の文字列にする
  return JSON.stringify([item.id, category, item.description]);
}

/** どの報告書のことか警告文で示す（病棟名と担当者名の分かる範囲で） */
function describeExport(exp: RoundExport): string {
  const ward = exp.roundData.wardName.trim();
  const inspector = exp.roundData.inspectorName.trim();
  if (ward && inspector) return `「${ward}」（担当: ${inspector}）`;
  return `「${ward || inspector || '名称未設定'}」`;
}

export interface MergeResult {
  columns: DeptColumn[];
  /** 行の並び。全ファイルの項目の和集合 */
  categories: ChecklistCategory[];
  warnings: string[];
}

/** JSON文字列を検証して RoundExport にする。不正なら理由付きで throw する */
export function parseRoundExport(text: string): RoundExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail('JSONとして読み取れません（ファイルが壊れている可能性があります）');
  }
  assertRoundExport(parsed);
  return parsed;
}

/**
 * 統合ページは他人から受け取ったファイルを読むため、統合処理へ渡す前に形状を検証する。
 * 表示・統合で実際に触るフィールドを対象にし、写真1枚ずつの中身までは見ない。
 */
function assertRoundExport(value: unknown): asserts value is RoundExport {
  if (!isRecord(value)) fail('JSONの中身が空です');

  if (value.format !== 'meguru-round') {
    fail('めぐる君のラウンドデータではありません（別のファイルを選んでいませんか？）');
  }
  if (value.version !== 1) {
    fail(`未対応のバージョンです（version: ${String(value.version)}）`);
  }
  requireString(value.exportedAt, '作成日時');
  requireString(value.checklistName, 'チェックリスト名');
  requireArray(value.categories, 'カテゴリ一覧').forEach((cat, i) =>
    assertCategory(cat, `カテゴリ${i + 1}`)
  );
  assertRoundData(value.roundData);
}

function assertCategory(value: unknown, where: string): void {
  if (!isRecord(value)) failAt(where);
  requireString(value.category, `${where}の名前`);
  requireArray(value.items, `${where}の項目一覧`).forEach((item, i) => {
    const itemWhere = `${where}の項目${i + 1}`;
    if (!isRecord(item)) failAt(itemWhere);
    requireString(item.id, `${itemWhere}のID`);
    requireString(item.description, `${itemWhere}の文言`);
  });
}

function assertRoundData(value: unknown): void {
  if (!isRecord(value)) failAt('ラウンドの内容');
  requireString(value.inspectorName, '担当者名');
  requireString(value.wardName, '部署名');
  requireString(value.startTime, '実施日時');
  requireString(value.overallEvaluation, '総評');
  requireArray(value.generalPhotos, '全体の写真');
  requireArray(value.checklistResults, 'チェック結果').forEach((result, i) => {
    const where = `チェック結果${i + 1}`;
    if (!isRecord(result)) failAt(where);
    requireString(result.itemId, `${where}の項目ID`);
    const { rating } = result;
    if (rating !== null && rating !== 'A' && rating !== 'B' && rating !== 'C') {
      failAt(`${where}の評価`);
    }
    requireArray(result.photos, `${where}の写真`);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, where: string): void {
  if (typeof value !== 'string') failAt(where);
}

function requireArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) failAt(where);
  return value;
}

function failAt(where: string): never {
  return fail(`ラウンドデータの形式が壊れています（${where}）`);
}

function fail(message: string): never {
  throw new Error(message);
}

/** 先頭ファイルを基準にした行の並び（項目の和集合）と、同じIDに違う項目が割り当てられた警告 */
interface RowsBuild {
  categories: ChecklistCategory[];
  /** 行は itemRowKey（ID＋カテゴリ名＋文言）で識別する */
  rowKeys: Set<string>;
  /** 項目IDごとに最初に見つかった項目。違う項目が同じIDを使っていないかの判定に使う */
  seenItems: Map<string, { category: string; description: string }>;
  /** 項目ID -> 警告文。同じIDで何度食い違っても警告は1件にまとめる */
  itemConflicts: Map<string, string>;
}

function itemConflictWarning(
  id: string,
  seen: { category: string; description: string },
  category: string,
  description: string
): string {
  return `同じ項目ID（${id}）に違うチェック項目が割り当てられています（「${seen.category}：${seen.description}」と「${category}：${description}」）。別々に作ったチェックリストが混ざっていると起こります。評価が混ざらないよう、文言ごとに別の行に分けて出力します。同じ項目のつもりでも行が分かれるため、表の内容をご確認ください。`;
}

/** 1つのカテゴリの項目を行の並びに足す（同じ行キーの項目は1行にまとめる） */
function addCategoryRows(rows: RowsBuild, cat: ChecklistCategory): void {
  let target = rows.categories.find((c) => c.category === cat.category);
  if (!target) {
    target = { category: cat.category, items: [] };
    rows.categories.push(target);
  }
  for (const item of cat.items) {
    const seen = rows.seenItems.get(item.id);
    if (seen && (seen.category !== cat.category || seen.description !== item.description)) {
      rows.itemConflicts.set(item.id, itemConflictWarning(item.id, seen, cat.category, item.description));
    }
    const key = itemRowKey(cat.category, item);
    if (rows.rowKeys.has(key)) continue;
    rows.rowKeys.add(key);
    if (!seen) rows.seenItems.set(item.id, { category: cat.category, description: item.description });
    target.items.push(item);
  }
}

/**
 * 行の並びを決める。同じIDに違う文言が割り当てられている場合は別の行として出力し、
 * どの部署の評価も正しい文言の行に載るようにする。
 */
function buildRows(exports: RoundExport[]): RowsBuild {
  const rows: RowsBuild = { categories: [], rowKeys: new Set(), seenItems: new Map(), itemConflicts: new Map() };
  for (const exp of exports) {
    for (const cat of exp.categories) addCategoryRows(rows, cat);
  }
  return rows;
}

/** 構築中の1列と、担当者間の食い違いを判定するための項目ごとの評価 */
interface ColumnBuild {
  column: DeptColumn;
  votes: Map<string, ItemVotes>;
}

/** 報告書の行き先の列を返す。まだ無ければ作って一覧に足す */
function findOrCreateColumn(
  byGroup: Map<string, ColumnBuild>,
  builds: ColumnBuild[],
  exp: RoundExport,
  index: number
): ColumnBuild {
  const wardName = exp.roundData.wardName.trim();
  // 病棟名が空の報告書は誰のどの記録か区別できないため、まとめずに1件1列とする
  const groupKey = wardName ? `ward:${wardName}` : `file:${index}`;
  const existing = byGroup.get(groupKey);
  if (existing) return existing;
  const build: ColumnBuild = {
    column: {
      label: wardName || exp.roundData.inspectorName.trim() || '（名称未設定）',
      wardName,
      sources: [],
      startTime: exp.roundData.startTime,
      ratings: new Map(),
    },
    votes: new Map(),
  };
  builds.push(build);
  byGroup.set(groupKey, build);
  return build;
}

/** 項目ID -> 載せる行。同じIDが複数の項目に使われていると、評価をどの行に載せるべきか決められない */
type RowByItemId = Map<string, { key: string; description: string }>;

/**
 * 「その部署にある項目」はチェック結果ではなくチェックリスト定義で決める。
 * 定義の全項目を未評価として列に登録する。
 * （定義にあるのに結果が無い項目を「項目がありません」と誤警告しないため）
 */
function registerDefinedItems(
  column: DeptColumn,
  categories: ChecklistCategory[]
): { rowByItemId: RowByItemId; duplicateIds: Set<string> } {
  const rowByItemId: RowByItemId = new Map();
  const duplicateIds = new Set<string>();
  for (const cat of categories) {
    for (const item of cat.items) {
      const key = itemRowKey(cat.category, item);
      if (rowByItemId.has(item.id)) duplicateIds.add(item.id);
      else rowByItemId.set(item.id, { key, description: item.description });
      if (!column.ratings.has(key)) column.ratings.set(key, null);
    }
  }
  return { rowByItemId, duplicateIds };
}

/** チェック結果の評価を列に重ねる。載せる行の無い評価の項目IDを返す */
function applyRatings({ column, votes }: ColumnBuild, exp: RoundExport, rowByItemId: RowByItemId): Set<string> {
  const unknownIds = new Set<string>();
  for (const result of exp.roundData.checklistResults) {
    const row = rowByItemId.get(result.itemId);
    if (!row) {
      // 定義に無いIDの評価は載せる行が無いので、黙って捨てずに知らせる
      // （未評価なら失われるものが無いため警告しない）
      if (result.rating !== null) unknownIds.add(result.itemId);
      continue;
    }
    const current = column.ratings.get(row.key) ?? null;
    if (result.rating === null) continue;
    if (current === null || RATING_SEVERITY[result.rating] > RATING_SEVERITY[current]) {
      column.ratings.set(row.key, result.rating);
    }
    const itemVotes = votes.get(row.key) ?? { description: row.description, votes: [] };
    itemVotes.votes.push({ inspectorName: exp.roundData.inspectorName, rating: result.rating });
    votes.set(row.key, itemVotes);
  }
  return unknownIds;
}

function duplicateIdWarning(exp: RoundExport, ids: Set<string>): string {
  return `${describeExport(exp)}の報告書では、同じ項目ID（${[...ids].join('、')}）が複数のチェック項目に使われています。評価と写真は項目IDで記録するため、一部の評価が本来の行に載らない可能性があります。写真も重複したり別の項目名の下に出ることがあります。該当する項目の評価と写真をご確認ください。`;
}

function unknownIdWarning(exp: RoundExport, ids: Set<string>): string {
  return `${describeExport(exp)}の報告書には、チェックリストに無い項目ID（${[...ids].join('、')}）の評価が含まれています。載せる行が無いため表には反映されません。チェックリストを編集した前後の報告書が混ざっていると起こります。`;
}

/**
 * 列を作る。1つの病棟をチェック項目で分担して複数名で回る使い方があるため、病棟名が一致する
 * 報告書は同じ列に集約する（病棟名は前後の空白だけ落として比較し、表記ゆれは揃えない）。
 * 1つの報告書の中で整合していない点は、その報告書を特定できる文言で警告にまとめる。
 */
function buildColumns(exports: RoundExport[]): { builds: ColumnBuild[]; reportWarnings: string[] } {
  const builds: ColumnBuild[] = [];
  const byGroup = new Map<string, ColumnBuild>();
  const duplicateIdWarnings: string[] = [];
  const unknownIdWarnings: string[] = [];

  exports.forEach((exp, index) => {
    const build = findOrCreateColumn(byGroup, builds, exp, index);
    const { column } = build;
    column.sources.push({
      inspectorName: exp.roundData.inspectorName,
      roundData: exp.roundData,
      categories: exp.categories,
    });
    if (exp.roundData.startTime < column.startTime) column.startTime = exp.roundData.startTime;

    const { rowByItemId, duplicateIds } = registerDefinedItems(column, exp.categories);
    if (duplicateIds.size > 0) duplicateIdWarnings.push(duplicateIdWarning(exp, duplicateIds));
    const unknownIds = applyRatings(build, exp, rowByItemId);
    if (unknownIds.size > 0) unknownIdWarnings.push(unknownIdWarning(exp, unknownIds));
  });

  return { builds, reportWarnings: [...duplicateIdWarnings, ...unknownIdWarnings] };
}

/**
 * 病棟名が同じ報告書は1列にまとまるため見出しは基本的に重ならないが、
 * 病棟名のない報告書が担当者名で並ぶと重なり得るので連番で区別する
 */
function assignUniqueLabels(columns: DeptColumn[]): void {
  const usedLabels = new Set<string>();
  for (const col of columns) {
    let label = col.label;
    let n = 2;
    while (usedLabels.has(label)) label = `${col.label} ${n++}`;
    col.label = label;
    usedLabels.add(label);
  }
}

/**
 * 同じ病棟の中で評価が分かれたのは担当者間の食い違いなので、厳しい方を採用したうえで知らせる。
 * （病棟が違う場合の評価の違いは食い違いではなく別々の結果なので、この判定は1列の中に閉じている）
 */
function splitRatingWarnings({ column, votes }: ColumnBuild): string[] {
  const split = [...votes.values()].filter((item) => new Set(item.votes.map((v) => v.rating)).size > 1);
  if (split.length === 0) return [];
  const detail = split
    .map((item) => {
      const itemVotes = item.votes
        .map((v) => `${v.inspectorName.trim() || '担当者名なし'}: ${v.rating}`)
        .join(' / ');
      return `「${item.description}」（${itemVotes}）`;
    })
    .join('、');
  return [`「${column.label}」は担当者間で評価が分かれました: ${detail}。厳しい方の評価（C＞B＞A）を採用しています。`];
}

function missingItemsWarnings(column: DeptColumn, rowKeys: Set<string>): string[] {
  const missing = [...rowKeys].filter((key) => !column.ratings.has(key)).length;
  if (missing === 0) return [];
  return [`「${column.label}」には他のファイルにある ${missing} 項目がありません（チェックリストの版が違う可能性があります）。該当セルは「—」になります。`];
}

function checklistNameWarnings(exports: RoundExport[]): string[] {
  const checklistNames = [...new Set(exports.map((e) => e.checklistName).filter(Boolean))];
  if (checklistNames.length <= 1) return [];
  return [`チェックリスト名が混在しています: ${checklistNames.join(' / ')}`];
}

function deptCountWarnings(deptCount: number): string[] {
  if (deptCount <= READABLE_DEPT_MAX) return [];
  return [`部署が ${deptCount} 件あります。Wordの表は用紙幅に収めますが、${READABLE_DEPT_MAX} 件を超えると部署の列が狭くなり読みにくくなります。`];
}

/** ファイルの読み込み順がそのまま表の列順になる */
export function mergeRounds(exports: RoundExport[]): MergeResult {
  const rows = buildRows(exports);
  const { builds, reportWarnings } = buildColumns(exports);
  const columns = builds.map((b) => b.column);
  assignUniqueLabels(columns);

  const warnings = [
    ...rows.itemConflicts.values(),
    ...reportWarnings,
    ...builds.flatMap(splitRatingWarnings),
    ...columns.flatMap((col) => missingItemsWarnings(col, rows.rowKeys)),
    ...checklistNameWarnings(exports),
    ...deptCountWarnings(columns.length),
  ];
  return { columns, categories: rows.categories, warnings };
}
