import type { ChecklistCategory, ChecklistItemDef, SavedChecklist } from './types';

export interface DraftItem {
  key: string;
  // Kept from the source checklist when copying, so saved rounds can still match items by ID
  id?: string;
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

export function draftFromChecklist(c: SavedChecklist, name: string): EditorDraft {
  return {
    name,
    categories: c.categories.map((cat) => ({
      key: newKey(),
      name: cat.category,
      items: cat.items.map((item) => ({ key: newKey(), id: item.id, description: item.description })),
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
        .map((item) => ({ id: item.id, description: item.description.trim() }))
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

/**
 * Converts the editor draft into a new checklist, or returns a user-facing error.
 * Item IDs from a copied checklist are kept; new items and duplicate IDs get fresh ones.
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

  // Reserve the first occurrence of each kept ID before generating any new one,
  // so a generated ID can never take a kept ID that appears later in the draft
  const usedIds = new Set<string>();
  const keepsId = new Set<object>();
  for (const item of categories.flatMap((cat) => cat.items)) {
    if (item.id && !usedIds.has(item.id)) {
      usedIds.add(item.id);
      keepsId.add(item);
    }
  }
  const idFor = (item: { id?: string }): string => {
    if (item.id && keepsId.has(item)) return item.id;
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
