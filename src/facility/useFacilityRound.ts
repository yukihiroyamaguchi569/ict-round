import { useCallback, useEffect, useRef, useState } from 'react';
import { setMark, type FacilityRound, type Mark } from './facilityRound';
import { parseStoredRound } from './storedFacilityRound';
import { openFacilityDb, type DbResult, type FacilityDb } from './roundDb';
import { saveErrorMessage } from '../roundData';

/** loading, ready to enter, or missing: not stored, broken, or the database cannot be read. */
export type RoundStatus = 'loading' | 'ready' | 'missing';

export interface FacilityRoundOptions {
  /** IndexedDB to use; the global one by default. */
  factory?: IDBFactory;
  /** Called with the round each time it has been saved. */
  onSaved?: (round: FacilityRound) => void;
}

export const AUTOSAVE_ERROR_MESSAGE =
  '保存できませんでした。入力は画面に残っています。次に入力したときに、もう一度保存します。';

/** The quota message of saveErrorMessage when storage is full, otherwise the autosave message. */
export function autosaveErrorMessage(error: unknown): string {
  const message = saveErrorMessage(error);
  return message === saveErrorMessage(null) ? AUTOSAVE_ERROR_MESSAGE : message;
}

/**
 * Saves of every mount, one after another. Shared so that a round opened again right after leaving it
 * is read only once the saves of the screen just left have been written, and its own saves come after them.
 */
let pendingSaves: Promise<void> = Promise.resolve();

/** Resolves once every save queued so far has been written (or has failed). */
export function whenSaved(): Promise<void> {
  return pendingSaves;
}

/** Opens the database and reads one round; null (with the database closed) when the round cannot be used. */
async function openRound(factory: IDBFactory | undefined, id: string): Promise<{ db: FacilityDb; round: FacilityRound } | null> {
  const open = await openFacilityDb(factory);
  if (!open.ok) return null;
  const read = await open.value.getRound(id);
  const round = read.ok ? parseStoredRound(read.value) : null;
  if (!round) {
    open.value.close();
    return null;
  }
  return { db: open.value, round };
}

/** Queues a write behind every earlier one, of any mount. */
function queueWrite(target: FacilityDb, next: FacilityRound): Promise<DbResult<void>> {
  const done = pendingSaves.then(() => target.putRound(next));
  pendingSaves = done.then(() => undefined);
  return done;
}

/** Saving with the failure message: shown on a failed save, cleared by the next successful one. */
function useAutosave(onSaved: ((round: FacilityRound) => void) | undefined) {
  const [saveError, setSaveError] = useState<string | null>(null);
  // The round as it was last stored (read or written), to tell whether the one on screen still needs saving.
  const lastSaved = useRef<FacilityRound | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  /** Resolves to whether `next` was written. */
  const save = useCallback(async (target: FacilityDb, next: FacilityRound): Promise<boolean> => {
    const saved = await queueWrite(target, next);
    if (!saved.ok) {
      setSaveError(autosaveErrorMessage(saved.error));
      return false;
    }
    lastSaved.current = next;
    setSaveError(null);
    onSavedRef.current?.(next);
    return true;
  }, []);

  return { saveError, save, lastSaved };
}

/**
 * One round being entered: reads it from IndexedDB and saves it after every change.
 * Saves run one after another in the order of the changes (across mounts too), so the last change is what stays stored.
 * A failed save leaves the change on screen, shows `saveError`, and the next change saves everything again.
 */
export function useFacilityRound(id: string, { factory, onSaved }: FacilityRoundOptions = {}) {
  const [status, setStatus] = useState<RoundStatus>('loading');
  const [round, setRound] = useState<FacilityRound | null>(null);
  // Refs so that quick changes build on each other before a re-render.
  const latest = useRef<FacilityRound | null>(null);
  const db = useRef<FacilityDb | null>(null);
  const { saveError, save, lastSaved } = useAutosave(onSaved);

  useEffect(() => {
    let cancelled = false;
    let opened: FacilityDb | null = null;
    void pendingSaves.then(() => openRound(factory, id)).then((loaded) => {
      if (cancelled) {
        loaded?.db.close();
        return;
      }
      if (!loaded) return setStatus('missing');
      opened = loaded.db;
      db.current = loaded.db;
      latest.current = loaded.round;
      lastSaved.current = loaded.round;
      setRound(loaded.round);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
      db.current = null;
      latest.current = null;
      // Close only after the saves already queued have been written.
      void pendingSaves.then(() => opened?.close());
    };
  }, [factory, id, lastSaved]);

  const change = useCallback(
    (apply: (current: FacilityRound) => FacilityRound) => {
      const current = latest.current;
      const target = db.current;
      if (!current || !target) return;
      const next = apply(current);
      if (next === current) return;
      latest.current = next;
      setRound(next);
      void save(target, next);
    },
    [save]
  );

  /**
   * Before leaving: waits for the queued saves, then saves the round on screen again if it is still not
   * stored (a save failed). Resolves to whether the round on screen is stored.
   */
  const saveNow = useCallback(async (): Promise<boolean> => {
    await pendingSaves;
    const current = latest.current;
    const target = db.current;
    if (!current || !target) return false;
    if (current === lastSaved.current) return true;
    return save(target, current);
  }, [save, lastSaved]);

  const mark = useCallback(
    (department: string, itemId: string, value: Mark) => change((current) => setMark(current, department, itemId, value)),
    [change]
  );

  return { status, round, saveError, mark, saveNow };
}
