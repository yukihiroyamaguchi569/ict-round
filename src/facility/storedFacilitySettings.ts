import type {
  FacilityDepartment,
  FacilityGroup,
  FacilityMember,
  FacilitySettings,
  FacilityTheme,
  ThemeItem,
  VisitMode,
} from './facilitySettings';

/**
 * Checks the shape of settings read back from localStorage.
 * Returns a fresh copy with only the known fields, or null when anything is off.
 */
export function parseStoredSettings(value: unknown): FacilitySettings | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const groups = parseList(value.groups, parseGroup);
  const departments = parseList(value.departments, parseDepartment);
  const themes = parseList(value.themes, parseTheme);
  const members = parseList(value.members, parseMember);
  if (!groups || !departments || !themes || !members) return null;
  return { version: 1, groups, departments, themes, members };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isVisitMode(value: unknown): value is VisitMode {
  return value === 'always' || value === 'select';
}

/** Parses every element; null when the value is not an array or any element is invalid. */
export function parseList<T>(value: unknown, parseItem: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: T[] = [];
  for (const item of value) {
    const result = parseItem(item);
    if (result === null) return null;
    parsed.push(result);
  }
  return parsed;
}

function parseGroup(value: unknown): FacilityGroup | null {
  if (!isRecord(value) || typeof value.name !== 'string' || !isVisitMode(value.visit)) return null;
  return { name: value.name, visit: value.visit };
}

export function parseDepartment(value: unknown): FacilityDepartment | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.group !== 'string') return null;
  return { name: value.name, group: value.group };
}

function parseTheme(value: unknown): FacilityTheme | null {
  if (!isRecord(value) || typeof value.name !== 'string') return null;
  const items = parseList(value.items, parseItem);
  return items && { name: value.name, items };
}

export function parseItem(value: unknown): ThemeItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.text !== 'string') return null;
  const { targetGroups, excludedDepartments } = value;
  if (!isStringArray(targetGroups) || !isStringArray(excludedDepartments)) return null;
  return { id: value.id, text: value.text, targetGroups: [...targetGroups], excludedDepartments: [...excludedDepartments] };
}

export function parseMember(value: unknown): FacilityMember | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.role !== 'string') return null;
  return { name: value.name, role: value.role };
}
