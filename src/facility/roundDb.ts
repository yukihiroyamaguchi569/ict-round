/**
 * Thin Promise wrapper over IndexedDB for the all-department round: round records and their photos.
 * It knows nothing about the round's shape; records are written as given and read back as unknown,
 * so the caller checks the shape. No function here throws: failures come back as { ok: false }.
 */

export type DbResult<T> = { ok: true; value: T } | { ok: false; error: unknown };

export const FACILITY_DB_NAME = 'icn-round-facility';
const DB_VERSION = 1;
const ROUNDS = 'rounds';
const PHOTOS = 'photos';
const PHOTO_ROUND_INDEX = 'roundId';

export interface FacilityDb {
  /** Generic so a record with more fields than id can be passed as a literal. */
  putRound<T extends { id: string }>(record: T): Promise<DbResult<void>>;
  getRound(id: string): Promise<DbResult<unknown>>;
  listRounds(): Promise<DbResult<unknown[]>>;
  /** Deletes the round and every photo of it in one transaction. */
  deleteRound(id: string): Promise<DbResult<void>>;
  putPhoto<T extends { id: string; roundId: string; dataUrl: string }>(photo: T): Promise<DbResult<void>>;
  getPhotos(roundId: string): Promise<DbResult<unknown[]>>;
  deletePhoto(id: string): Promise<DbResult<void>>;
  close(): void;
}

function ok<T>(value: T): DbResult<T> {
  return { ok: true, value };
}

function fail<T>(error: unknown): DbResult<T> {
  return { ok: false, error };
}

/**
 * Runs `work` in a readwrite transaction. Success is the transaction's complete event; a failed
 * request, an abort (QuotaExceededError included) or a synchronous throw from `work` is a failure.
 */
function write(
  db: IDBDatabase,
  stores: string[],
  work: (tx: IDBTransaction) => void,
): Promise<DbResult<void>> {
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, 'readwrite');
    } catch (error) {
      resolve(fail(error));
      return;
    }
    tx.oncomplete = () => resolve(ok(undefined));
    tx.onerror = (event) => resolve(fail((event.target as IDBRequest).error));
    // tx.error is null when the transaction was aborted by a call to abort().
    tx.onabort = () => resolve(fail(tx.error ?? new Error('transaction aborted')));
    try {
      work(tx);
    } catch (error) {
      // e.g. a record without an id: put throws without aborting, so abort here to write nothing.
      resolve(fail(error));
      tx.abort();
    }
  });
}

/** Runs one read request in a readonly transaction on `store`. */
function read<T>(
  db: IDBDatabase,
  store: string,
  query: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<DbResult<T>> {
  return new Promise((resolve) => {
    try {
      const request = query(db.transaction(store, 'readonly').objectStore(store));
      request.onsuccess = () => resolve(ok(request.result));
      request.onerror = () => resolve(fail(request.error));
    } catch (error) {
      resolve(fail(error));
    }
  });
}

function deletePhotosOfRound(photos: IDBObjectStore, roundId: string): void {
  const cursorRequest = photos.index(PHOTO_ROUND_INDEX).openKeyCursor(roundId);
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    photos.delete(cursor.primaryKey);
    cursor.continue();
  };
}

function wrap(db: IDBDatabase): FacilityDb {
  return {
    putRound: (record) => write(db, [ROUNDS], (tx) => tx.objectStore(ROUNDS).put(record)),
    getRound: (id) => read(db, ROUNDS, (store) => store.get(id)),
    listRounds: () => read(db, ROUNDS, (store) => store.getAll()),
    deleteRound: (id) =>
      write(db, [ROUNDS, PHOTOS], (tx) => {
        tx.objectStore(ROUNDS).delete(id);
        deletePhotosOfRound(tx.objectStore(PHOTOS), id);
      }),
    putPhoto: (photo) => write(db, [PHOTOS], (tx) => tx.objectStore(PHOTOS).put(photo)),
    getPhotos: (roundId) => read(db, PHOTOS, (store) => store.index(PHOTO_ROUND_INDEX).getAll(roundId)),
    deletePhoto: (id) => write(db, [PHOTOS], (tx) => tx.objectStore(PHOTOS).delete(id)),
    close: () => db.close(),
  };
}

function createStores(db: IDBDatabase): void {
  db.createObjectStore(ROUNDS, { keyPath: 'id' });
  db.createObjectStore(PHOTOS, { keyPath: 'id' }).createIndex(PHOTO_ROUND_INDEX, 'roundId');
}

/**
 * Opens (and on first use creates) the database. `factory` is the boundary tests replace;
 * it defaults to the global indexedDB, and its absence comes back as a failure.
 */
export function openFacilityDb(
  factory: IDBFactory | undefined = globalThis.indexedDB,
): Promise<DbResult<FacilityDb>> {
  return new Promise((resolve) => {
    if (!factory) {
      resolve(fail(new Error('IndexedDB is not available')));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(FACILITY_DB_NAME, DB_VERSION);
    } catch (error) {
      resolve(fail(error));
      return;
    }
    request.onupgradeneeded = () => createStores(request.result);
    request.onsuccess = () => resolve(ok(wrap(request.result)));
    request.onerror = () => resolve(fail(request.error));
  });
}

/**
 * Asks the browser to keep this site's storage from being evicted. Returns false when the
 * Storage API is missing, the browser declines, or the request throws.
 */
export async function requestPersistentStorage(
  storage: Pick<StorageManager, 'persist'> | undefined = globalThis.navigator?.storage,
): Promise<boolean> {
  if (!storage) return false;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
}
