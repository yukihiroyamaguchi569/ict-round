/** How a group is visited on the weekly round: every time, or picked per round. */
export type VisitMode = 'always' | 'select';

export interface FacilityGroup {
  name: string;
  visit: VisitMode;
}

export interface FacilityDepartment {
  name: string;
  group: string;
}

export interface ThemeItem {
  id: string;
  text: string;
  /** Empty means every department. */
  targetGroups: string[];
  excludedDepartments: string[];
}

export interface FacilityTheme {
  name: string;
  items: ThemeItem[];
}

export interface FacilityMember {
  name: string;
  role: string;
}

export interface FacilitySettings {
  version: 1;
  groups: FacilityGroup[];
  departments: FacilityDepartment[];
  /** Themes in order of first appearance on the item sheet; items keep the sheet order. */
  themes: FacilityTheme[];
  members: FacilityMember[];
}

export interface SettingsError {
  sheet: string;
  /** Excel row number (the header row is 1). Absent for errors about the whole sheet. */
  row?: number;
  message: string;
}

export type BuildSettingsResult =
  | { ok: true; settings: FacilitySettings }
  | { ok: false; errors: SettingsError[] };

export const GROUP_SHEET = { name: 'グループ', headers: ['グループ名', '回り方'] } as const;
export const DEPARTMENT_SHEET = { name: '部署', headers: ['部署名', 'グループ'] } as const;
export const ITEM_SHEET = {
  name: '項目',
  headers: ['テーマ', '項目', '対象グループ', '対象外の部署'],
} as const;
export const MEMBER_SHEET = { name: '参加者', headers: ['氏名', '職種'] } as const;

/** All settings sheets in workbook order. */
export const SETTINGS_SHEETS = [GROUP_SHEET, DEPARTMENT_SHEET, ITEM_SHEET, MEMBER_SHEET] as const;

/** Cell text for each visit mode on the group sheet. */
export const VISIT_LABELS = { always: '毎回', select: '選ぶ' } as const satisfies Record<VisitMode, string>;

const VISIT_BY_LABEL = new Map<string, VisitMode>([
  [VISIT_LABELS.always, 'always'],
  [VISIT_LABELS.select, 'select'],
]);

// In every sheet the first two columns are required; the item sheet's last two are optional.
const REQUIRED_COLUMNS = 2;

/** Separators accepted in the multi-name cells (対象グループ / 対象外の部署). */
const NAME_SEPARATORS = /[、,，､\n]/;

interface SheetSpec {
  name: string;
  headers: readonly string[];
}

interface DataRow {
  /** Excel row number. */
  row: number;
  /** Trimmed cells, one per header column. */
  cells: string[];
}

/** Names known from a sheet, or null when that sheet could not be read (its references are not checked). */
type KnownNames = ReadonlySet<string> | null;

/**
 * Builds facility settings from the four sheets (rows of cell strings, header row first).
 * Collects every error instead of stopping at the first one, so the user can fix the workbook in one pass.
 */
export function buildFacilitySettings(
  sheets: Record<string, string[][]>,
  newId: () => string
): BuildSettingsResult {
  const errors: SettingsError[] = [];
  const groupRows = readRows(sheets, GROUP_SHEET, errors);
  const departmentRows = readRows(sheets, DEPARTMENT_SHEET, errors);
  const itemRows = readRows(sheets, ITEM_SHEET, errors);
  const memberRows = readRows(sheets, MEMBER_SHEET, errors);

  const groups = buildGroups(groupRows ?? [], errors);
  const groupNames = knownNames(groupRows, groups.map(({ group }) => group.name));
  const departments = buildDepartments(departmentRows ?? [], groupNames, errors);
  if (departmentRows) checkGroupsHaveDepartments(groups, departments, errors);
  const departmentNames = knownNames(departmentRows, departments.map((d) => d.name));
  const themes = buildThemes(itemRows ?? [], { groupNames, departmentNames, newId }, errors);
  const members = buildMembers(memberRows ?? [], errors);

  if (errors.length > 0) return { ok: false, errors: sortErrors(errors) };
  return {
    ok: true,
    settings: { version: 1, groups: groups.map(({ group }) => group), departments, themes, members },
  };
}

/** Reads a sheet's data rows: checks presence, header and that data exists; drops blank rows and rows missing a required cell. */
function readRows(
  sheets: Record<string, string[][]>,
  spec: SheetSpec,
  errors: SettingsError[]
): DataRow[] | null {
  if (!Object.hasOwn(sheets, spec.name)) {
    errors.push({ sheet: spec.name, message: `「${spec.name}」シートがありません` });
    return null;
  }
  const [header = [], ...body] = sheets[spec.name];
  if (!headerMatches(header, spec.headers)) {
    errors.push({ sheet: spec.name, row: 1, message: headerMessage(spec.headers) });
    return null;
  }
  const rows = toDataRows(body, spec.headers.length);
  if (rows.length === 0) {
    errors.push({ sheet: spec.name, message: `「${spec.name}」シートにデータの行がありません（2行目から書いてください）` });
    return null;
  }
  return rows.filter((r) => hasRequiredCells(r, spec, errors));
}

/** Rows below the header with at least one non-blank cell (in any column); row numbers stay Excel's. */
function toDataRows(body: string[][], columns: number): DataRow[] {
  const rows: DataRow[] = [];
  body.forEach((cells, i) => {
    if (cells.every((cell) => cell.trim() === '')) return;
    rows.push({ row: i + 2, cells: Array.from({ length: columns }, (_, c) => (cells[c] ?? '').trim()) });
  });
  return rows;
}

function headerMatches(header: string[], expected: readonly string[]): boolean {
  return expected.every((name, i) => (header[i] ?? '').trim() === name);
}

function headerMessage(expected: readonly string[]): string {
  const columns = expected.map((name) => `「${name}」`).join('');
  return `1行目の見出しを左から${columns}の順にしてください`;
}

function hasRequiredCells(r: DataRow, spec: SheetSpec, errors: SettingsError[]): boolean {
  const blank = spec.headers.slice(0, REQUIRED_COLUMNS).filter((_, c) => r.cells[c] === '');
  for (const name of blank) {
    errors.push({ sheet: spec.name, row: r.row, message: `「${name}」が空欄です` });
  }
  return blank.length === 0;
}

function knownNames(rows: DataRow[] | null, names: string[]): KnownNames {
  return rows ? new Set(names) : null;
}

/** Records the first row of each key; returns the earlier row when the key was already seen. */
function earlierRow(seen: Map<string, number>, key: string, row: number): number | undefined {
  const first = seen.get(key);
  if (first === undefined) seen.set(key, row);
  return first;
}

function duplicateError(sheet: string, row: number, label: string, first: number): SettingsError {
  return { sheet, row, message: `${label}が重複しています（${first}行目と同じです）` };
}

interface LocatedGroup {
  group: FacilityGroup;
  row: number;
}

function buildGroups(rows: DataRow[], errors: SettingsError[]): LocatedGroup[] {
  const seen = new Map<string, number>();
  const groups: LocatedGroup[] = [];
  for (const { row, cells } of rows) {
    const [name, visitLabel] = cells;
    const first = earlierRow(seen, name, row);
    if (first !== undefined) {
      errors.push(duplicateError(GROUP_SHEET.name, row, `グループ名「${name}」`, first));
      continue;
    }
    const visit = VISIT_BY_LABEL.get(visitLabel);
    if (visit === undefined) {
      const message = `回り方「${visitLabel}」は「${VISIT_LABELS.always}」か「${VISIT_LABELS.select}」にしてください`;
      errors.push({ sheet: GROUP_SHEET.name, row, message });
    }
    // A group with a bad visit mode stays known, so departments referring to it are not reported twice.
    groups.push({ group: { name, visit: visit ?? 'always' }, row });
  }
  return groups;
}

interface Reference {
  /** Names on the referenced sheet; null skips the check. */
  known: KnownNames;
  /** Column label used in the message. */
  label: string;
  /** The referenced sheet. */
  sheet: string;
}

interface CellPlace {
  sheet: string;
  row: number;
}

/** Reports each name missing from the referenced sheet. */
function checkReferences(names: string[], ref: Reference, place: CellPlace, errors: SettingsError[]): void {
  if (!ref.known) return;
  for (const name of names) {
    if (ref.known.has(name)) continue;
    errors.push({ ...place, message: `${ref.label}「${name}」が「${ref.sheet}」シートにありません` });
  }
}

function buildDepartments(rows: DataRow[], groupNames: KnownNames, errors: SettingsError[]): FacilityDepartment[] {
  const seen = new Map<string, number>();
  const departments: FacilityDepartment[] = [];
  for (const { row, cells } of rows) {
    const [name, group] = cells;
    const first = earlierRow(seen, name, row);
    if (first !== undefined) {
      errors.push(duplicateError(DEPARTMENT_SHEET.name, row, `部署名「${name}」`, first));
      continue;
    }
    const ref = { known: groupNames, label: 'グループ', sheet: GROUP_SHEET.name };
    checkReferences([group], ref, { sheet: DEPARTMENT_SHEET.name, row }, errors);
    departments.push({ name, group });
  }
  return departments;
}

function checkGroupsHaveDepartments(
  groups: LocatedGroup[],
  departments: FacilityDepartment[],
  errors: SettingsError[]
): void {
  const used = new Set(departments.map((d) => d.group));
  for (const { group, row } of groups) {
    if (used.has(group.name)) continue;
    const message = `グループ「${group.name}」に属する部署が「${DEPARTMENT_SHEET.name}」シートにありません`;
    errors.push({ sheet: GROUP_SHEET.name, row, message });
  }
}

/** Splits a multi-name cell; drops empty parts and repeated names. */
function splitNames(cell: string): string[] {
  const names = cell
    .split(NAME_SEPARATORS)
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return [...new Set(names)];
}

interface ThemeContext {
  groupNames: KnownNames;
  departmentNames: KnownNames;
  newId: () => string;
}

function buildThemes(rows: DataRow[], ctx: ThemeContext, errors: SettingsError[]): FacilityTheme[] {
  const themes = new Map<string, ThemeItem[]>();
  const seen = new Map<string, number>();
  for (const { row, cells } of rows) {
    const [theme, text, groupCell, excludedCell] = cells;
    const first = earlierRow(seen, JSON.stringify([theme, text]), row);
    if (first !== undefined) {
      errors.push(duplicateError(ITEM_SHEET.name, row, `テーマ「${theme}」の項目「${text}」`, first));
      continue;
    }
    const targetGroups = splitNames(groupCell);
    const excludedDepartments = splitNames(excludedCell);
    const place = { sheet: ITEM_SHEET.name, row };
    checkReferences(targetGroups, { known: ctx.groupNames, label: '対象グループ', sheet: GROUP_SHEET.name }, place, errors);
    const departmentRef = { known: ctx.departmentNames, label: '対象外の部署', sheet: DEPARTMENT_SHEET.name };
    checkReferences(excludedDepartments, departmentRef, place, errors);
    const item = { id: ctx.newId(), text, targetGroups, excludedDepartments };
    const items = themes.get(theme);
    if (items) items.push(item);
    else themes.set(theme, [item]);
  }
  return [...themes].map(([name, items]) => ({ name, items }));
}

function buildMembers(rows: DataRow[], errors: SettingsError[]): FacilityMember[] {
  const seen = new Map<string, number>();
  const members: FacilityMember[] = [];
  for (const { row, cells } of rows) {
    const [name, role] = cells;
    const first = earlierRow(seen, name, row);
    if (first !== undefined) {
      errors.push(duplicateError(MEMBER_SHEET.name, row, `氏名「${name}」`, first));
      continue;
    }
    members.push({ name, role });
  }
  return members;
}

/** Orders errors by sheet (workbook order), then row; whole-sheet errors come first within a sheet. */
function sortErrors(errors: SettingsError[]): SettingsError[] {
  const sheetOrder = (e: SettingsError) => SETTINGS_SHEETS.findIndex((s) => s.name === e.sheet);
  return [...errors].sort((a, b) => sheetOrder(a) - sheetOrder(b) || (a.row ?? 0) - (b.row ?? 0));
}
