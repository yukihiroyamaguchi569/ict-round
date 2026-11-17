import { useCallback, useEffect, useState } from 'react';
import { createFacilityRound, type CreateRoundInput, type FacilityRound } from './facilityRound';
import { parseStoredRound } from './storedFacilityRound';
import { openFacilityDb, requestPersistentStorage, type FacilityDb } from './roundDb';
import { whenSaved } from './useFacilityRound';
import { saveErrorMessage } from '../roundData';
import { newLocalId } from '../localId';

export type RoundsStatus = 'loading' | 'ready' | 'unavailable';

/** What start() reports: saved, no department to visit (nothing saved), or a failed save. */
export type StartResult = 'started' | 'no-departments' | 'failed';

/** start()'s result, with the id of the round when it was started. */
export type StartOutcome = { result: 'started'; id: string } | { result: Exclude<StartResult, 'started'> };

export type StartRoundInput = Omit<CreateRoundInput, 'id'>;

export interface FacilityRoundsOptions {
  /** IndexedDB to use; the global one by default. */
  factory?: IDBFactory;
  newId?: () => string;
  storage?: Pick<StorageManager, 'persist'>;
}

export const DELETE_ERROR_MESSAGE = '削除できませんでした。しばらくしてからもう一度お試しください。';

/** Valid rounds out of the stored records, newest start first; broken records are left out. */
export function toRoundList(records: unknown[]): FacilityRound[] {
  return records
    .map(parseStoredRound)
    .filter((round): round is FacilityRound => round !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** The list with the round of the same id swapped for `round`; a round not in the list is not added. */
function replaceRound(list: FacilityRound[], round: FacilityRound): FacilityRound[] {
  return list.map((r) => (r.id === round.id ? round : r));
}

/** Opens the database and reads the rounds; null (with the database closed) when either fails. */
async function openAndList(factory: IDBFactory | undefined): Promise<{ db: FacilityDb; rounds: FacilityRound[] } | null> {
  const open = await openFacilityDb(factory);
  if (!open.ok) return null;
  const list = await open.value.listRounds();
  if (!list.ok) {
    open.value.close();
    return null;
  }
  return { db: open.value, rounds: toRoundList(list.value) };
}

/**
 * Rounds saved on this device (IndexedDB): the list, starting a round and deleting one.
 * Never throws; a database that cannot be opened or read makes the status "unavailable",
 * and a failed write comes back as a message in `error`.
 */
export function useFacilityRounds({ factory, newId = newLocalId, storage }: FacilityRoundsOptions = {}) {
  // The database is held only while the status is "ready".
  const [conn, setConn] = useState<{ status: RoundsStatus; db?: FacilityDb }>({ status: 'loading' });
  const { status, db } = conn;
  const [rounds, setRounds] = useState<FacilityRound[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let opened: FacilityDb | null = null;
    void openAndList(factory).then((loaded) => {
      if (cancelled) {
        loaded?.db.close();
        return;
      }
      if (!loaded) return setConn({ status: 'unavailable' });
      opened = loaded.db;
      setRounds(loaded.rounds);
      setConn({ status: 'ready', db: loaded.db });
    });
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, [factory]);

  const start = useCallback(
    async (input: StartRoundInput): Promise<StartOutcome> => {
      if (!db) return { result: 'failed' };
      const round = createFacilityRound({ ...input, id: newId() });
      if (!round) return { result: 'no-departments' };
      setError(null);
      // The answer does not change what happens next; asking is enough.
      void requestPersistentStorage(storage);
      const saved = await db.putRound(round);
      if (!saved.ok) {
        setError(saveErrorMessage(saved.error));
        return { result: 'failed' };
      }
      setRounds((list) => toRoundList([round, ...list]));
      return { result: 'started', id: round.id };
    },
    [db, newId, storage]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      if (!db) return false;
      setError(null);
      // A save still queued by the input screen just left would otherwise write the round back.
      await whenSaved();
      const deleted = await db.deleteRound(id);
      if (!deleted.ok) {
        setError(DELETE_ERROR_MESSAGE);
        return false;
      }
      setRounds((list) => list.filter((round) => round.id !== id));
      return true;
    },
    [db]
  );

  const clearError = useCallback(() => setError(null), []);

  /** Puts a round saved elsewhere (the input screen) into the list in place of its old copy. */
  const replace = useCallback((round: FacilityRound) => setRounds((list) => replaceRound(list, round)), []);

  return { status, rounds, error, start, remove, clearError, replace };
}
