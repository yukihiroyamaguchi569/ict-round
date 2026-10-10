import type { ChecklistCategory, ChecklistItemDef, SavedChecklist } from './types';

export interface DraftItem {
  key: string;
  // The item this one was copied from. Its ID is kept only while the category name and
  // description still match, so the same ID never stands for different text
  source?: { id: string; category: string; description: string };
  description: string;
}

export interface DraftCategory {
  key: string;
  name: string;
  items: DraftItem[];
}

export interface EditorDraft {
  name: string;
  categories: DraftCategory[];
}

export type BuildResult = { checklist: SavedChecklist } | { error: string };

let keySeq = 0;

/** A key that is unique within this page session; only used as a React key. */
export function newKey(): string {
  keySeq += 1;
  return `k${keySeq}`;
}

/** Local random ID. Math.random is used because crypto.randomUUID fails on HTTP and old iOS. */
export function randomId(): string {
  // eslint-disable-next-line sonarjs/pseudo-random -- local ID only, not security-sensitive
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function emptyItem(): DraftItem {
  return { key: newKey(), description: '' };
}

export function emptyCategory(): DraftCategory {
  return { key: newKey(), name: '', items: [emptyItem()] };
}

export function emptyDraft(): EditorDraft {
  return { name: '', categories: [emptyCategory()] };
}

/** Whether the draft is still as emptyDraft() made it: no name, one unnamed category with one blank item. */
export function isEmptyDraft(draft: EditorDraft): boolean {
  if (draft.name.trim() !== '' || draft.categories.length !== 1) return false;
  const [category] = draft.categories;
  return category.name.trim() === '' && category.items.length === 1 && category.items[0].description.trim() === '';
}

/** Puts imported categories into the draft: they replace an untouched empty draft, otherwise they go at the end. */
export function addImportedCategories(draft: EditorDraft, imported: DraftCategory[]): EditorDraft {
  const categories = isEmptyDraft(draft) ? imported : [...draft.categories, ...imported];
  return { ...draft, categories };
}

export function draftFromChecklist(c: SavedChecklist, name: string): EditorDraft {
  return {
    name,
    categories: c.categories.map((cat) => ({
      key: newKey(),
      name: cat.category,
      items: cat.items.map((item) => ({
        key: newKey(),
        source: { id: item.id, category: cat.category, description: item.description },
        description: item.description,
      })),
    })),
  };
}

/** Returns a copy with the element at index moved by delta; unchanged when the move would leave the array. */
export function moveItem<T>(arr: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index < 0 || index >= arr.length || target < 0 || target >= arr.length) return arr;
  const next = [...arr];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function trimmedCategories(draft: EditorDraft) {
  return draft.categories
    .map((cat) => ({
      name: cat.name.trim(),
      items: cat.items
        .map((item) => ({ source: item.source, description: item.description.trim() }))
        .filter((item) => item.description !== ''),
    }))
    .filter((cat) => cat.items.length > 0);
}

function findDuplicate(names: string[]): string | undefined {
  const seen = new Set<string>();
  return names.find((n) => {
    if (seen.has(n)) return true;
    seen.add(n);
    return false;
  });
}

function validate(name: string, categories: ReturnType<typeof trimmedCategories>): string | null {
  if (!name) return 'チェックリストの名前を入力してください。';
  if (categories.length === 0) return '点検項目を1つ以上入力してください。';
  if (categories.some((cat) => !cat.name)) return '項目のあるカテゴリには名前を入力してください。';
  const dup = findDuplicate(categories.map((cat) => cat.name));
  if (dup !== undefined) return `カテゴリ名「${dup}」が重複しています。別の名前にしてください。`;
  return null;
}

/** The copied items whose category name and description are unchanged; of those sharing an ID, only the first. */
function itemsKeepingSourceId(categories: ReturnType<typeof trimmedCategories>): Set<object> {
  const keptIds = new Set<string>();
  const keepsId = new Set<object>();
  for (const cat of categories) {
    for (const item of cat.items) {
      const { source } = item;
      if (!source) continue;
      // Compared as-is, like the merge's row key, so a source with surrounding spaces gets a new ID
      const unchanged = source.category === cat.name && source.description === item.description;
      if (unchanged && !keptIds.has(source.id)) {
        keptIds.add(source.id);
        keepsId.add(item);
      }
    }
  }
  return keepsId;
}

/**
 * Converts the editor draft into a new checklist, or returns a user-facing error.
 * A copied item keeps its source ID only when the saved (trimmed) category name and description
 * equal the source's exactly; changed items, new items and duplicate IDs get fresh ones.
 */
export function buildChecklist(
  draft: EditorDraft,
  makeId: () => string = randomId,
  now: () => Date = () => new Date(),
): BuildResult {
  const name = draft.name.trim();
  const categories = trimmedCategories(draft);
  const error = validate(name, categories);
  if (error) return { error };

  // Reserve every source ID in the draft, blanked items included, before generating any new one,
  // so a generated ID can never take a kept ID that appears later in the draft, nor reuse the ID
  // of an item whose text changed
  const usedIds = new Set<string>();
  for (const item of draft.categories.flatMap((cat) => cat.items)) {
    if (item.source) usedIds.add(item.source.id);
  }
  const keepsId = itemsKeepingSourceId(categories);
  const idFor = (item: { source?: { id: string } }): string => {
    if (item.source && keepsId.has(item)) return item.source.id;
    let next = `item-${makeId()}`;
    while (usedIds.has(next)) next = `item-${makeId()}`;
    usedIds.add(next);
    return next;
  };

  const built: ChecklistCategory[] = categories.map((cat) => ({
    category: cat.name,
    items: cat.items.map(
      (item): ChecklistItemDef => ({ id: idFor(item), category: cat.name, description: item.description }),
    ),
  }));

  return {
    checklist: { id: makeId(), name, createdAt: now().toISOString(), categories: built },
  };
}
