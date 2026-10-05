import { useState, useEffect } from 'react';
import type { SavedChecklist, ChecklistCategory } from './types';
import { buildImportedChecklist, checklistFileType, readChecklistFile, type ChecklistFileType } from './checklistImport';
import { newLocalId } from './localId';
import { trackEvent } from './analytics';

/** Reading a chosen CSV / .xlsx file into a preview, and saving it as a new checklist. */
export function useChecklistImport(onSave: (checklist: SavedChecklist) => void) {
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<ChecklistCategory[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<ChecklistFileType>('csv');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    trackEvent('checklist_import_open');
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setPreview(null);
    setLoading(true);
    setFileName(file.name);
    const type = checklistFileType(file.name);
    setFileType(type);

    try {
      setPreview(await readChecklistFile(file, type));
    } catch (err) {
      trackEvent('checklist_import_error', { file_type: type });
      setError(err instanceof Error ? err.message : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!preview) return;
    onSave(buildImportedChecklist({ typedName: name, fileName, categories: preview }, newLocalId(), new Date().toISOString()));
    trackEvent('checklist_import_success', { file_type: fileType });
  };

  return { name, setName, preview, fileName, error, loading, handleFile, handleSave };
}
