import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { BuildSettingsResult, FacilitySettings } from '../../facility/facilitySettings';
import { FACILITY_SETTINGS_KEY, loadFacilitySettings, saveFacilitySettings } from '../../facility/facilityStorage';
import { readSettingsFile } from '../../facility/readSettingsFile';
import { newLocalId } from '../../localId';
import { useFacilitySettings } from '../../facility/useFacilitySettings';

vi.mock('../../facility/readSettingsFile', () => ({ readSettingsFile: vi.fn() }));
const readMock = vi.mocked(readSettingsFile);

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function settings(memberName: string): FacilitySettings {
  return {
    version: 1,
    groups: [{ name: '病棟', visit: 'always' }],
    departments: [{ name: '3東', group: '病棟' }],
    themes: [{ name: '手指衛生', items: [{ id: 'i1', text: '項目1', targetGroups: [], excludedDepartments: [] }] }],
    members: [{ name: memberName, role: '看護師' }],
  };
}

const FILE = new File(['x'], 'settings.xlsx');
const ERROR_LIST = [{ sheet: '部署', row: 5, message: 'グループ「外来ウ」が「グループ」シートにありません' }];
const ERRORS: BuildSettingsResult = { ok: false, errors: ERROR_LIST };

/** Picks FILE through the hook's latest loadFile. */
async function pick(result: { current: { loadFile: (file: File) => Promise<void> } }) {
  await act(() => result.current.loadFile(FILE));
}

describe('useFacilitySettings', () => {
  it('starts with no settings when nothing is saved', () => {
    const { result } = renderHook(() => useFacilitySettings());
    expect(result.current).toMatchObject({ settings: null, errors: [], saveFailed: false, loading: false });
  });

  it('starts with the saved settings', () => {
    saveFacilitySettings(settings('前の人'));
    const { result } = renderHook(() => useFacilitySettings());
    expect(result.current.settings).toEqual(settings('前の人'));
  });

  it('starts with no settings when the saved value is broken', () => {
    localStorage.setItem(FACILITY_SETTINGS_KEY, '{"version":1}');
    const { result } = renderHook(() => useFacilitySettings());
    expect(result.current.settings).toBeNull();
  });

  it('reads the file with the local ID generator, saves and shows the new settings', async () => {
    readMock.mockResolvedValueOnce({ ok: true, settings: settings('次の人') });
    const { result } = renderHook(() => useFacilitySettings());
    await pick(result);
    expect(readMock).toHaveBeenCalledWith(FILE, newLocalId);
    expect(result.current.settings).toEqual(settings('次の人'));
    expect(loadFacilitySettings()).toEqual(settings('次の人'));
  });

  it('is loading while the file is read', async () => {
    let resolve: (r: BuildSettingsResult) => void = () => {};
    readMock.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useFacilitySettings());
    let pending: Promise<void> = Promise.resolve();
    act(() => { pending = result.current.loadFile(FILE); });
    expect(result.current.loading).toBe(true);
    await act(async () => { resolve(ERRORS); await pending; });
    expect(result.current.loading).toBe(false);
  });

  it('shows the errors and keeps the saved settings when the file has errors', async () => {
    saveFacilitySettings(settings('前の人'));
    readMock.mockResolvedValueOnce(ERRORS);
    const { result } = renderHook(() => useFacilitySettings());
    await pick(result);
    expect(result.current.errors).toEqual(ERROR_LIST);
    expect(result.current.settings).toEqual(settings('前の人'));
    expect(loadFacilitySettings()).toEqual(settings('前の人'));
  });

  it('clears the earlier errors when a good file is read next', async () => {
    readMock.mockResolvedValueOnce(ERRORS).mockResolvedValueOnce({ ok: true, settings: settings('次の人') });
    const { result } = renderHook(() => useFacilitySettings());
    await pick(result);
    expect(result.current.errors).toHaveLength(1);
    await pick(result);
    expect(result.current.errors).toEqual([]);
    expect(result.current.settings).toEqual(settings('次の人'));
  });

  it('reports a failed save and keeps showing the saved settings', async () => {
    saveFacilitySettings(settings('前の人'));
    readMock.mockResolvedValueOnce({ ok: true, settings: settings('次の人') });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useFacilitySettings());
    await pick(result);
    expect(result.current.saveFailed).toBe(true);
    expect(result.current.settings).toEqual(settings('前の人'));
    setItem.mockRestore();
    expect(loadFacilitySettings()).toEqual(settings('前の人'));
  });

  it('clears the save failure on the next read', async () => {
    readMock
      .mockResolvedValueOnce({ ok: true, settings: settings('次の人') })
      .mockResolvedValueOnce({ ok: true, settings: settings('次の人') });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useFacilitySettings());
    await pick(result);
    expect(result.current.saveFailed).toBe(true);
    await pick(result);
    expect(setItem).toHaveBeenCalledTimes(2);
    expect(result.current.saveFailed).toBe(false);
    expect(result.current.settings).toEqual(settings('次の人'));
  });
});
