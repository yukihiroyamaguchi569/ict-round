import { useState } from 'react';
import type { SavedChecklist } from './types';
import { draftFromChecklist, emptyDraft, type EditorDraft } from './checklistEditor';

interface Handlers {
  onSelectChecklist: (id: string) => void;
  onAddChecklist: (c: SavedChecklist) => void;
  onDeleteChecklist: (id: string) => void;
}

/** Which add option / dialog is open on the checklist picker, and adding, selecting or deleting a checklist from it. */
export function useChecklistPicker({ onSelectChecklist, onAddChecklist, onDeleteChecklist }: Handlers) {
  const [showImport, setShowImport] = useState(false);
  const [showAddOptions, setShowAddOptions] = useState(false);
  const [editor, setEditor] = useState<{ draft: EditorDraft; source: 'new' | 'copy' } | null>(null);

  const handleSaveImport = (c: SavedChecklist) => {
    onAddChecklist(c);
    onSelectChecklist(c.id);
    setShowImport(false);
  };

  const handleSaveEditor = (c: SavedChecklist) => {
    onAddChecklist(c);
    onSelectChecklist(c.id);
    setEditor(null);
  };

  const toggleAddOptions = () => setShowAddOptions((v) => !v);

  const openImport = () => {
    setShowAddOptions(false);
    setShowImport(true);
  };

  const openNewEditor = () => {
    setShowAddOptions(false);
    setEditor({ draft: emptyDraft(), source: 'new' });
  };

  const openCopyEditor = (c: SavedChecklist) => {
    setEditor({ draft: draftFromChecklist(c, `${c.name}のコピー`), source: 'copy' });
  };

  const handleDelete = (id: string) => {
    if (!confirm('このチェックリストを削除しますか？')) return;
    onDeleteChecklist(id);
  };

  return {
    showImport,
    showAddOptions,
    editor,
    handleSaveImport,
    handleSaveEditor,
    closeImport: () => setShowImport(false),
    closeEditor: () => setEditor(null),
    toggleAddOptions,
    openImport,
    openNewEditor,
    openCopyEditor,
    handleDelete,
  };
}

export type ChecklistPickerState = ReturnType<typeof useChecklistPicker>;
