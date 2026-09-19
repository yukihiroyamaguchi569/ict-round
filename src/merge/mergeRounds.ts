import type { ChecklistCategory, ChecklistItemDef, Rating, RoundData, RoundExport } from '../types';

/** 統合レポートの1列 = 1部署（1つのエクスポートファイル） */
export interface DeptColumn {
  /** 表の列見出し。wardName が空なら inspectorName、重複時は担当者名を併記 */
  label: string;
  wardName: string;
  inspectorName: string;
  startTime: string;
  /** 行キー（itemRowKey）-> 評価。その部署に存在しない項目はキーごと無い */
  ratings: Map<string, Rating>;
  roundData: RoundData;
  categories: ChecklistCategory[];
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

/** ファイルの読み込み順がそのまま表の列順になる */
export function mergeRounds(exports: RoundExport[]): MergeResult {
  const warnings: string[] = [];

  // ---- 行の並び: 先頭ファイルを基準にした項目の和集合 ----
  const categories: ChecklistCategory[] = [];
  // 行は itemRowKey（ID＋カテゴリ名＋文言）で識別する。同じIDに違う文言が割り当てられて
  // いる場合は別の行として出力し、どの部署の評価も正しい文言の行に載るようにする。
  const rowKeys = new Set<string>();
  const seenItems = new Map<string, { category: string; description: string }>();
  const itemConflicts = new Map<string, string>();
  for (const exp of exports) {
    for (const cat of exp.categories) {
      let target = categories.find((c) => c.category === cat.category);
      if (!target) {
        target = { category: cat.category, items: [] };
        categories.push(target);
      }
      for (const item of cat.items) {
        const seen = seenItems.get(item.id);
        if (seen && (seen.category !== cat.category || seen.description !== item.description)) {
          itemConflicts.set(
            item.id,
            `同じ項目ID（${item.id}）に違うチェック項目が割り当てられています（「${seen.category}：${seen.description}」と「${cat.category}：${item.description}」）。別々に作ったチェックリストが混ざっていると起こります。評価が混ざらないよう、文言ごとに別の行に分けて出力します。同じ項目のつもりでも行が分かれるため、表の内容をご確認ください。`
          );
        }
        const key = itemRowKey(cat.category, item);
        if (rowKeys.has(key)) continue;
        rowKeys.add(key);
        if (!seen) seenItems.set(item.id, { category: cat.category, description: item.description });
        target.items.push(item);
      }
    }
  }

  // ---- 列 ----
  const columns: DeptColumn[] = exports.map((exp) => {
    // 評価はその部署のチェックリスト定義から行キーを引いて格納する（項目IDだけでは行を特定できない）
    const rowKeyByItemId = new Map<string, string>();
    for (const cat of exp.categories) {
      for (const item of cat.items) rowKeyByItemId.set(item.id, itemRowKey(cat.category, item));
    }
    const ratings = new Map<string, Rating>();
    for (const result of exp.roundData.checklistResults) {
      const key = rowKeyByItemId.get(result.itemId);
      if (key) ratings.set(key, result.rating);
    }
    return {
      label: exp.roundData.wardName.trim() || exp.roundData.inspectorName.trim() || '（名称未設定）',
      wardName: exp.roundData.wardName,
      inspectorName: exp.roundData.inspectorName,
      startTime: exp.roundData.startTime,
      ratings,
      roundData: exp.roundData,
      categories: exp.categories,
    };
  });

  // 同じ列見出しが並ぶと区別できないので担当者名を併記し、それでも重なるなら連番を足す
  const labelCounts = new Map<string, number>();
  for (const col of columns) labelCounts.set(col.label, (labelCounts.get(col.label) ?? 0) + 1);
  const usedLabels = new Set<string>();
  for (const col of columns) {
    if ((labelCounts.get(col.label) ?? 0) > 1 && col.inspectorName.trim()) {
      col.label = `${col.label}（${col.inspectorName.trim()}）`;
    }
    let label = col.label;
    let n = 2;
    while (usedLabels.has(label)) label = `${col.label} ${n++}`;
    col.label = label;
    usedLabels.add(label);
  }

  // ---- 警告 ----
  warnings.push(...itemConflicts.values());

  const allRowKeys = [...rowKeys];
  for (const col of columns) {
    const missing = allRowKeys.filter((key) => !col.ratings.has(key)).length;
    if (missing > 0) {
      warnings.push(`「${col.label}」には他のファイルにある ${missing} 項目がありません（チェックリストの版が違う可能性があります）。該当セルは「—」になります。`);
    }
  }

  const checklistNames = [...new Set(exports.map((e) => e.checklistName).filter(Boolean))];
  if (checklistNames.length > 1) {
    warnings.push(`チェックリスト名が混在しています: ${checklistNames.join(' / ')}`);
  }

  if (columns.length > 6) {
    warnings.push(`部署が ${columns.length} 件あります。Wordの表が横幅に収まらず読みにくくなる場合があります。`);
  }

  return { columns, categories, warnings };
}
