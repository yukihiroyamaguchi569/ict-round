import { useState } from 'react';
import type { FacilitySettings, SettingsError } from './facilitySettings';
import { loadFacilitySettings, saveFacilitySettings } from './facilityStorage';
import { readSettingsFile } from './readSettingsFile';
import { newLocalId } from '../localId';

/**
 * Facility settings page state. The settings shown are always the ones saved on this device:
 * a file replaces them only when it reads without errors and the save succeeds.
 */
export function useFacilitySettings() {
  const [settings, setSettings] = useState<FacilitySettings | null>(loadFacilitySettings);
  const [errors, setErrors] = useState<SettingsError[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadFile = async (file: File) => {
    setLoading(true);
    setErrors([]);
    setSaveFailed(false);
    // readSettingsFile never throws; an unreadable file comes back as an error.
    const result = await readSettingsFile(file, newLocalId);
    setLoading(false);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    if (!saveFacilitySettings(result.settings)) {
      setSaveFailed(true);
      return;
    }
    setSettings(result.settings);
  };

  return { settings, errors, saveFailed, loading, loadFile };
}
