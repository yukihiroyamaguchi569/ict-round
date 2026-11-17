import { IDBDatabase as FakeDatabase, IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FACILITY_DB_NAME,
  openFacilityDb,
  requestPersistentStorage,
  type DbResult,
  type FacilityDb,
} from '../facility/roundDb';

const opened: FacilityDb[] = [];

afterEach(() => {
  for (const db of opened.splice(0)) db.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function unwrap<T>(result: DbResult<T>): T {
  if (!result.ok) throw new Error(`expected ok, got ${String(result.error)}`);
  return result.value;
}

/** Each test gets its own in-memory IndexedDB, so nothing leaks between tests or into globals. */
async function openFresh(factory: IDBFactory = new IDBFactory()): Promise<FacilityDb> {
  const db = unwrap(await openFacilityDb(factory));
  opened.push(db);
  return db;
}

function photo(id: string, roundId: string) {
  return { id, roundId, dataUrl: `data:image/jpeg;base64,${id}` };
}

describe('openFacilityDb', () => {
  it('opens the icn-round-facility database at version 1 with the rounds and photos stores', async () => {
    const factory = new IDBFactory();
    await openFresh(factory);
    const databases = await factory.databases();
    expect(databases).toEqual([{ name: FACILITY_DB_NAME, version: 1 }]);
  });

  it('keeps the data when the database is opened again', async () => {
    const factory = new IDBFactory();
    const first = await openFresh(factory);
    unwrap(await first.putRound({ id: 'r1' }));
    first.close();
    const second = await openFresh(factory);
    expect(unwrap(await second.getRound('r1'))).toEqual({ id: 'r1' });
  });

  it('uses the global indexedDB by default', async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    const db = unwrap(await openFacilityDb());
    opened.push(db);
    unwrap(await db.putRound({ id: 'r1' }));
    expect(await indexedDB.databases()).toEqual([{ name: FACILITY_DB_NAME, version: 1 }]);
  });

  it('fails without throwing when there is no global indexedDB (Node here)', async () => {
    expect(globalThis.indexedDB).toBeUndefined();
    const result = await openFacilityDb();
    expect(result.ok).toBe(false);
  });

  it('fails without throwing when open throws', async () => {
    const factory = new IDBFactory();
    const error = new Error('blocked');
    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw error;
    });
    expect(await openFacilityDb(factory)).toEqual({ ok: false, error });
  });

  it('fails without throwing when reading the global indexedDB throws', async () => {
    const error = new DOMException('denied', 'SecurityError');
    vi.stubGlobal('indexedDB', undefined);
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      get() {
        throw error;
      },
    });
    expect(await openFacilityDb()).toEqual({ ok: false, error });
  });

  it('fails without throwing, and creates no database, when creating the stores throws', async () => {
    const factory = new IDBFactory();
    vi.spyOn(FakeDatabase.prototype, 'createObjectStore').mockImplementation(() => {
      throw new DOMException('broken', 'UnknownError');
    });
    const result = await openFacilityDb(factory);
    expect(result.ok).toBe(false);
    expect(await factory.databases()).toEqual([]);
  });

  it('fails without throwing when the open request errors', async () => {
    const factory = new IDBFactory();
    // A database already at a higher version cannot be opened at version 1 (VersionError).
    await new Promise<void>((resolve) => {
      const request = factory.open(FACILITY_DB_NAME, 2);
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
    });
    const result = await openFacilityDb(factory);
    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as DOMException).name).toBe('VersionError');
  });
});

describe('rounds', () => {
  it('reads back a round as it was written', async () => {
    const db = await openFresh();
    const record = { id: 'r1', departments: ['3東'], nested: { at: 1 } };
    expect(await db.putRound(record)).toEqual({ ok: true, value: undefined });
    expect(unwrap(await db.getRound('r1'))).toEqual(record);
  });

  it('replaces a round with the same id', async () => {
    const db = await openFresh();
    unwrap(await db.putRound({ id: 'r1', v: 1 }));
    unwrap(await db.putRound({ id: 'r1', v: 2 }));
    expect(unwrap(await db.getRound('r1'))).toEqual({ id: 'r1', v: 2 });
    expect(unwrap(await db.listRounds())).toHaveLength(1);
  });

  it('lists every round, and an empty list when there are none', async () => {
    const db = await openFresh();
    expect(unwrap(await db.listRounds())).toEqual([]);
    unwrap(await db.putRound({ id: 'b' }));
    unwrap(await db.putRound({ id: 'a' }));
    expect(unwrap(await db.listRounds())).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('returns ok with undefined for an id that is not saved', async () => {
    const db = await openFresh();
    expect(await db.getRound('missing')).toEqual({ ok: true, value: undefined });
  });

  it('deletes the round together with its photos and leaves other rounds and their photos', async () => {
    const db = await openFresh();
    unwrap(await db.putRound({ id: 'r1' }));
    unwrap(await db.putRound({ id: 'r2' }));
    unwrap(await db.putPhoto(photo('p1', 'r1')));
    unwrap(await db.putPhoto(photo('p2', 'r1')));
    unwrap(await db.putPhoto(photo('p3', 'r2')));

    expect(await db.deleteRound('r1')).toEqual({ ok: true, value: undefined });

    expect(unwrap(await db.getRound('r1'))).toBeUndefined();
    expect(unwrap(await db.getPhotos('r1'))).toEqual([]);
    expect(unwrap(await db.listRounds())).toEqual([{ id: 'r2' }]);
    expect(unwrap(await db.getPhotos('r2'))).toEqual([photo('p3', 'r2')]);
  });

  it('deleting a round that is not saved succeeds and changes nothing', async () => {
    const db = await openFresh();
    unwrap(await db.putRound({ id: 'r1' }));
    expect((await db.deleteRound('missing')).ok).toBe(true);
    expect(unwrap(await db.listRounds())).toEqual([{ id: 'r1' }]);
  });
});

describe('photos', () => {
  it('reads back the photos of a round', async () => {
    const db = await openFresh();
    unwrap(await db.putPhoto(photo('p1', 'r1')));
    unwrap(await db.putPhoto(photo('p2', 'r1')));
    unwrap(await db.putPhoto(photo('p3', 'r2')));
    expect(unwrap(await db.getPhotos('r1'))).toEqual([photo('p1', 'r1'), photo('p2', 'r1')]);
    expect(unwrap(await db.getPhotos('none'))).toEqual([]);
  });

  it('replaces a photo with the same id, also when it moves to another round', async () => {
    const db = await openFresh();
    unwrap(await db.putPhoto(photo('p1', 'r1')));
    unwrap(await db.putPhoto(photo('p1', 'r2')));
    expect(unwrap(await db.getPhotos('r1'))).toEqual([]);
    expect(unwrap(await db.getPhotos('r2'))).toEqual([photo('p1', 'r2')]);
  });

  it('deletes one photo and keeps the others', async () => {
    const db = await openFresh();
    unwrap(await db.putPhoto(photo('p1', 'r1')));
    unwrap(await db.putPhoto(photo('p2', 'r1')));
    expect(await db.deletePhoto('p1')).toEqual({ ok: true, value: undefined });
    expect(unwrap(await db.getPhotos('r1'))).toEqual([photo('p2', 'r1')]);
  });
});

describe('failures come back as results', () => {
  it('a record without an id fails and writes nothing', async () => {
    const db = await openFresh();
    const result = await db.putRound({} as { id: string });
    expect(result.ok).toBe(false);
    if (!result.ok) expect((result.error as DOMException).name).toBe('DataError');
    expect(unwrap(await db.listRounds())).toEqual([]);
  });

  it('a photo without an id fails and writes nothing', async () => {
    const db = await openFresh();
    const result = await db.putPhoto({ roundId: 'r1', dataUrl: 'x' } as unknown as Parameters<FacilityDb['putPhoto']>[0]);
    expect(result.ok).toBe(false);
    expect(unwrap(await db.getPhotos('r1'))).toEqual([]);
  });

  it('a transaction aborted by the browser (e.g. QuotaExceededError) fails with the transaction error', async () => {
    const db = await openFresh();
    const quota = new DOMException('full', 'QuotaExceededError');
    const realPut = FakeObjectStore.prototype.put;
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = realPut.apply(this, args);
      // Stands in for the browser aborting at commit time: the transaction ends with its error set.
      const tx = this.transaction;
      tx.abort();
      Object.defineProperty(tx, 'error', { value: quota });
      return request;
    });
    expect(await db.putRound({ id: 'r1' })).toEqual({ ok: false, error: quota });
    vi.restoreAllMocks();
    expect(unwrap(await db.listRounds())).toEqual([]);
  });

  it('a put that throws (e.g. QuotaExceededError) fails with that error and writes nothing', async () => {
    const db = await openFresh();
    const quota = new DOMException('full', 'QuotaExceededError');
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(() => {
      throw quota;
    });
    expect(await db.putPhoto(photo('p1', 'r1'))).toEqual({ ok: false, error: quota });
    vi.restoreAllMocks();
    expect(unwrap(await db.getPhotos('r1'))).toEqual([]);
  });

  it('a write whose transaction aborts after the request was made fails and writes nothing', async () => {
    const db = await openFresh();
    const realPut = FakeObjectStore.prototype.put;
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = realPut.apply(this, args);
      this.transaction.abort();
      return request;
    });
    const result = await db.putRound({ id: 'r1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBeInstanceOf(Error);
    vi.restoreAllMocks();
    expect(unwrap(await db.listRounds())).toEqual([]);
  });

  it('deleteRound rolls back the round when deleting its photos fails', async () => {
    const db = await openFresh();
    unwrap(await db.putRound({ id: 'r1' }));
    unwrap(await db.putPhoto(photo('p1', 'r1')));
    vi.spyOn(FakeObjectStore.prototype, 'index').mockImplementation(() => {
      throw new DOMException('broken', 'InvalidStateError');
    });
    const result = await db.deleteRound('r1');
    expect(result.ok).toBe(false);
    vi.restoreAllMocks();
    expect(unwrap(await db.getRound('r1'))).toEqual({ id: 'r1' });
    expect(unwrap(await db.getPhotos('r1'))).toEqual([photo('p1', 'r1')]);
  });

  it('every operation fails without throwing after the database is closed', async () => {
    const db = unwrap(await openFacilityDb(new IDBFactory()));
    db.close();
    const results = await Promise.all([
      db.putRound({ id: 'r1' }),
      db.getRound('r1'),
      db.listRounds(),
      db.deleteRound('r1'),
      db.putPhoto(photo('p1', 'r1')),
      db.getPhotos('r1'),
      db.deletePhoto('p1'),
    ]);
    expect(results.map((r) => r.ok)).toEqual([false, false, false, false, false, false, false]);
  });
});

describe('requestPersistentStorage', () => {
  it('returns what persist() answers', async () => {
    expect(await requestPersistentStorage({ persist: () => Promise.resolve(true) })).toBe(true);
    expect(await requestPersistentStorage({ persist: () => Promise.resolve(false) })).toBe(false);
  });

  it('returns false when persist() rejects or throws', async () => {
    expect(await requestPersistentStorage({ persist: () => Promise.reject(new Error('no')) })).toBe(false);
    expect(
      await requestPersistentStorage({
        persist: () => {
          throw new Error('no');
        },
      }),
    ).toBe(false);
  });

  it('returns false when reading navigator.storage throws', async () => {
    vi.stubGlobal('navigator', {
      get storage() {
        throw new Error('denied');
      },
    });
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('returns false when the Storage API is missing (no navigator.storage in Node)', async () => {
    expect(globalThis.navigator?.storage).toBeUndefined();
    expect(await requestPersistentStorage()).toBe(false);
  });
});
