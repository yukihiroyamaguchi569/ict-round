import type { FacilityDepartment, FacilityMember, ThemeItem } from './facilitySettings';
import {
  departmentComment,
  isApplicable,
  markOf,
  type FacilityRound,
  type Mark,
  type RoundPhotoRef,
} from './facilityRound';
import { localDateString } from '../localDate';

export interface MergeConflict {
  department: string;
  itemText: string;
}

/** What a merge did, for the screen to list (the wording is the screen's). */
export interface MergeReport {
  /** Departments only the other device visited, added to the end of this round. */
  addedDepartments: string[];
  /** Cells marked differently on the two devices (× was taken), or ○ here with the other device's photo. */
  conflicts: MergeConflict[];
  /** Texts of the other device's items missing here whose marks or photos were left out; no duplicates. */
  unknownItems: string[];
  /** Cells of the other device left out because the item does not apply to the department here. */
  notApplicableCells: number;
  /** The two rounds started on different local dates. */
  differentDay: boolean;
  addedPhotos: number;
}

export type MergeResult =
  | { ok: true; round: FacilityRound; newPhotoIds: string[]; report: MergeReport }
  | { ok: false; reason: 'theme-mismatch' };

/** Where a cell of the other device lands here. */
interface CellTarget {
  department: FacilityDepartment;
  item: ThemeItem;
}

/**
 * Merges the round of another device into this one (base). The two devices read their settings separately,
 * so items are matched by text and departments by name, never by id. Pure: neither input is changed.
 * Merging the same round twice gives the same result as merging it once.
 */
export function mergeFacilityRounds(base: FacilityRound, incoming: FacilityRound): MergeResult {
  if (base.themeName !== incoming.themeName) return { ok: false, reason: 'theme-mismatch' };
  const baseNames = new Set(base.departments.map((d) => d.name));
  const added = incoming.departments.filter((d) => !baseNames.has(d.name)).map((d) => ({ ...d }));
  const departments = [...base.departments.map((d) => ({ ...d })), ...added];
  const merger = new CellMerger(base, incoming, departments);
  merger.mergeMarks();
  const newPhotos = merger.mergePhotos();
  const round: FacilityRound = {
    ...base,
    items: base.items.map((item) => ({
      ...item,
      targetGroups: [...item.targetGroups],
      excludedDepartments: [...item.excludedDepartments],
    })),
    departments,
    members: mergeMembers(base.members, incoming.members),
    marks: merger.marks(),
    departmentComments: mergeDepartmentComments(base, incoming),
    overallComment: mergeText(base.overallComment, incoming.overallComment),
    photos: [...base.photos.map((p) => ({ ...p })), ...newPhotos],
  };
  const report: MergeReport = {
    addedDepartments: added.map((d) => d.name),
    conflicts: merger.conflicts,
    unknownItems: [...merger.unknownItems],
    notApplicableCells: merger.notApplicable.size,
    differentDay: localDay(base.startedAt) !== localDay(incoming.startedAt),
    addedPhotos: newPhotos.length,
  };
  return { ok: true, round, newPhotoIds: newPhotos.map((p) => p.id), report };
}

/** Collects marks, photos and the report while the other device's cells are moved onto this round's items. */
class CellMerger {
  readonly conflicts: MergeConflict[] = [];
  readonly unknownItems = new Set<string>();
  readonly notApplicable = new Set<string>();
  private readonly marksByDepartment = new Map<string, Map<string, Mark>>();

  private readonly base: FacilityRound;
  private readonly incoming: FacilityRound;
  private readonly departments: FacilityDepartment[];

  constructor(base: FacilityRound, incoming: FacilityRound, departments: FacilityDepartment[]) {
    this.base = base;
    this.incoming = incoming;
    this.departments = departments;
    for (const [department, marks] of Object.entries(base.marks)) {
      this.marksByDepartment.set(department, new Map(Object.entries(marks)));
    }
  }

  /** Marks on the cells the other device showed (applicable there); marks left on hidden cells are not taken. */
  mergeMarks(): void {
    for (const department of this.incoming.departments) {
      for (const item of this.incoming.items) {
        const mark = markOf(this.incoming, department.name, item.id);
        if (mark === undefined || !isApplicable(item, department)) continue;
        const target = this.locate(department.name, item.id);
        if (target) this.putMark(target.department.name, target.item, mark);
      }
    }
  }

  /** Photos whose id is new here, on cells that exist and apply here; their cells become ×. */
  mergePhotos(): RoundPhotoRef[] {
    const ids = new Set(this.base.photos.map((p) => p.id));
    const added: RoundPhotoRef[] = [];
    for (const photo of this.incoming.photos) {
      if (ids.has(photo.id)) continue;
      const target = this.locate(photo.department, photo.itemId);
      if (!target) continue;
      this.putMark(target.department.name, target.item, 'ng');
      ids.add(photo.id);
      added.push({ ...photo, itemId: target.item.id });
    }
    return added;
  }

  marks(): Record<string, Record<string, Mark>> {
    return Object.fromEntries(
      [...this.marksByDepartment].map(([department, marks]) => [department, Object.fromEntries(marks)])
    );
  }

  /** The cell here, or null when it is left out (counted in the report when the item is missing or does not apply). */
  private locate(departmentName: string, incomingItemId: string): CellTarget | null {
    const incomingItem = this.incoming.items.find((i) => i.id === incomingItemId);
    // Only the other round's own departments: the merged list also holds departments it never visited.
    const known = this.incoming.departments.some((d) => d.name === departmentName);
    const department = this.departments.find((d) => d.name === departmentName);
    if (!incomingItem || !known || !department) return null;
    const item = this.base.items.find((i) => i.text === incomingItem.text);
    if (!item) {
      this.unknownItems.add(incomingItem.text);
      return null;
    }
    if (!isApplicable(item, department)) {
      this.notApplicable.add(JSON.stringify([departmentName, item.id]));
      return null;
    }
    return { department, item };
  }

  /**
   * Takes the mark when the cell has none; when the two differ, × wins and the cell is reported.
   * A cell is reported at most once: after a conflict it holds ×, and a later × no longer differs.
   */
  private putMark(departmentName: string, item: ThemeItem, mark: Mark): void {
    const marks = this.marksByDepartment.get(departmentName) ?? new Map<string, Mark>();
    this.marksByDepartment.set(departmentName, marks);
    const current = marks.get(item.id);
    if (current === undefined || current === mark) {
      marks.set(item.id, mark);
      return;
    }
    marks.set(item.id, 'ng');
    this.conflicts.push({ department: departmentName, itemText: item.text });
  }
}

/** Members of this round, then the other device's members not here; the same name and role is one person. */
function mergeMembers(base: FacilityMember[], incoming: FacilityMember[]): FacilityMember[] {
  const key = (m: FacilityMember) => JSON.stringify([m.name, m.role]);
  const seen = new Set(base.map(key));
  const merged = base.map((m) => ({ ...m }));
  for (const member of incoming) {
    if (seen.has(key(member))) continue;
    seen.add(key(member));
    merged.push({ ...member });
  }
  return merged;
}

/** Comments of this round's departments, plus those of the other device's departments (added ones included). */
function mergeDepartmentComments(base: FacilityRound, incoming: FacilityRound): Record<string, string> {
  const comments = new Map(Object.entries(base.departmentComments));
  for (const department of incoming.departments) {
    const text = departmentComment(incoming, department.name);
    comments.set(department.name, mergeText(comments.get(department.name) ?? '', text));
  }
  return Object.fromEntries([...comments].filter(([, text]) => text !== ''));
}

/**
 * One text when one side is empty or the two say the same, otherwise both joined by a line break.
 * Surrounding spaces are ignored, and a text already contained line by line in the other is not added again,
 * so merging twice, or merging back a round that already holds this one, does not repeat it.
 */
function mergeText(base: string, incoming: string): string {
  const a = base.trim();
  const b = incoming.trim();
  if (b === '' || containsLines(a, b)) return base;
  if (a === '' || containsLines(b, a)) return incoming;
  return `${base}\n${incoming}`;
}

function containsLines(whole: string, part: string): boolean {
  return `\n${whole}\n`.includes(`\n${part}\n`);
}

function localDay(iso: string): string {
  return localDateString(new Date(iso));
}
