import type { ChecklistCategory, Rating, RoundData, RoundExport } from '../types';

/** 統合レポートの1列 = 1部署（1つのエクスポートファイル） */
export interface DeptColumn {
  /** 表の列見出し。wardName が空なら inspectorName、重複時は担当者名を併記 */
  label: string;
  wardName: string;
  inspectorName: string;
  startTime: string;
  /** itemId -> 評価。その部署に存在しない項目はキーごと無い */
  ratings: Map<string, Rating>;
  roundData: RoundData;
  categories: ChecklistCategory[];
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
  if (typeof parsed !== 'object' || parsed === null) return fail('JSONの中身が空です');

  const obj = parsed as Partial<RoundExport>;
  if (obj.format !== 'meguru-round') {
    return fail('めぐる君のラウンドデータではありません（.docx や別のJSONを選んでいませんか？）');
  }
  if (obj.version !== 1) {
    return fail(`未対応のバージョンです（version: ${String(obj.version)}）`);
  }
  if (!Array.isArray(obj.categories) || !obj.roundData || !Array.isArray(obj.roundData.checklistResults)) {
    return fail('ラウンドデータの形式が壊れています');
  }
  return obj as RoundExport;
}

function fail(message: string): never {
  throw new Error(message);
}

/** ファイルの読み込み順がそのまま表の列順になる */
export function mergeRounds(exports: RoundExport[]): MergeResult {
  const warnings: string[] = [];

  // ---- 行の並び: 先頭ファイルを基準にした項目の和集合 ----
  const categories: ChecklistCategory[] = [];
  const seenItemIds = new Set<string>();
  for (const exp of exports) {
    for (const cat of exp.categories) {
      let target = categories.find((c) => c.category === cat.category);
      if (!target) {
        target = { category: cat.category, items: [] };
        categories.push(target);
      }
      for (const item of cat.items) {
        if (seenItemIds.has(item.id)) continue;
        seenItemIds.add(item.id);
        target.items.push(item);
      }
    }
  }

  // ---- 列 ----
  const columns: DeptColumn[] = exports.map((exp) => {
    const ratings = new Map<string, Rating>();
    for (const result of exp.roundData.checklistResults) {
      ratings.set(result.itemId, result.rating);
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
  const allItemIds = [...seenItemIds];
  for (const col of columns) {
    const missing = allItemIds.filter((id) => !col.ratings.has(id)).length;
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
