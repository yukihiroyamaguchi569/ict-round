import type { ChecklistCategory } from './types';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u3040-\u9fff-]/g, '')
    .slice(0, 20);
}

function buildCategories(rows: [string, string][]): ChecklistCategory[] {
  const map = new Map<string, ChecklistCategory>();
  const counters = new Map<string, number>();

  for (const [category, description] of rows) {
    const cat = category.trim();
    const desc = description.trim();
    if (!cat || !desc) continue;

    if (!map.has(cat)) {
      map.set(cat, { category: cat, items: [] });
      counters.set(cat, 0);
    }

    const n = (counters.get(cat) ?? 0) + 1;
    counters.set(cat, n);

    map.get(cat)!.items.push({
      id: `${slugify(cat)}-${n}`,
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

export function parseCsv(text: string): ChecklistCategory[] {
  const lines = text.split(/\r?\n/);
  const rows: [string, string][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCsvLine(line);
    if (cols.length < 2) continue;

    const [col0, col1] = cols;
    // Skip header row
    if (i === 0 && col0.trim().toLowerCase() === 'category') continue;

    rows.push([col0, col1]);
  }

  return buildCategories(rows);
}

export async function parseXlsx(buf: ArrayBuffer): Promise<ChecklistCategory[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

  const rows: [string, string][] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!Array.isArray(row) || row.length < 2) continue;
    const col0 = String(row[0] ?? '').trim();
    const col1 = String(row[1] ?? '').trim();
    if (!col0 && !col1) continue;
    // Skip header row
    if (i === 0 && col0.toLowerCase() === 'category') continue;
    rows.push([col0, col1]);
  }

  return buildCategories(rows);
}
