import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  AUTOSAVE_ERROR_MESSAGE,
  TEXT_SAVE_DELAY,
  useFacilityRound,
  type FacilityRoundOptions,
} from '../../facility/useFacilityRound';
import { openFacilityDb } from '../../facility/roundDb';
import type { FacilityRound } from '../../facility/facilityRound';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function round(): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-20T05:30:00.000Z',
    themeName: '環境整備',
    items: [{ id: 'a', text: '全部署の項目', targetGroups: [], excludedDepartments: [] }],
    departments: [
      { name: '3東', group: '病棟' },
      { name: '透析室', group: '外来' },
    ],
    members: [{ name: '看護 花子', role: '看護師' }],
    marks: {},
    departmentComments: {},
    overallComment: '',
    photos: [],
  };
}

async function stored(factory: IDBFactory): Promise<unknown> {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('stored: open failed');
  const read = await open.value.getRound('r1');
  open.value.close();
  if (!read.ok) throw new Error('stored: get failed');
  return read.value;
}

/** Seeds the round, loads it with real timers, then switches the timers to fake ones (IndexedDB keeps running on setImmediate). */
async function renderWithFakeTimers(options: Omit<FacilityRoundOptions, 'factory'> = {}) {
  const factory = new IDBFactory();
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('seed: open failed');
  await open.value.putRound(round());
  open.value.close();
  const hook = renderHook(() => useFacilityRound('r1', { factory, ...options }));
  await waitFor(() => expect(hook.result.current.status).toBe('ready'));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const put = vi.spyOn(FakeObjectStore.prototype, 'put');
  return { ...hook, factory, put };
}

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

/** Lets the queued IndexedDB work run (it uses setImmediate, which stays real). */
const settle = () => act(() => new Promise<void>((resolve) => setImmediate(resolve)));

describe('useFacilityRound typed text', () => {
  it('shows each keystroke at once but saves once, with the last text, after the pause', async () => {
    const { result, factory, put } = await renderWithFakeTimers();
    act(() => {
      result.current.writeDepartmentComment('3東', '床');
      result.current.writeDepartmentComment('3東', '床が');
      result.current.writeDepartmentComment('3東', '床が汚れている');
    });
    expect(result.current.round?.departmentComments).toEqual({ '3東': '床が汚れている' });
    await advance(TEXT_SAVE_DELAY - 1);
    await settle();
    expect(put).not.toHaveBeenCalled();

    await advance(1);
    await vi.waitFor(async () => expect(await stored(factory)).toMatchObject({ departmentComments: { '3東': '床が汚れている' } }));
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('starts the wait again with each keystroke', async () => {
    const { result, put } = await renderWithFakeTimers();
    act(() => result.current.writeOverallComment('全'));
    await advance(TEXT_SAVE_DELAY - 100);
    act(() => result.current.writeOverallComment('全体'));
    await advance(TEXT_SAVE_DELAY - 100);
    await settle();
    expect(put).not.toHaveBeenCalled();
    await advance(100);
    await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  });

  it('uses the given delay', async () => {
    const { result, put } = await renderWithFakeTimers({ textSaveDelay: 200 });
    act(() => result.current.writeOverallComment('全体に良好'));
    await advance(199);
    await settle();
    expect(put).not.toHaveBeenCalled();
    await advance(1);
    await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  });

  it('saveNow writes the waiting text at once, and nothing is written again afterwards', async () => {
    const { result, factory, put } = await renderWithFakeTimers();
    act(() => result.current.writeOverallComment('全体に良好'));
    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveNow();
    });
    expect(saved).toBe(true);
    expect(await stored(factory)).toMatchObject({ overallComment: '全体に良好' });
    await advance(TEXT_SAVE_DELAY * 2);
    await settle();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('writes the waiting text when the screen is closed before the pause', async () => {
    const { result, unmount, factory } = await renderWithFakeTimers();
    act(() => result.current.writeDepartmentComment('透析室', '問題なし'));
    unmount();
    await vi.waitFor(async () => expect(await stored(factory)).toMatchObject({ departmentComments: { 透析室: '問題なし' } }));
  });

  it('a mark saved at once carries the waiting text in the same save', async () => {
    const { result, factory, put } = await renderWithFakeTimers();
    act(() => {
      result.current.writeDepartmentComment('3東', '床が汚れている');
      result.current.mark('3東', 'a', 'ng');
    });
    await vi.waitFor(async () =>
      expect(await stored(factory)).toMatchObject({ marks: { '3東': { a: 'ng' } }, departmentComments: { '3東': '床が汚れている' } })
    );
    await advance(TEXT_SAVE_DELAY * 2);
    await settle();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('a failed save of the text shows the failure, and saveNow reports it as not stored', async () => {
    const { result, factory, put } = await renderWithFakeTimers();
    put.mockImplementation(() => {
      throw new Error('boom');
    });
    act(() => result.current.writeOverallComment('全体に良好'));
    await advance(TEXT_SAVE_DELAY);
    await vi.waitFor(() => expect(result.current.saveError).toBe(AUTOSAVE_ERROR_MESSAGE));
    expect(result.current.round?.overallComment).toBe('全体に良好');

    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveNow();
    });
    expect(saved).toBe(false);
    put.mockRestore();
    expect(await stored(factory)).toMatchObject({ overallComment: '' });
  });

  it('saveNow called while the text waits reports a failure of that save', async () => {
    const { result, put } = await renderWithFakeTimers();
    put.mockImplementation(() => {
      throw new Error('boom');
    });
    act(() => result.current.writeOverallComment('全体に良好'));
    let saved: boolean | undefined;
    await act(async () => {
      saved = await result.current.saveNow();
    });
    expect(saved).toBe(false);
    expect(result.current.saveError).toBe(AUTOSAVE_ERROR_MESSAGE);
  });

  it('ignores a comment for a department not in the round', async () => {
    const { result, put } = await renderWithFakeTimers();
    const before = result.current.round;
    act(() => result.current.writeDepartmentComment('無い部署', 'x'));
    expect(result.current.round).toBe(before);
    await advance(TEXT_SAVE_DELAY);
    await settle();
    expect(put).not.toHaveBeenCalled();
  });
});

describe('useFacilityRound members', () => {
  it('saves the chosen members at once', async () => {
    const { result, factory } = await renderWithFakeTimers();
    const members = [{ name: '医師 太郎', role: '医師' }];
    act(() => result.current.chooseMembers(members));
    expect(result.current.round?.members).toEqual(members);
    await vi.waitFor(async () => expect(await stored(factory)).toMatchObject({ members }));
  });
});
