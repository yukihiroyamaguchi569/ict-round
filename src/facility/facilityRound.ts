import type { FacilityDepartment, FacilityMember, FacilitySettings, ThemeItem } from './facilitySettings';

/** A cell's result: ○ or ×. A cell without a mark is "not checked"; "not applicable" is derived, never stored. */
export type Mark = 'ok' | 'ng';

/** A photo on an × cell. The image itself (dataUrl) is stored separately under `id`. */
export interface RoundPhotoRef {
  id: string;
  department: string;
  itemId: string;
  comment: string;
  takenAt: string;
  width?: number;
  height?: number;
}

/**
 * One all-department round. Holds a copy of the settings taken at the start
 * (theme name, items, departments, members), since reloading the settings changes the item IDs.
 */
export interface FacilityRound {
  version: 1;
  id: string;
  /** ISO 8601. */
  startedAt: string;
  themeName: string;
  items: ThemeItem[];
  /** In the order of the settings' departments. */
  departments: FacilityDepartment[];
  members: FacilityMember[];
  /** Department name -> item id -> mark. */
  marks: Record<string, Record<string, Mark>>;
  departmentComments: Record<string, string>;
  overallComment: string;
  photos: RoundPhotoRef[];
}

export interface Progress {
  marked: number;
  total: number;
}

export interface CreateRoundInput {
  settings: FacilitySettings;
  themeName: string;
  /** Groups picked for this round; `always` groups and unknown names are ignored. */
  selectedGroups: string[];
  members: FacilityMember[];
  startedAt: Date;
  id: string;
}

/** Starts a round, or null when the theme is missing or no department is visited. */
export function createFacilityRound(input: CreateRoundInput): FacilityRound | null {
  const { settings, themeName, selectedGroups } = input;
  const theme = settings.themes.find((t) => t.name === themeName);
  if (!theme) return null;
  const selected = new Set(selectedGroups);
  const visited = new Set(
    settings.groups.filter((g) => g.visit === 'always' || selected.has(g.name)).map((g) => g.name)
  );
  const departments = settings.departments.filter((d) => visited.has(d.group)).map((d) => ({ ...d }));
  if (departments.length === 0) return null;
  return {
    version: 1,
    id: input.id,
    startedAt: input.startedAt.toISOString(),
    themeName: theme.name,
    items: theme.items.map(copyItem),
    departments,
    members: input.members.map((m) => ({ ...m })),
    marks: {},
    departmentComments: {},
    overallComment: '',
    photos: [],
  };
}

function copyItem(item: ThemeItem): ThemeItem {
  return { ...item, targetGroups: [...item.targetGroups], excludedDepartments: [...item.excludedDepartments] };
}

/** An item applies when its target groups are empty or include the department's group, and the department is not excluded. */
export function isApplicable(item: ThemeItem, department: FacilityDepartment): boolean {
  const targeted = item.targetGroups.length === 0 || item.targetGroups.includes(department.group);
  return targeted && !item.excludedDepartments.includes(department.name);
}

function findDepartment(round: FacilityRound, departmentName: string): FacilityDepartment | undefined {
  return round.departments.find((d) => d.name === departmentName);
}

/** Items applying to the department, in item order; [] when the department is not in the round. */
export function applicableItems(round: FacilityRound, departmentName: string): ThemeItem[] {
  const department = findDepartment(round, departmentName);
  if (!department) return [];
  return round.items.filter((item) => isApplicable(item, department));
}

function isApplicableCell(round: FacilityRound, departmentName: string, itemId: string): boolean {
  const department = findDepartment(round, departmentName);
  const item = round.items.find((i) => i.id === itemId);
  return department !== undefined && item !== undefined && isApplicable(item, department);
}

/** Own-property lookup, so a name such as "__proto__" never reaches Object.prototype. */
function ownValue<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function markOf(round: FacilityRound, departmentName: string, itemId: string): Mark | undefined {
  const departmentMarks = ownValue(round.marks, departmentName);
  return departmentMarks && ownValue(departmentMarks, itemId);
}

export function hasPhotos(round: FacilityRound, departmentName: string, itemId: string): boolean {
  return round.photos.some((p) => p.department === departmentName && p.itemId === itemId);
}

/**
 * Sets a cell's mark; the same mark again clears it (back to "not checked").
 * Unknown or not-applicable cells, and cells with photos, are left as they are.
 */
export function setMark(round: FacilityRound, departmentName: string, itemId: string, mark: Mark): FacilityRound {
  if (!isApplicableCell(round, departmentName, itemId) || hasPhotos(round, departmentName, itemId)) return round;
  const current = ownValue(round.marks, departmentName) ?? {};
  // Built with entries / computed keys (never assignment), so an item id such as "__proto__" stays an own key.
  const others = Object.fromEntries(Object.entries(current).filter(([id]) => id !== itemId));
  const departmentMarks = ownValue(current, itemId) === mark ? others : { ...others, [itemId]: mark };
  return { ...round, marks: { ...round.marks, [departmentName]: departmentMarks } };
}

export function setDepartmentComment(round: FacilityRound, departmentName: string, text: string): FacilityRound {
  if (!findDepartment(round, departmentName)) return round;
  return { ...round, departmentComments: { ...round.departmentComments, [departmentName]: text } };
}

export function setOverallComment(round: FacilityRound, text: string): FacilityRound {
  return { ...round, overallComment: text };
}

export function setMembers(round: FacilityRound, members: FacilityMember[]): FacilityRound {
  return { ...round, members: members.map((m) => ({ ...m })) };
}

/** Adds a photo reference only to an applicable cell marked ×; a reference whose id is already present is ignored. */
export function addPhotoRef(round: FacilityRound, ref: RoundPhotoRef): FacilityRound {
  if (!isApplicableCell(round, ref.department, ref.itemId)) return round;
  if (markOf(round, ref.department, ref.itemId) !== 'ng') return round;
  if (round.photos.some((p) => p.id === ref.id)) return round;
  return { ...round, photos: [...round.photos, { ...ref }] };
}

export function removePhotoRef(round: FacilityRound, photoId: string): FacilityRound {
  if (!round.photos.some((p) => p.id === photoId)) return round;
  return { ...round, photos: round.photos.filter((p) => p.id !== photoId) };
}

/** Marked cells out of the applicable items of one department. */
export function departmentProgress(round: FacilityRound, departmentName: string): Progress {
  const items = applicableItems(round, departmentName);
  const marked = items.filter((item) => markOf(round, departmentName, item.id) !== undefined).length;
  return { marked, total: items.length };
}

export function roundProgress(round: FacilityRound): Progress {
  return round.departments.reduce<Progress>(
    (sum, d) => {
      const p = departmentProgress(round, d.name);
      return { marked: sum.marked + p.marked, total: sum.total + p.total };
    },
    { marked: 0, total: 0 }
  );
}
