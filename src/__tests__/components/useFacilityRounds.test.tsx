import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { DELETE_ERROR_MESSAGE, toRoundList, useFacilityRounds, type FacilityRoundsOptions } from '../../facility/useFacilityRounds';
import { openFacilityDb } from '../../facility/roundDb';
import type { FacilityRound } from '../../facility/facilityRound';
import type { FacilitySettings } from '../../facility/facilitySettings';

afterEach(() => {
  vi.restoreAllMocks();
});

function settings(): FacilitySettings {
  return {
    version: 1,
    groups: [
      { name: '病棟', visit: 'always' },
      { name: '外来', visit: 'select' },
    ],
    departments: [
      { name: '3東', group: '病棟' },
      { name: '内科外来', group: '外来' },
    ],
    themes: [{ name: '手指衛生', items: [{ id: 'a', text: '消毒剤', targetGroups: [], excludedDepartments: [] }] }],
    members: [{ name: '看護 花子', role: '看護師' }],
  };
}

function round(id: string, startedAt: string): FacilityRound {
  return {
    version: 1,
    id,
    startedAt,
    themeName: '手指衛生',
    items: [],
    departments: [{ name: '3東', group: '病棟' }],
    members: [],
    marks: {},
    departmentComments: {},
    overallComment: '',
    photos: [],
  };
}

const startInput = {
  settings: settings(),
  themeName: '手指衛生',
  selectedGroups: ['外来'],
  members: [{ name: '看護 花子', role: '看護師' }],
  startedAt: new Date('2026-11-18T01:30:00Z'),
};

async function seed(factory: IDBFactory, records: { id: string }[]) {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('seed: open failed');
  for (const record of records) await open.value.putRound(record);
  open.value.close();
}

async function stored(factory: IDBFactory): Promise<unknown[]> {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('stored: open failed');
  const list = await open.value.listRounds();
  open.value.close();
  if (!list.ok) throw new Error('stored: list failed');
  return list.value;
}

function persistSpy() {
  return { persist: vi.fn(() => Promise.resolve(true)) };
}

async function renderReady(options: FacilityRoundsOptions) {
  const hook = renderHook(() => useFacilityRounds(options));
  await waitFor(() => expect(hook.result.current.status).not.toBe('loading'));
  return hook;
}

describe('toRoundList', () => {
  it('drops broken records and orders by start time, newest first', () => {
    const list = toRoundList([
      round('old', '2026-11-01T00:00:00.000Z'),
      { id: 'broken', version: 1 },
      null,
      round('new', '2026-11-18T00:00:00.000Z'),
      round('mid', '2026-11-10T00:00:00.000Z'),
    ]);
    expect(list.map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('is empty for no records', () => {
    expect(toRoundList([])).toEqual([]);
  });
});

describe('useFacilityRounds', () => {
  it('starts loading, then is ready with no rounds on a new device', async () => {
    const factory = new IDBFactory();
    const hook = renderHook(() => useFacilityRounds({ factory }));
    expect(hook.result.current.status).toBe('loading');
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    expect(hook.result.current.rounds).toEqual([]);
    expect(hook.result.current.error).toBeNull();
  });

  it('lists the stored rounds newest first and leaves out broken ones', async () => {
    const factory = new IDBFactory();
    await seed(factory, [round('a', '2026-11-01T00:00:00.000Z'), { id: 'broken' }, round('b', '2026-11-08T00:00:00.000Z')]);
    const { result } = await renderReady({ factory });
    expect(result.current.rounds.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('is unavailable when the database cannot be opened', async () => {
    const factory = new IDBFactory();
    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const { result } = await renderReady({ factory });
    expect(result.current.status).toBe('unavailable');
    expect(result.current.rounds).toEqual([]);
  });

  it('is unavailable when the rounds cannot be read', async () => {
    vi.spyOn(FakeObjectStore.prototype, 'getAll').mockImplementation(() => {
      throw new DOMException('read failed', 'UnknownError');
    });
    const { result } = await renderReady({ factory: new IDBFactory() });
    expect(result.current.status).toBe('unavailable');
  });

  it('does not start or delete while unavailable', async () => {
    const factory = new IDBFactory();
    vi.spyOn(factory, 'open').mockImplementation(() => {
      throw new Error('no');
    });
    const storage = persistSpy();
    const { result } = await renderReady({ factory, storage });
    let started: string | undefined;
    await act(async () => {
      started = await result.current.start(startInput);
    });
    expect(started).toBe('failed');
    expect(await act(() => result.current.remove('x'))).toBe(false);
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('starts a round: saves it with the given id, lists it first and asks for persistent storage', async () => {
    const factory = new IDBFactory();
    await seed(factory, [round('old', '2026-11-01T00:00:00.000Z')]);
    const storage = persistSpy();
    const { result } = await renderReady({ factory, newId: () => 'new-id', storage });

    let started: string | undefined;
    await act(async () => {
      started = await result.current.start(startInput);
    });
    expect(started).toBe('started');
    expect(result.current.rounds.map((r) => r.id)).toEqual(['new-id', 'old']);
    const saved = result.current.rounds[0];
    expect(saved).toMatchObject({
      startedAt: '2026-11-18T01:30:00.000Z',
      themeName: '手指衛生',
      departments: [
        { name: '3東', group: '病棟' },
        { name: '内科外来', group: '外来' },
      ],
      members: [{ name: '看護 花子', role: '看護師' }],
    });
    expect(storage.persist).toHaveBeenCalledTimes(1);
    expect(toRoundList(await stored(factory)).map((r) => r.id)).toEqual(['new-id', 'old']);
  });

  it('keeps the list in start-time order when an older round is started', async () => {
    const factory = new IDBFactory();
    await seed(factory, [round('newer', '2026-12-01T00:00:00.000Z')]);
    const { result } = await renderReady({ factory, newId: () => 'older', storage: persistSpy() });
    await act(() => result.current.start(startInput));
    expect(result.current.rounds.map((r) => r.id)).toEqual(['newer', 'older']);
  });

  it('reports no departments and saves nothing when no department would be visited', async () => {
    const factory = new IDBFactory();
    const storage = persistSpy();
    const { result } = await renderReady({ factory, storage });
    const onlySelect: FacilitySettings = { ...settings(), groups: [{ name: '外来', visit: 'select' }, { name: '病棟', visit: 'select' }] };
    let started: string | undefined;
    await act(async () => {
      started = await result.current.start({ ...startInput, settings: onlySelect, selectedGroups: [] });
    });
    expect(started).toBe('no-departments');
    expect(result.current.rounds).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(storage.persist).not.toHaveBeenCalled();
    expect(await stored(factory)).toEqual([]);
  });

  it('reports a full storage with the quota message and lists nothing', async () => {
    const factory = new IDBFactory();
    const { result } = await renderReady({ factory, storage: persistSpy() });
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    let started: string | undefined;
    await act(async () => {
      started = await result.current.start(startInput);
    });
    expect(started).toBe('failed');
    expect(result.current.error).toContain('保存容量の上限に達したため保存できませんでした');
    expect(result.current.rounds).toEqual([]);
    vi.restoreAllMocks();
    expect(await stored(factory)).toEqual([]);
  });

  it('reports any other failed save with the general message, and clears it on the next success', async () => {
    const factory = new IDBFactory();
    const { result } = await renderReady({ factory, newId: () => 'r1', storage: persistSpy() });
    const put = vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await act(() => result.current.start(startInput));
    expect(result.current.error).toBe('保存に失敗しました。しばらくしてからもう一度お試しください。');
    put.mockRestore();
    await act(() => result.current.start(startInput));
    expect(result.current.error).toBeNull();
    expect(result.current.rounds.map((r) => r.id)).toEqual(['r1']);
  });

  it('removes a round from the list and the database', async () => {
    const factory = new IDBFactory();
    await seed(factory, [round('a', '2026-11-01T00:00:00.000Z'), round('b', '2026-11-08T00:00:00.000Z')]);
    const { result } = await renderReady({ factory });
    expect(await act(() => result.current.remove('a'))).toBe(true);
    expect(result.current.rounds.map((r) => r.id)).toEqual(['b']);
    expect((await stored(factory)).map((r) => (r as { id: string }).id)).toEqual(['b']);
  });

  it('keeps the round and reports it when the delete fails', async () => {
    const factory = new IDBFactory();
    await seed(factory, [round('a', '2026-11-01T00:00:00.000Z')]);
    const { result } = await renderReady({ factory });
    vi.spyOn(FakeObjectStore.prototype, 'delete').mockImplementation(() => {
      throw new DOMException('failed', 'UnknownError');
    });
    expect(await act(() => result.current.remove('a'))).toBe(false);
    expect(result.current.error).toBe(DELETE_ERROR_MESSAGE);
    expect(result.current.rounds.map((r) => r.id)).toEqual(['a']);
    vi.restoreAllMocks();
    expect(await stored(factory)).toHaveLength(1);
  });

  it('clears the error with clearError', async () => {
    const factory = new IDBFactory();
    await seed(factory, [round('a', '2026-11-01T00:00:00.000Z')]);
    const { result } = await renderReady({ factory });
    vi.spyOn(FakeObjectStore.prototype, 'delete').mockImplementation(() => {
      throw new Error('no');
    });
    await act(() => result.current.remove('a'));
    expect(result.current.error).not.toBeNull();
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('closes the database when unmounted', async () => {
    const factory = new IDBFactory();
    const { unmount } = await renderReady({ factory });
    unmount();
    // A version change can only go through once every connection is closed.
    const deleted = await new Promise<string>((resolve) => {
      const request = factory.deleteDatabase('icn-round-facility');
      request.onsuccess = () => resolve('deleted');
      request.onblocked = () => resolve('blocked');
    });
    expect(deleted).toBe('deleted');
  });
});
