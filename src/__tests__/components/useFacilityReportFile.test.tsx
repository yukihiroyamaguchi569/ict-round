import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { saveAs } from 'file-saver';
import { buildFacilityDocxBlob } from '../../facility/facilityDocx';
import { embedFacilityRoundExport } from '../../facility/facilityReportFile';
import { facilityReportFileName, useFacilityReportFile } from '../../facility/useFacilityReportFile';
import { trackEvent } from '../../analytics';
import type { FacilityRound } from '../../facility/facilityRound';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../../facility/facilityDocx', () => ({ buildFacilityDocxBlob: vi.fn(() => Promise.resolve(new Blob(['docx']))) }));
vi.mock('../../facility/facilityReportFile', () => ({
  embedFacilityRoundExport: vi.fn(() => Promise.resolve(new Blob(['docx with round']))),
}));

const FILE_NAME = /^ICTround_facility_(\d{4}-\d{2}-\d{2})_[a-z0-9]{4}\.docx$/;

function round(): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    // 00:30 JST on 2026-11-20 is still 2026-11-19 in UTC
    startedAt: '2026-11-19T15:30:00.000Z',
    themeName: '環境整備',
    items: [{ id: 'a', text: '高頻度接触面が清拭されている', targetGroups: [], excludedDepartments: [] }],
    departments: [{ name: '3東', group: '病棟' }],
    members: [],
    marks: { '3東': { a: 'ng' } },
    departmentComments: {},
    overallComment: '',
    photos: [{ id: 'p1', department: '3東', itemId: 'a', comment: '', takenAt: '2026-11-19T15:40:00.000Z' }],
  };
}

const PHOTOS = { p1: 'data:image/jpeg;base64,AAAA' };

function stubShare(impl: () => Promise<void> = () => Promise.resolve()) {
  const share = vi.fn<(data: ShareData) => Promise<void>>(impl);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
  return share;
}

async function renderBuilt(r = round()) {
  const hook = renderHook(() => useFacilityReportFile(r, PHOTOS));
  await waitFor(() => expect(hook.result.current.shareFile).not.toBeNull());
  return hook;
}

beforeEach(() => {
  vi.stubEnv('TZ', 'Asia/Tokyo');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('facilityReportFileName', () => {
  it('uses the round start on the device calendar, not the UTC date', () => {
    expect(facilityReportFileName('2026-11-19T15:30:00.000Z', 'ab12')).toBe('ICTround_facility_2026-11-20_ab12.docx');
  });

  it('falls back to the given date when the start is not a date', () => {
    expect(facilityReportFileName('not a date', 'ab12', new Date('2026-11-18T03:00:00Z'))).toBe(
      'ICTround_facility_2026-11-18_ab12.docx'
    );
  });
});

describe('useFacilityReportFile building', () => {
  it('waits for the photos to be read before building', async () => {
    const r = round();
    const { result, rerender } = renderHook(({ photos }) => useFacilityReportFile(r, photos), {
      initialProps: { photos: null as Record<string, string> | null },
    });
    await act(async () => {});
    expect(buildFacilityDocxBlob).not.toHaveBeenCalled();
    expect(result.current.shareFile).toBeNull();

    rerender({ photos: PHOTOS });
    await waitFor(() => expect(result.current.shareFile).not.toBeNull());
    expect(buildFacilityDocxBlob).toHaveBeenCalledWith(r, PHOTOS);
  });

  it('builds the file with the round and its photo images embedded, named in ASCII with the round date', async () => {
    const r = round();
    const { result } = await renderBuilt(r);

    const exported = vi.mocked(embedFacilityRoundExport).mock.calls[0][1];
    expect(exported.round).toBe(r);
    expect(exported.photos).toEqual([{ id: 'p1', dataUrl: PHOTOS.p1 }]);
    const file = result.current.shareFile;
    expect(file?.name).toMatch(FILE_NAME);
    expect(file?.name.match(FILE_NAME)?.[1]).toBe('2026-11-20');
    expect(await file?.text()).toBe('docx with round');
    expect(result.current.buildError).toBeNull();
  });

  it('hands out no file built from the round before it changed (an import), until the new one is built', async () => {
    const first = round();
    const { result, rerender } = renderHook(({ r }) => useFacilityReportFile(r, PHOTOS), { initialProps: { r: first } });
    await waitFor(() => expect(result.current.shareFile).not.toBeNull());

    let finish: (blob: Blob) => void = () => {};
    vi.mocked(buildFacilityDocxBlob).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const second = { ...first, overallComment: '取り込んだ総評' };
    rerender({ r: second });
    expect(result.current.shareFile).toBeNull();
    act(() => result.current.handleDownload());
    expect(saveAs).not.toHaveBeenCalled();

    await act(async () => finish(new Blob(['docx'])));
    await waitFor(() => expect(result.current.shareFile).not.toBeNull());
    expect(vi.mocked(embedFacilityRoundExport).mock.calls.at(-1)?.[1].round).toBe(second);
  });

  it('reports a build failure and leaves no file to share', async () => {
    vi.mocked(buildFacilityDocxBlob).mockRejectedValueOnce(new Error('too big'));
    const r = round();
    const { result } = renderHook(() => useFacilityReportFile(r, PHOTOS));

    await waitFor(() => expect(result.current.buildError).toBe('too big'));
    expect(result.current.shareFile).toBeNull();
    expect(embedFacilityRoundExport).not.toHaveBeenCalled();
    act(() => result.current.handleDownload());
    expect(saveAs).not.toHaveBeenCalled();
  });

  it('reports a failure to embed the round data', async () => {
    vi.mocked(embedFacilityRoundExport).mockRejectedValueOnce('zip broke');
    const r = round();
    const { result } = renderHook(() => useFacilityReportFile(r, PHOTOS));

    await waitFor(() => expect(result.current.buildError).toBe('zip broke'));
    expect(result.current.shareFile).toBeNull();
  });
});

describe('useFacilityReportFile sharing and downloading', () => {
  it('cannot share when the device has no file sharing', async () => {
    const { result } = await renderBuilt();
    expect(result.current.canShare).toBe(false);
  });

  it('shares the built file with a title and text, without sending any analytics event', async () => {
    const share = stubShare();
    const { result } = await renderBuilt();
    expect(result.current.canShare).toBe(true);

    act(() => result.current.handleShare());
    // Called before any await, so iOS keeps the share sheet open.
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0][0];
    expect(data.files?.[0]).toBe(result.current.shareFile);
    expect(data.title).toBe('感染対策ラウンド 環境整備');
    expect(data.text).toBe('2026/11/20 00:30');

    await waitFor(() => expect(result.current.sharing).toBe(false));
    expect(result.current.shareFailed).toBe(false);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('ignores a second tap while the share sheet is open', async () => {
    let finish = () => {};
    const share = stubShare(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { result } = await renderBuilt();

    act(() => result.current.handleShare());
    expect(result.current.sharing).toBe(true);
    act(() => result.current.handleShare());
    expect(share).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(result.current.sharing).toBe(false);
  });

  it('treats a cancelled share sheet as no failure', async () => {
    stubShare(() => Promise.reject(new DOMException('cancelled', 'AbortError')));
    const { result } = await renderBuilt();

    act(() => result.current.handleShare());
    await waitFor(() => expect(result.current.sharing).toBe(false));
    expect(result.current.shareFailed).toBe(false);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('switches to the download when sharing fails otherwise', async () => {
    stubShare(() => Promise.reject(new DOMException('busy', 'InvalidStateError')));
    const { result } = await renderBuilt();

    act(() => result.current.handleShare());
    await waitFor(() => expect(result.current.shareFailed).toBe(true));
    expect(result.current.sharing).toBe(false);
  });

  it('downloads the built file under its own name, without sending any analytics event', async () => {
    const { result } = await renderBuilt();

    act(() => result.current.handleDownload());
    const file = result.current.shareFile;
    expect(saveAs).toHaveBeenCalledWith(file, file?.name);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('does not share before the file is built', () => {
    vi.mocked(buildFacilityDocxBlob).mockImplementationOnce(() => new Promise(() => {}));
    const share = stubShare();
    const r = round();
    const { result } = renderHook(() => useFacilityReportFile(r, PHOTOS));

    act(() => result.current.handleShare());
    expect(share).not.toHaveBeenCalled();
    expect(result.current.sharing).toBe(false);
  });
});
