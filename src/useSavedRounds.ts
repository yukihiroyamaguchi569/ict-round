import { useState } from 'react';
import type { SavedRound } from './types';
import { loadSavedRounds, upsertSavedRound, deleteSavedRound } from './checklistStorage';

/** Saved rounds in localStorage and the list read back from it. */
export function useSavedRounds() {
  const [savedRounds, setSavedRounds] = useState<SavedRound[]>(() => loadSavedRounds());

  /** Adds or replaces the round. Throws when storage fails (e.g. quota), leaving the list as it was. */
  const save = (round: SavedRound) => {
    upsertSavedRound(round);
    setSavedRounds(loadSavedRounds());
  };

  const remove = (id: string) => {
    deleteSavedRound(id);
    setSavedRounds(loadSavedRounds());
  };

  return { savedRounds, save, remove };
}
