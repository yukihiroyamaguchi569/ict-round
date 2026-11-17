import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AUTOSAVE_ERROR_MESSAGE, useFacilityRound, whenSaved } from '../../facility/useFacilityRound';
import { IMPORT_PHOTO_ERROR_MESSAGE, fileFailureMessage } from '../../facility/useRoundImport';
import { loadFacilityRoundFile, type LoadFacilityRoundResult } from '../../facility/facilityReportFile';
import { openFacilityDb, type FacilityDb } from '../../facility/roundDb';
import type { FacilityRound } from '../../facility/facilityRound';
import type { FacilityRoundExport } from '../../facility/facilityRoundExport';

vi.mock('../../facility/facilityReportFile', () => ({ loadFacilityRoundFile: vi.fn() }));

const IMAGE = 'data:image/jpeg;base64,AAAA';
const FILE = new Blob(['docx']);

function base(): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-20T05:30:00.000Z',
    themeName: '環境整備',
    items: [
      { id: 'a', text: '高頻度接触面が清拭されている', targetGroups: [], excludedDepartments: [] },
      { id: 'b', text: '汚物処理室に汚れがない', targetGroups: [], excludedDepartments: [] },
    ],
    departments: [{ name: '3東', group: '病棟' }],
    members: [],
    marks: { '3東': { a: 'ok' } },
    departmentComments: {},
    overallComment: '',
    photos: [],
  };
}

/** Another device's round: its own ids, 3東 marked the other way with a photo, and 透析室 that is not here. */
function incoming(): FacilityRound {
  return {
    ...base(),
    id: 'other',
    items: [
      { id: 'x', text: '高頻度接触面が清拭されている', targetGroups: [], excludedDepartments: [] },
      { id: 'y', text: '汚物処理室に汚れがない', targetGroups: [], excludedDepartments: [] },
    ],
    departments: [
      { name: '3東', group: '病棟' },
      { name: '透析室', group: '外来' },
    ],
    marks: { '3東': { x: 'ng' }, 透析室: { y: 'ok' } },
    photos: [{ id: 'p9', department: '3東', itemId: 'x', comment: 'ドアノブ', takenAt: '2026-11-20T05:40:00.000Z' }],
  };
}

function exported(round: FacilityRound = incoming()): FacilityRoundExport {
  return {
    format: 'meguru-facility-round',
    version: 1,
    exportedAt: '2026-11-20T06:00:00.000Z',
    round,
    photos: round.photos.map((p) => ({ id: p.id, dataUrl: IMAGE })),
  };
}

function loads(result: LoadFacilityRoundResult) {
  vi.mocked(loadFacilityRoundFile).mockResolvedValue(result);
}

let factory: IDBFactory;

beforeEach(async () => {
  factory = new IDBFactory();
  await withDb((db) => db.putRound(base()));
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

async function withDb<T>(run: (db: FacilityDb) => Promise<T>): Promise<T> {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('open failed');
  try {
    return await run(open.value);
  } finally {
    open.value.close();
  }
}

async function stored(): Promise<{ round: FacilityRound; images: unknown[] }> {
  return withDb(async (db) => {
    const round = await db.getRound('r1');
    const images = await db.getPhotos('r1');
    if (!round.ok || !images.ok) throw new Error('read failed');
    // Written by the code under test; read back only to inspect it.
    return { round: round.value as FacilityRound, images: images.value };
  });
}

async function renderReady() {
  const hook = renderHook(() => useFacilityRound('r1', { factory }));
  await waitFor(() => expect(hook.result.current.photoData).not.toBeNull());
  return hook;
}

/** What each put wrote: 'photo' for an image record, 'round' for a round record. */
function putKinds(put: { mock: { calls: unknown[][] } }): string[] {
  return put.mock.calls.map(([value]) => (typeof value === 'object' && value !== null && 'dataUrl' in value ? 'photo' : 'round'));
}

describe('useFacilityRound import', () => {
  it('stores the new photo images first, then saves the merged round, and shows the images', async () => {
    loads({ ok: true, export: exported() });
    const { result } = await renderReady();
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');

    await act(() => result.current.importFile(FILE));
    await act(() => whenSaved());

    expect(loadFacilityRoundFile).toHaveBeenCalledWith(FILE);
    expect(putKinds(put)).toEqual(['photo', 'round']);
    expect(put.mock.calls[0][0]).toEqual({ id: 'r1:p9', photoId: 'p9', roundId: 'r1', dataUrl: IMAGE });
    expect(result.current.photoData).toEqual({ p9: IMAGE });
    expect(result.current.round?.marks).toEqual({ '3東': { a: 'ng' }, 透析室: { b: 'ok' } });
    expect(result.current.round?.photos).toEqual([expect.objectContaining({ id: 'p9', itemId: 'a' })]);
    expect(result.current.importOutcome).toEqual({
      kind: 'imported',
      report: {
        addedDepartments: ['透析室'],
        conflicts: [{ department: '3東', itemText: '高頻度接触面が清拭されている' }],
        unknownItems: [],
        notApplicableCells: 0,
        differentDay: false,
        addedPhotos: 1,
      },
    });
    expect(result.current.importing).toBe(false);
    expect(result.current.saveError).toBeNull();
    const after = await stored();
    expect(after.round).toEqual(result.current.round);
    expect(after.images).toEqual([{ id: 'p9', roundId: 'r1', dataUrl: IMAGE }]);
  });

  it('refuses a round of another theme, writing nothing', async () => {
    loads({ ok: true, export: exported({ ...incoming(), themeName: '手指衛生' }) });
    const { result } = await renderReady();
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');

    await act(() => result.current.importFile(FILE));
    expect(result.current.importOutcome).toEqual({
      kind: 'failed',
      message: 'テーマが違うので取り込めません（こちら: 環境整備、ファイル: 手指衛生）。',
    });
    expect(put).not.toHaveBeenCalled();
    expect(result.current.round).toEqual(base());
  });

  it.each([
    ['too-large', '大きすぎる'],
    ['not-docx', 'Word のファイル（.docx）ではない'],
    ['no-round-data', 'ラウンドの記録が入っていません'],
  ] as const)('shows why a file could not be read (%s), writing nothing', async (reason, words) => {
    loads({ ok: false, reason });
    const { result } = await renderReady();
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');

    await act(() => result.current.importFile(FILE));
    expect(result.current.importOutcome).toEqual({ kind: 'failed', message: fileFailureMessage(reason) });
    expect(fileFailureMessage(reason)).toContain(words);
    expect(put).not.toHaveBeenCalled();
  });

  it('saves no round when a photo image cannot be stored', async () => {
    loads({ ok: true, export: exported() });
    const { result } = await renderReady();
    const put = vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(() => {
      throw new Error('boom');
    });

    await act(() => result.current.importFile(FILE));
    await act(() => whenSaved());
    expect(result.current.importOutcome).toEqual({ kind: 'failed', message: IMPORT_PHOTO_ERROR_MESSAGE });
    expect(putKinds(put)).toEqual(['photo']);
    expect(result.current.round).toEqual(base());
    expect(result.current.photoData).toEqual({});
    expect(result.current.saveError).toBeNull();
    put.mockRestore();
    expect(await stored()).toEqual({ round: base(), images: [] });
  });

  it('gives the quota message when the storage is full', async () => {
    loads({ ok: true, export: exported() });
    const { result } = await renderReady();
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    await act(() => result.current.importFile(FILE));
    expect(result.current.importOutcome).toEqual({ kind: 'failed', message: expect.stringContaining('保存容量の上限に達した') });
  });

  it('shows a failed save of the merged round as the autosave failure, not as an import done, keeping it on screen', async () => {
    loads({ ok: true, export: exported() });
    const { result } = await renderReady();
    const realPut = FakeObjectStore.prototype.put;
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: InstanceType<typeof FakeObjectStore>, ...args) {
      const [value] = args;
      if (typeof value === 'object' && value !== null && !('dataUrl' in value)) throw new Error('boom');
      return realPut.apply(this, args);
    });

    await act(() => result.current.importFile(FILE));
    expect(result.current.saveError).toBe(AUTOSAVE_ERROR_MESSAGE);
    expect(result.current.importOutcome).toBeNull();
    expect(result.current.round?.departments.map((d) => d.name)).toEqual(['3東', '透析室']);
    vi.restoreAllMocks();
    const after = await stored();
    expect(after.round).toEqual(base());
    expect(after.images).toHaveLength(1);
  });

  it('ignores a second file while one is being imported', async () => {
    let finish: (result: LoadFacilityRoundResult) => void = () => {};
    vi.mocked(loadFacilityRoundFile).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = await renderReady();

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.importFile(FILE);
    });
    expect(result.current.importing).toBe(true);
    await act(() => result.current.importFile(FILE));
    expect(loadFacilityRoundFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish({ ok: true, export: exported() });
      await first;
    });
    expect(result.current.importing).toBe(false);
    expect(result.current.round?.photos).toHaveLength(1);
  });

  it('says nothing was new, and saves nothing, when the file holds nothing this round lacks', async () => {
    loads({ ok: true, export: exported({ ...base(), id: 'other' }) });
    const { result } = await renderReady();
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');

    await act(() => result.current.importFile(FILE));
    expect(result.current.importOutcome).toEqual({ kind: 'unchanged' });
    expect(put).not.toHaveBeenCalled();
  });

  it('imports the same file a second time without adding anything again', async () => {
    loads({ ok: true, export: exported() });
    const { result } = await renderReady();
    await act(() => result.current.importFile(FILE));
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');

    await act(() => result.current.importFile(FILE));
    expect(result.current.importOutcome).toEqual({ kind: 'unchanged' });
    expect(put).not.toHaveBeenCalled();
    expect(result.current.round?.photos).toHaveLength(1);
  });

  it('merges onto a mark entered while the photo images were being stored', async () => {
    loads({ ok: true, export: exported() });
    const { result } = await renderReady();
    const realPut = FakeObjectStore.prototype.put;
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: InstanceType<typeof FakeObjectStore>, ...args) {
      const [value] = args;
      // The mark goes on screen while the image is being written.
      if (typeof value === 'object' && value !== null && 'dataUrl' in value) result.current.mark('3東', 'b', 'ok');
      return realPut.apply(this, args);
    });

    await act(() => result.current.importFile(FILE));
    await act(() => whenSaved());
    expect(result.current.round?.marks['3東']).toEqual({ a: 'ng', b: 'ok' });
    vi.restoreAllMocks();
    expect((await stored()).round.marks['3東']).toEqual({ a: 'ng', b: 'ok' });
  });

  it('leaves out a photo reference whose image the file does not hold, taking the cell mark still', async () => {
    loads({ ok: true, export: { ...exported(), photos: [] } });
    const { result } = await renderReady();
    const put = vi.spyOn(FakeObjectStore.prototype, 'put');

    await act(() => result.current.importFile(FILE));
    await act(() => whenSaved());
    expect(putKinds(put)).toEqual(['round']);
    expect(result.current.round?.photos).toEqual([]);
    expect(result.current.round?.marks['3東']).toEqual({ a: 'ng' });
    expect(result.current.importOutcome).toEqual({
      kind: 'imported',
      report: expect.objectContaining({ addedPhotos: 0, conflicts: [{ department: '3東', itemText: '高頻度接触面が清拭されている' }] }),
    });
    expect((await stored()).images).toEqual([]);
  });

  it('keeps the photos readable in both rounds when the same file is imported into two rounds on this device', async () => {
    await withDb((db) => db.putRound({ ...base(), id: 'r2' }));
    loads({ ok: true, export: exported() });
    const first = await renderReady();
    await act(() => first.result.current.importFile(FILE));
    first.unmount();
    await whenSaved();

    const second = renderHook(() => useFacilityRound('r2', { factory }));
    await waitFor(() => expect(second.result.current.photoData).not.toBeNull());
    await act(() => second.result.current.importFile(FILE));
    second.unmount();
    await whenSaved();

    const again = await renderReady();
    expect(again.result.current.round?.photos.map((p) => p.id)).toEqual(['p9']);
    expect(again.result.current.photoData).toEqual({ p9: IMAGE });
    const other = renderHook(() => useFacilityRound('r2', { factory }));
    await waitFor(() => expect(other.result.current.photoData).toEqual({ p9: IMAGE }));
    expect(other.result.current.round?.photos.map((p) => p.id)).toEqual(['p9']);
  });
});
