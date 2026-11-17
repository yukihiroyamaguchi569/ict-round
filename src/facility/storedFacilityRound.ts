import type { FacilityRound, Mark, RoundPhotoRef } from './facilityRound';
import { isRecord, parseDepartment, parseItem, parseList, parseMember } from './storedFacilitySettings';

/**
 * Checks the shape of a round read back from storage.
 * Returns a fresh copy with only the known fields, or null when anything is off.
 */
export function parseStoredRound(value: unknown): FacilityRound | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const texts = parseTexts(value);
  const items = parseList(value.items, parseItem);
  const departments = parseList(value.departments, parseDepartment);
  const members = parseList(value.members, parseMember);
  const marks = parseRecord(value.marks, parseDepartmentMarks);
  const departmentComments = parseRecord(value.departmentComments, parseString);
  const photos = parseList(value.photos, parsePhotoRef);
  if (!texts || !items || !departments || !members || !marks || !departmentComments || !photos) return null;
  return { version: 1, ...texts, items, departments, members, marks, departmentComments, photos };
}

type RoundTexts = Pick<FacilityRound, 'id' | 'startedAt' | 'themeName' | 'overallComment'>;

function parseTexts(value: Record<string, unknown>): RoundTexts | null {
  const { id, startedAt, themeName, overallComment } = value;
  if (typeof id !== 'string' || typeof startedAt !== 'string' || typeof themeName !== 'string') return null;
  if (typeof overallComment !== 'string') return null;
  return { id, startedAt, themeName, overallComment };
}

/**
 * Parses every value of a plain object; null when the value is not one or any value is invalid.
 * Object.fromEntries defines own properties, so a key such as "__proto__" stays an ordinary key.
 */
function parseRecord<T>(value: unknown, parseValue: (v: unknown) => T | null): Record<string, T> | null {
  if (!isRecord(value)) return null;
  const entries: [string, T][] = [];
  for (const [key, v] of Object.entries(value)) {
    const parsed = parseValue(v);
    if (parsed === null) return null;
    entries.push([key, parsed]);
  }
  return Object.fromEntries(entries);
}

function parseString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseMark(value: unknown): Mark | null {
  return value === 'ok' || value === 'ng' ? value : null;
}

function parseDepartmentMarks(value: unknown): Record<string, Mark> | null {
  return parseRecord(value, parseMark);
}

function parsePhotoRef(value: unknown): RoundPhotoRef | null {
  if (!isRecord(value)) return null;
  const { id, department, itemId, comment, takenAt, width, height } = value;
  if (typeof id !== 'string' || typeof department !== 'string' || typeof itemId !== 'string') return null;
  if (typeof comment !== 'string' || typeof takenAt !== 'string') return null;
  const ref: RoundPhotoRef = { id, department, itemId, comment, takenAt };
  if (typeof width === 'number') ref.width = width;
  if (typeof height === 'number') ref.height = height;
  return ref;
}
