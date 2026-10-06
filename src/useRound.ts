import { useRef, useState } from 'react';
import type { Photo, Rating, RoundData, SavedChecklist, SavedRound } from './types';
import { snapshotRound, hasUnsavedChanges } from './roundDirty';
import {
  EMPTY_ROUND,
  formatStartTime,
  createRound,
  setRating,
  addPhoto,
  deleteItemPhoto,
  deleteGeneralPhoto,
  setEvaluation,
  setInspectorName,
  buildSavedRound,
  saveErrorMessage,
} from './roundData';

/**
 * The round being recorded: its data, which saved round it came from or was saved as,
 * and a snapshot of what was last saved to detect unsaved changes.
 */
export function useRound() {
  const [roundData, setRoundData] = useState<RoundData>(EMPTY_ROUND);
  const [savedRoundId, setSavedRoundId] = useState<string | null>(null);
  // The participant name pre-filled on the next start screen
  const [carriedInspectorName, setCarriedInspectorName] = useState('');
  const savedSnapshotRef = useRef('');

  const open = (data: RoundData, id: string | null) => {
    setRoundData(data);
    savedSnapshotRef.current = snapshotRound(data);
    setSavedRoundId(id);
  };

  return {
    roundData,
    savedRoundId,
    carriedInspectorName,
    start: (checklist: SavedChecklist, name: string, wardName: string) => {
      open(createRound(checklist, name, wardName, formatStartTime(new Date())), null);
      setCarriedInspectorName(name);
    },
    resume: (saved: SavedRound) => open(saved.roundData, saved.id),
    /** Saves through persist, reusing the saved round's id; on failure alerts and returns false. */
    save: (checklistId: string, persist: (saved: SavedRound) => void): boolean => {
      const id = savedRoundId ?? crypto.randomUUID();
      try {
        persist(buildSavedRound(id, roundData, checklistId, new Date().toISOString()));
      } catch (err) {
        alert(saveErrorMessage(err));
        return false;
      }
      setSavedRoundId(id);
      savedSnapshotRef.current = snapshotRound(roundData);
      return true;
    },
    forgetSavedRound: (id: string) => {
      if (savedRoundId === id) setSavedRoundId(null);
    },
    hasUnsavedChanges: () => hasUnsavedChanges(roundData, savedSnapshotRef.current),
    changeRating: (itemId: string, rating: Rating) => setRoundData((prev) => setRating(prev, itemId, rating)),
    addPhoto: (photo: Photo, itemId?: string) => setRoundData((prev) => addPhoto(prev, photo, itemId)),
    deleteItemPhoto: (itemId: string, photoId: string) =>
      setRoundData((prev) => deleteItemPhoto(prev, itemId, photoId)),
    deleteGeneralPhoto: (photoId: string) => setRoundData((prev) => deleteGeneralPhoto(prev, photoId)),
    changeEvaluation: (text: string) => setRoundData((prev) => setEvaluation(prev, text)),
    changeInspector: (name: string) => {
      setRoundData((prev) => setInspectorName(prev, name));
      setCarriedInspectorName(name);
    },
  };
}
