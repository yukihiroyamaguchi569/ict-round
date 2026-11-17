import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  AUTOSAVE_ERROR_MESSAGE,
  autosaveErrorMessage,
  useFacilityRound,
  type FacilityRoundOptions,
} from '../../facility/useFacilityRound';
import { openFacilityDb } from '../../facility/roundDb';
import type { FacilityRound } from '../../facility/facilityRound';

afterEach(() => {
  vi.restoreAllMocks();
});

function round(): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-20T05:30:00.000Z',
    themeName: '環境整備',
    items: [
      { id: 'a', text: '全部署の項目', targetGroups: [], excludedDepartments: [] },
      { id: 'b', text: '病棟だけの項目', targetGroups: ['病棟'], excludedDepartments: [] },
    ],
    departments: [
      { name: '3東', group: '病棟' },
      { name: '透析室', group: '外来' },
    ],
    members: [],
    marks: {},
    departmentComments: {},
    overallComment: '',
    photos: [],
  };
}

async function seed<T extends { id: string }>(factory: IDBFactory, record: T) {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('seed: open failed');
  await open.value.putRound(record);
  open.value.close();
}

async function stored(factory: IDBFactory, id = 'r1'): Promise<unknown> {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('stored: open failed');
  const read = await open.value.getRound(id);
  open.value.close();
  if (!read.ok) throw new Error('stored: get failed');
  return read.value;
}

async function renderLoaded(options: FacilityRoundOptions, id = 'r1') {
  const hook = renderHook(() => useFacilityRound(id, options));
  await waitFor(() => expect(hook.result.current.status).not.toBe('loading'));
  return hook;
}

/** Waits until the stored round's marks equal `marks`. */
async function expectStoredMarks(factory: IDBFactory, marks: FacilityRound['marks']) {
  await waitFor(async () => expect(await stored(factory)).toMatchObject({ marks }));
}

describe('autosaveErrorMessage', () => {
  it('uses the quota message for a full storage', () => {
    expect(autosaveErrorMessage(new DOMException('full', 'QuotaExceededError'))).toContain('保存容量の上限に達した');
  });

  it('uses the autosave message for any other failure', () => {
    expect(autosaveErrorMessage(new Error('boom'))).toBe(AUTOSAVE_ERROR_MESSAGE);
    expect(autosaveErrorMessage(undefined)).toBe(AUTOSAVE_ERROR_MESSAGE);
  });
});

describe('useFacilityRound', () => {
  it('starts loading, then reads the stored round', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const hook = renderHook(() => useFacilityRound('r1', { factory }));
    expect(hook.result.current.status).toBe('loading');
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(hook.result.current.round).toEqual(round());
    expect(hook.result.current.saveError).toBeNull();
  });

  it('is missing when the round is not stored', async () => {
    const { result } = await renderLoaded({ factory: new IDBFactory() });
    expect(result.current.status).toBe('missing');
    expect(result.current.round).toBeNull();
  });

  it('is missing when the stored round is broken', async () => {
    const factory = new IDBFactory();
    await seed(factory, { id: 'r1', version: 1, themeName: 3 });
    const { result } = await renderLoaded({ factory });
    expect(result.current.status).toBe('missing');
  });

  it('is missing when the database cannot be opened', async () => {
    const factory = new IDBFactory();
    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const { result } = await renderLoaded({ factory });
    expect(result.current.status).toBe('missing');
  });

  it('saves a mark, and reports the saved round', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const onSaved = vi.fn();
    const { result } = await renderLoaded({ factory, onSaved });
    act(() => result.current.mark('3東', 'a', 'ok'));
    expect(result.current.round?.marks).toEqual({ '3東': { a: 'ok' } });
    await expectStoredMarks(factory, { '3東': { a: 'ok' } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0][0]).toMatchObject({ id: 'r1', marks: { '3東': { a: 'ok' } } });
  });

  it('keeps the last state when marks change quickly one after another', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const { result } = await renderLoaded({ factory });
    act(() => {
      result.current.mark('3東', 'a', 'ok');
      result.current.mark('3東', 'b', 'ng');
      result.current.mark('3東', 'a', 'ok');
    });
    expect(result.current.round?.marks).toEqual({ '3東': { b: 'ng' } });
    await expectStoredMarks(factory, { '3東': { b: 'ng' } });
    // Every queued save has run; the stored round is still the last one.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await stored(factory)).toMatchObject({ marks: { '3東': { b: 'ng' } } });
  });

  it('neither changes nor saves a not-applicable cell', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');
    const { result } = await renderLoaded({ factory });
    act(() => result.current.mark('透析室', 'b', 'ok'));
    expect(result.current.round?.marks).toEqual({});
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(put).not.toHaveBeenCalled();
  });

  it('shows a failed save, keeps the mark on screen, and saves everything on the next change', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const onSaved = vi.fn();
    const { result } = await renderLoaded({ factory, onSaved });
    const put = vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    act(() => result.current.mark('3東', 'a', 'ng'));
    await waitFor(() => expect(result.current.saveError).toBe(AUTOSAVE_ERROR_MESSAGE));
    expect(result.current.round?.marks).toEqual({ '3東': { a: 'ng' } });
    expect(await stored(factory)).toMatchObject({ marks: {} });
    expect(onSaved).not.toHaveBeenCalled();

    put.mockRestore();
    act(() => result.current.mark('3東', 'b', 'ok'));
    await waitFor(() => expect(result.current.saveError).toBeNull());
    expect(await stored(factory)).toMatchObject({ marks: { '3東': { a: 'ng', b: 'ok' } } });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('shows the quota message when the storage is full', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const { result } = await renderLoaded({ factory });
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    act(() => result.current.mark('3東', 'a', 'ok'));
    await waitFor(() => expect(result.current.saveError).toContain('保存容量の上限に達した'));
  });

  it('reads a round opened again only after the saves of the screen just left, so no change is lost', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const first = await renderLoaded({ factory });
    act(() => {
      first.result.current.mark('3東', 'a', 'ok');
      first.result.current.mark('3東', 'b', 'ng');
    });
    first.unmount();

    const second = await renderLoaded({ factory });
    expect(second.result.current.round?.marks).toEqual({ '3東': { a: 'ok', b: 'ng' } });
    act(() => second.result.current.mark('透析室', 'a', 'ok'));
    await expectStoredMarks(factory, { '3東': { a: 'ok', b: 'ng' }, 透析室: { a: 'ok' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await stored(factory)).toMatchObject({ marks: { '3東': { a: 'ok', b: 'ng' }, 透析室: { a: 'ok' } } });
  });

  it('writes the queued saves before closing the database on unmount', async () => {
    const factory = new IDBFactory();
    await seed(factory, round());
    const { result, unmount } = await renderLoaded({ factory });
    act(() => result.current.mark('3東', 'a', 'ok'));
    unmount();
    await expectStoredMarks(factory, { '3東': { a: 'ok' } });
    // Closed afterwards: a version change can only go through once every connection is closed.
    const deleted = await new Promise<string>((resolve) => {
      const request = factory.deleteDatabase('icn-round-facility');
      request.onsuccess = () => resolve('deleted');
      request.onblocked = () => resolve('blocked');
    });
    expect(deleted).toBe('deleted');
  });
});
