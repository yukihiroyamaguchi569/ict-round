import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AUTOSAVE_ERROR_MESSAGE, useFacilityRound, whenSaved } from '../../facility/useFacilityRound';
import { PHOTO_SAVE_ERROR_MESSAGE, photoDataUrls } from '../../facility/useRoundPhotos';
import { openFacilityDb, type FacilityDb } from '../../facility/roundDb';
import type { FacilityRound, RoundPhotoRef } from '../../facility/facilityRound';
import type { Photo } from '../../types';

afterEach(() => {
  vi.restoreAllMocks();
});

const IMAGE = 'data:image/jpeg;base64,AAAA';

function round(photos: RoundPhotoRef[] = []): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-20T05:30:00.000Z',
    themeName: '環境整備',
    items: [
      { id: 'a', text: '全部署の項目', targetGroups: [], excludedDepartments: [] },
      { id: 'b', text: '別の項目', targetGroups: [], excludedDepartments: [] },
    ],
    departments: [{ name: '3東', group: '病棟' }],
    members: [],
    marks: { '3東': { a: 'ng', b: 'ok' } },
    departmentComments: {},
    overallComment: '',
    photos,
  };
}

function photo(id = 'p1'): Photo {
  return { id, dataUrl: IMAGE, comment: '床の汚れ', timestamp: '2026/11/20 14:35:00', width: 640, height: 480 };
}

function ref(id = 'p1'): RoundPhotoRef {
  return { id, department: '3東', itemId: 'a', comment: '', takenAt: '2026-11-20T05:35:00.000Z' };
}

async function withDb<T>(factory: IDBFactory, run: (db: FacilityDb) => Promise<T>): Promise<T> {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('open failed');
  try {
    return await run(open.value);
  } finally {
    open.value.close();
  }
}

async function seed(factory: IDBFactory, record: FacilityRound, images: { id: string; dataUrl: unknown }[] = []) {
  await withDb(factory, async (db) => {
    await db.putRound(record);
    for (const image of images) await db.putPhoto({ ...image, roundId: record.id, dataUrl: image.dataUrl as string });
  });
}

async function storedRound(factory: IDBFactory): Promise<FacilityRound> {
  const read = await withDb(factory, (db) => db.getRound('r1'));
  if (!read.ok) throw new Error('get failed');
  // Written by the code under test; read back only to inspect it.
  return read.value as FacilityRound;
}

async function storedImages(factory: IDBFactory): Promise<unknown[]> {
  const read = await withDb(factory, (db) => db.getPhotos('r1'));
  if (!read.ok) throw new Error('getPhotos failed');
  return read.value;
}

async function renderReady(factory: IDBFactory) {
  const hook = renderHook(() => useFacilityRound('r1', { factory }));
  await waitFor(() => expect(hook.result.current.photoData).not.toBeNull());
  return hook;
}

/** What each put wrote: 'photo' for an image record, 'round' for a round record. */
function putKinds(put: { mock: { calls: unknown[][] } }): string[] {
  return put.mock.calls.map(([value]) => (typeof value === 'object' && value !== null && 'dataUrl' in value ? 'photo' : 'round'));
}

describe('useFacilityRound photos', () => {
  it('stores the image first, then adds the reference and saves the round', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const { result } = await renderReady(factory);
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');

    let failure: string | null | undefined;
    await act(async () => {
      failure = await result.current.addPhoto('3東', 'a', photo());
    });
    expect(failure).toBeNull();
    await act(() => whenSaved());

    expect(putKinds(put)).toEqual(['photo', 'round']);
    expect(put.mock.calls[0][0]).toEqual({ id: 'r1:p1', photoId: 'p1', roundId: 'r1', dataUrl: IMAGE });
    expect(result.current.round?.photos).toEqual([
      expect.objectContaining({ id: 'p1', department: '3東', itemId: 'a', comment: '床の汚れ', width: 640, height: 480 }),
    ]);
    const takenAt = result.current.round?.photos[0].takenAt ?? '';
    expect(new Date(takenAt).toISOString()).toBe(takenAt);
    expect((await storedRound(factory)).photos).toEqual(result.current.round?.photos);
    expect(result.current.photoData).toEqual({ p1: IMAGE });
  });

  it('adds no reference and saves no round when the image cannot be stored', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const { result } = await renderReady(factory);
    const put = vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('boom');
    });

    let failure: string | null | undefined;
    await act(async () => {
      failure = await result.current.addPhoto('3東', 'a', photo());
    });
    expect(failure).toBe(PHOTO_SAVE_ERROR_MESSAGE);
    await act(() => whenSaved());
    expect(put).toHaveBeenCalledTimes(1);
    expect(result.current.round?.photos).toEqual([]);
    expect(result.current.photoData).toEqual({});
    expect(result.current.saveError).toBeNull();
    put.mockRestore();
    expect((await storedRound(factory)).photos).toEqual([]);
    expect(await storedImages(factory)).toEqual([]);
  });

  it('gives the quota message when the storage is full', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const { result } = await renderReady(factory);
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    let failure: string | null | undefined;
    await act(async () => {
      failure = await result.current.addPhoto('3東', 'a', photo());
    });
    expect(failure).toContain('保存容量の上限に達した');
  });

  it('shows a failed save of the round like any other autosave failure, with the image kept', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const { result } = await renderReady(factory);
    // The image is stored; the round after it is not.
    const realPut = FakeObjectStore.prototype.put;
    let calls = 0;
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: InstanceType<typeof FakeObjectStore>, ...args) {
      calls += 1;
      if (calls === 2) throw new Error('boom');
      return realPut.apply(this, args);
    });

    await act(async () => {
      await result.current.addPhoto('3東', 'a', photo());
    });
    await waitFor(() => expect(result.current.saveError).toBe(AUTOSAVE_ERROR_MESSAGE));
    expect(result.current.round?.photos).toHaveLength(1);
    vi.restoreAllMocks();
    expect(await storedImages(factory)).toHaveLength(1);
    expect((await storedRound(factory)).photos).toEqual([]);
  });

  it('removes the reference, saves the round and then deletes the image', async () => {
    const factory = new IDBFactory();
    await seed(factory, round([ref('p1'), ref('p2')]), [
      { id: 'p1', dataUrl: IMAGE },
      { id: 'p2', dataUrl: IMAGE },
    ]);
    const { result } = await renderReady(factory);
    expect(result.current.photoData).toEqual({ p1: IMAGE, p2: IMAGE });

    await act(() => result.current.removePhoto('p1'));
    expect(result.current.round?.photos.map((p) => p.id)).toEqual(['p2']);
    expect((await storedRound(factory)).photos.map((p) => p.id)).toEqual(['p2']);
    expect(await storedImages(factory)).toEqual([{ id: 'p2', roundId: 'r1', dataUrl: IMAGE }]);
  });

  it('keeps the image while the round without the reference could not be saved', async () => {
    const factory = new IDBFactory();
    await seed(factory, round([ref('p1')]), [{ id: 'p1', dataUrl: IMAGE }]);
    const { result } = await renderReady(factory);
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('boom');
    });
    const remove = vi.spyOn(FakeObjectStore.prototype, 'delete');

    await act(() => result.current.removePhoto('p1'));
    expect(result.current.saveError).toBe(AUTOSAVE_ERROR_MESSAGE);
    expect(result.current.round?.photos).toEqual([]);
    expect(remove).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(await storedImages(factory)).toHaveLength(1);
    expect((await storedRound(factory)).photos).toHaveLength(1);
  });

  it('does nothing when removing a photo the round does not have', async () => {
    const factory = new IDBFactory();
    await seed(factory, round([ref('p1')]), [{ id: 'p1', dataUrl: IMAGE }]);
    const { result } = await renderReady(factory);
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');
    const remove = vi.spyOn(FakeObjectStore.prototype, 'delete');
    await act(() => result.current.removePhoto('nope'));
    expect(put).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('reads the images again when the round is opened again', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const first = await renderReady(factory);
    await act(async () => {
      await first.result.current.addPhoto('3東', 'a', photo());
    });
    first.unmount();

    const second = await renderReady(factory);
    expect(second.result.current.round?.photos.map((p) => p.id)).toEqual(['p1']);
    expect(second.result.current.photoData).toEqual({ p1: IMAGE });
  });

  it('leaves out images that are missing or not an image data URL, so they show as unreadable', async () => {
    const factory = new IDBFactory();
    await seed(factory, round([ref('p1'), ref('p2'), ref('p3')]), [
      { id: 'p1', dataUrl: IMAGE },
      { id: 'p2', dataUrl: 'javascript:alert(1)' },
    ]);
    const { result } = await renderReady(factory);
    expect(result.current.photoData).toEqual({ p1: IMAGE });
  });

  it('treats every image as unreadable when the images cannot be read', async () => {
    const factory = new IDBFactory();
    await seed(factory, round([ref('p1')]), [{ id: 'p1', dataUrl: IMAGE }]);
    vi.spyOn(FakeObjectStore.prototype, 'index').mockImplementation(() => {
      throw new Error('boom');
    });
    const { result } = await renderReady(factory);
    expect(result.current.photoData).toEqual({});
    expect(result.current.status).toBe('ready');
  });
});

describe('photoDataUrls', () => {
  it('keeps records with a string id and an image data URL', () => {
    expect(photoDataUrls([{ id: 'p1', roundId: 'r1', dataUrl: IMAGE }])).toEqual({ p1: IMAGE });
  });

  it('leaves out records that are not objects, lack an id, or hold no image data URL', () => {
    expect(
      photoDataUrls([
        null,
        'p1',
        [IMAGE],
        { dataUrl: IMAGE },
        { id: 1, dataUrl: IMAGE },
        { id: 'p2', dataUrl: 3 },
        { id: 'p3', dataUrl: 'data:text/html,<b>x</b>' },
        { id: 'p4', dataUrl: 'https://example.com/a.jpg' },
      ])
    ).toEqual({});
  });

  it('keeps an id such as "__proto__" as an own key', () => {
    const urls = photoDataUrls([{ id: '__proto__', dataUrl: IMAGE }]);
    expect(Object.hasOwn(urls, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(urls)).toBe(Object.prototype);
  });
});
