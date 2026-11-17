import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  setDepartmentComment,
  setMark,
  setMembers,
  setOverallComment,
  type FacilityRound,
  type Mark,
} from './facilityRound';
import type { FacilityMember } from './facilitySettings';
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
  /** Milliseconds after the last keystroke before typed text is saved; TEXT_SAVE_DELAY by default. */
  textSaveDelay?: number;
}

/** Typed text is saved once typing pauses this long, not on every keystroke. */
export const TEXT_SAVE_DELAY = 800;

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

/** One pending call, replaced by the next one scheduled: the save of typed text waiting for typing to pause. */
function useTextSaveTimer() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useMemo(() => {
    const cancel = () => {
      if (timer.current === null) return;
      clearTimeout(timer.current);
      timer.current = null;
    };
    const schedule = (run: () => void, delay: number) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        run();
      }, delay);
    };
    return { schedule, cancel, isPending: () => timer.current !== null };
  }, []);
}

interface RoundChangeDeps {
  latestRef: RefObject<FacilityRound | null>;
  dbRef: RefObject<FacilityDb | null>;
  setRound: (round: FacilityRound) => void;
  save: (target: FacilityDb, next: FacilityRound) => Promise<boolean>;
  textSave: ReturnType<typeof useTextSaveTimer>;
  textSaveDelay: number;
}

/** Applying a change on screen and saving it: at once (`change`), or once typing pauses (`changeText`). */
function useRoundChanges({ latestRef, dbRef, setRound, save, textSave, textSaveDelay }: RoundChangeDeps) {
  /** Applies a change on screen; the database and the new round, or null when nothing changed. */
  const applyChange = useCallback((apply: (current: FacilityRound) => FacilityRound) => {
    const current = latestRef.current;
    const target = dbRef.current;
    if (!current || !target) return null;
    const next = apply(current);
    if (next === current) return null;
    latestRef.current = next;
    setRound(next);
    return { target, next };
  }, [latestRef, dbRef, setRound]);

  /** A change saved at once; it also carries any typed text still waiting. */
  const change = useCallback(
    (apply: (current: FacilityRound) => FacilityRound) => {
      const applied = applyChange(apply);
      if (!applied) return;
      textSave.cancel();
      void save(applied.target, applied.next);
    },
    [applyChange, textSave, save]
  );

  /** A change of typed text, saved once typing pauses. */
  const changeText = useCallback(
    (apply: (current: FacilityRound) => FacilityRound) => {
      const applied = applyChange(apply);
      if (!applied) return;
      textSave.schedule(() => {
        if (latestRef.current) void save(applied.target, latestRef.current);
      }, textSaveDelay);
    },
    [applyChange, textSave, save, textSaveDelay, latestRef]
  );

  return { change, changeText };
}

type RoundChange = (apply: (current: FacilityRound) => FacilityRound) => void;

/** The changes the screens make: marks and members saved at once, typed text saved once typing pauses. */
function useRoundActions(change: RoundChange, changeText: RoundChange) {
  const mark = useCallback(
    (department: string, itemId: string, value: Mark) => change((current) => setMark(current, department, itemId, value)),
    [change]
  );
  const writeDepartmentComment = useCallback(
    (department: string, text: string) => changeText((current) => setDepartmentComment(current, department, text)),
    [changeText]
  );
  const writeOverallComment = useCallback(
    (text: string) => changeText((current) => setOverallComment(current, text)),
    [changeText]
  );
  const chooseMembers = useCallback(
    (members: FacilityMember[]) => change((current) => setMembers(current, members)),
    [change]
  );
  return { mark, writeDepartmentComment, writeOverallComment, chooseMembers };
}

export type RoundActions = ReturnType<typeof useRoundActions>;

/**
 * One round being entered: reads it from IndexedDB and saves it after every change.
 * Marks and members are saved at once; typed text is saved once typing pauses (`textSaveDelay`),
 * or earlier with the next immediate save, saveNow, or on unmount.
 * Saves run one after another in the order of the changes (across mounts too), so the last change is what stays stored.
 * A failed save leaves the change on screen, shows `saveError`, and the next change saves everything again.
 */
export function useFacilityRound(
  id: string,
  { factory, onSaved, textSaveDelay = TEXT_SAVE_DELAY }: FacilityRoundOptions = {}
) {
  const [status, setStatus] = useState<RoundStatus>('loading');
  const [round, setRound] = useState<FacilityRound | null>(null);
  // Refs so that quick changes build on each other before a re-render.
  const latest = useRef<FacilityRound | null>(null);
  const db = useRef<FacilityDb | null>(null);
  const { saveError, save, lastSaved } = useAutosave(onSaved);
  const textSave = useTextSaveTimer();

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
      // Typed text still waiting is queued now, so it is written before the database closes.
      if (textSave.isPending() && db.current && latest.current) void save(db.current, latest.current);
      textSave.cancel();
      db.current = null;
      latest.current = null;
      // Close only after the saves already queued have been written.
      void pendingSaves.then(() => opened?.close());
    };
  }, [factory, id, lastSaved, save, textSave]);

  const { change, changeText } = useRoundChanges({ latestRef: latest, dbRef: db, setRound, save, textSave, textSaveDelay });

  /**
   * Before leaving: waits for the queued saves, then saves the round on screen again if it is still not
   * stored (a save failed). Resolves to whether the round on screen is stored.
   */
  const saveNow = useCallback(async (): Promise<boolean> => {
    // Typed text still waiting is covered by the comparison below.
    textSave.cancel();
    await pendingSaves;
    const current = latest.current;
    const target = db.current;
    if (!current || !target) return false;
    if (current === lastSaved.current) return true;
    return save(target, current);
  }, [save, lastSaved, textSave]);

  const actions = useRoundActions(change, changeText);

  return { status, round, saveError, ...actions, saveNow };
}
