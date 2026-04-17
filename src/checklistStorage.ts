import type { SavedChecklist, SavedRound } from './types';
import { CHECKLIST_CATEGORIES } from './checklistData';

const LIBRARY_KEY = 'icn-round:checklist-library';
const ACTIVE_ID_KEY = 'icn-round:active-checklist-id';

export function loadLibrary(): SavedChecklist[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedChecklist[];
  } catch {
    return [];
  }
}

export function saveLibrary(list: SavedChecklist[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
}

export function addChecklist(c: SavedChecklist): void {
  const list = loadLibrary();
  saveLibrary([...list, c]);
}

export function deleteChecklist(id: string): void {
  const list = loadLibrary().filter((c) => c.id !== id);
  saveLibrary(list);
}

export function getActiveId(): string | null {
  return localStorage.getItem(ACTIVE_ID_KEY);
}

export function setActiveId(id: string): void {
  localStorage.setItem(ACTIVE_ID_KEY, id);
}

const ROUNDS_KEY = 'icn-round:saved-rounds';

export function loadSavedRounds(): SavedRound[] {
  try {
    const raw = localStorage.getItem(ROUNDS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedRound[];
  } catch {
    return [];
  }
}

function writeSavedRounds(rounds: SavedRound[]): void {
  localStorage.setItem(ROUNDS_KEY, JSON.stringify(rounds));
}

export function upsertSavedRound(round: SavedRound): void {
  const rounds = loadSavedRounds();
  const idx = rounds.findIndex((r) => r.id === round.id);
  if (idx >= 0) {
    rounds[idx] = round;
  } else {
    rounds.push(round);
  }
  writeSavedRounds(rounds);
}

export function deleteSavedRound(id: string): void {
  writeSavedRounds(loadSavedRounds().filter((r) => r.id !== id));
}

export function seedDefaultIfFirstRun(): SavedChecklist[] {
  const existing = loadLibrary();
  if (existing.length > 0) return existing;

  const defaultChecklist: SavedChecklist = {
    id: 'default',
    name: '標準チェックリスト',
    createdAt: new Date().toISOString(),
    isDefault: true,
    categories: CHECKLIST_CATEGORIES,
  };
  const seeded = [defaultChecklist];
  saveLibrary(seeded);
  setActiveId('default');
  return seeded;
}
