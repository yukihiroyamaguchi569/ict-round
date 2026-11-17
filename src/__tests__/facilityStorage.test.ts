import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FacilitySettings } from '../facility/facilitySettings';
import {
  FACILITY_SETTINGS_KEY,
  clearFacilitySettings,
  loadFacilitySettings,
  saveFacilitySettings,
} from '../facility/facilityStorage';

afterEach(() => {
  vi.restoreAllMocks();
});

function settings(memberName = '看護 花子'): FacilitySettings {
  return {
    version: 1,
    groups: [{ name: '病棟', visit: 'always' }],
    departments: [{ name: '3東', group: '病棟' }],
    themes: [{ name: '手指衛生', items: [{ id: 'i1', text: '項目1', targetGroups: ['病棟'], excludedDepartments: [] }] }],
    members: [{ name: memberName, role: '看護師' }],
  };
}

describe('facilityStorage', () => {
  it('uses the icn-round:facility-settings key', () => {
    expect(FACILITY_SETTINGS_KEY).toBe('icn-round:facility-settings');
  });

  it('returns null when nothing is saved', () => {
    expect(loadFacilitySettings()).toBeNull();
  });

  it('saves the settings as JSON under the key and reads them back', () => {
    expect(saveFacilitySettings(settings())).toBe(true);
    expect(JSON.parse(localStorage.getItem(FACILITY_SETTINGS_KEY) ?? '')).toEqual(settings());
    expect(loadFacilitySettings()).toEqual(settings());
  });

  it('replaces the settings saved before', () => {
    saveFacilitySettings(settings('前の人'));
    saveFacilitySettings(settings('次の人'));
    expect(loadFacilitySettings()?.members[0].name).toBe('次の人');
  });

  it('returns null for a value that is not JSON', () => {
    localStorage.setItem(FACILITY_SETTINGS_KEY, '{broken');
    expect(loadFacilitySettings()).toBeNull();
  });

  it('returns null for JSON that is not settings', () => {
    for (const value of ['null', '[]', '"text"', JSON.stringify({ ...settings(), version: 2 }), JSON.stringify({ ...settings(), groups: 'x' })]) {
      localStorage.setItem(FACILITY_SETTINGS_KEY, value);
      expect(loadFacilitySettings()).toBeNull();
    }
  });

  it('returns null for an empty string', () => {
    localStorage.setItem(FACILITY_SETTINGS_KEY, '');
    expect(loadFacilitySettings()).toBeNull();
  });

  it('returns null when localStorage cannot be read', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(loadFacilitySettings()).toBeNull();
  });

  it('returns false and keeps the earlier value when the write fails', () => {
    saveFacilitySettings(settings('前の人'));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveFacilitySettings(settings('次の人'))).toBe(false);
    vi.restoreAllMocks();
    expect(loadFacilitySettings()?.members[0].name).toBe('前の人');
  });

  it('clears the saved settings and leaves other keys alone', () => {
    saveFacilitySettings(settings());
    localStorage.setItem('icn-round:saved-rounds', '[]');
    clearFacilitySettings();
    expect(localStorage.getItem(FACILITY_SETTINGS_KEY)).toBeNull();
    expect(localStorage.getItem('icn-round:saved-rounds')).toBe('[]');
  });

  it('does not throw when clearing fails', () => {
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(() => clearFacilitySettings()).not.toThrow();
  });
});
