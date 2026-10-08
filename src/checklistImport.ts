import type { ChecklistCategory, SavedChecklist } from './types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u3040-\u9fff-]/g, '')
    .slice(0, 20);
}

/**
 * ID prefix of a new category: its slug, or `<slug>~<k>` (smallest free k from 2) when an earlier
 * category already took that slug. slugify always removes `~`, so a shifted prefix never equals a
 * natural one, and input without such clashes keeps exactly the IDs it had before.
 */
function uniqueIdPrefix(category: string, usedPrefixes: Set<string>): string {
  const slug = slugify(category);
  let prefix = slug;
  for (let k = 2; usedPrefixes.has(prefix); k++) prefix = `${slug}~${k}`;
  usedPrefixes.add(prefix);
  return prefix;
}

function buildCategories(rows: [string, string][]): ChecklistCategory[] {
  const map = new Map<string, ChecklistCategory>();
  const counters = new Map<string, number>();
  const idPrefixes = new Map<string, string>();
  const usedPrefixes = new Set<string>();

  for (const [category, description] of rows) {
    const cat = category.trim();
    const desc = description.trim();
    if (!cat || !desc) continue;

    if (!map.has(cat)) {
      map.set(cat, { category: cat, items: [] });
      counters.set(cat, 0);
      idPrefixes.set(cat, uniqueIdPrefix(cat, usedPrefixes));
    }

    const n = (counters.get(cat) ?? 0) + 1;
    counters.set(cat, n);

    map.get(cat)!.items.push({
      id: `${idPrefixes.get(cat)}-${n}`,
      category: cat,
      description: desc,
    });
  }

  if (map.size === 0) throw new Error('有効な行が見つかりません。category と description の2列が必要です。');
  return Array.from(map.values());
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * A `category` row before any data row is the header, even after blank or title rows.
 * Callers drop rows with an empty cell first, so a title row never counts as data.
 */
function isHeaderRow(col0: string, rows: [string, string][]): boolean {
  return rows.length === 0 && col0.trim().toLowerCase() === 'category';
}

export function parseCsv(text: string): ChecklistCategory[] {
  const lines = text.split(/\r?\n/);
  const rows: [string, string][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length < 2) continue;

    const [col0, col1] = cols;
    if (!col0.trim() || !col1.trim()) continue;
    if (isHeaderRow(col0, rows)) continue;

    rows.push([col0, col1]);
  }

  return buildCategories(rows);
}

export async function parseXlsx(buf: ArrayBuffer): Promise<ChecklistCategory[]> {
  const { readSheet } = await import('read-excel-file/browser');
  // 先頭シートを行の配列として読む。セルは string | number | boolean | Date で返る。
  const raw = await readSheet(buf);

  const rows: [string, string][] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!Array.isArray(row) || row.length < 2) continue;
    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();
    if (!col0 || !col1) continue;
    if (isHeaderRow(col0, rows)) continue;
    rows.push([col0, col1]);
  }

  return buildCategories(rows);
}

export type ChecklistFileType = 'csv' | 'xlsx';

/** .xlsx by its extension; any other file is read as CSV. */
export function checklistFileType(fileName: string): ChecklistFileType {
  return fileName.endsWith('.xlsx') ? 'xlsx' : 'csv';
}

export async function readChecklistFile(file: File, type: ChecklistFileType): Promise<ChecklistCategory[]> {
  if (type === 'xlsx') {
    const buf = await file.arrayBuffer();
    return parseXlsx(buf);
  }
  const text = await file.text();
  return parseCsv(text);
}

/** The typed name, else the file name without its last extension, else a fixed default. */
export function importedChecklistName(typedName: string, fileName: string): string {
  return typedName.trim() || fileName.replace(/\.[^.]+$/, '') || '取込チェックリスト';
}

export function buildImportedChecklist(
  source: { typedName: string; fileName: string; categories: ChecklistCategory[] },
  id: string,
  createdAt: string
): SavedChecklist {
  return {
    id,
    name: importedChecklistName(source.typedName, source.fileName),
    createdAt,
    categories: source.categories,
  };
}
