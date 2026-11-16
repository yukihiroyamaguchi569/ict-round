import type { FacilitySettings } from './facilitySettings';
import { parseStoredSettings } from './storedFacilitySettings';

export const FACILITY_SETTINGS_KEY = 'icn-round:facility-settings';

/**
 * The settings saved on this device, or null when none are saved, the saved value is broken,
 * or localStorage cannot be used (blocked by the browser, private mode).
 */
export function loadFacilitySettings(): FacilitySettings | null {
  try {
    const raw = localStorage.getItem(FACILITY_SETTINGS_KEY);
    // Stryker disable next-line ConditionalExpression: JSON.parse(null) reads "null", which parseStoredSettings also rejects
    if (raw === null) return null;
    return parseStoredSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Saves the settings on this device, replacing any saved before.
 * Returns false when the write fails (storage full or blocked); the earlier value is then left as it was.
 */
export function saveFacilitySettings(settings: FacilitySettings): boolean {
  try {
    localStorage.setItem(FACILITY_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** Removes the saved settings. Does nothing when localStorage cannot be used. */
export function clearFacilitySettings(): void {
  try {
    localStorage.removeItem(FACILITY_SETTINGS_KEY);
  } catch {
    // Nothing to remove when storage is unavailable.
  }
}
