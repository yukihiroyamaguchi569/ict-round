import { useEffect, useRef, useState } from 'react';
import type { SavedChecklist } from './types';
import {
  addImportedCategories,
  buildChecklist,
  emptyCategory,
  moveItem,
  type DraftCategory,
  type EditorDraft,
} from './checklistEditor';
import { trackEvent } from './analytics';

/** Draft of the checklist being edited: category edits, cancel with a discard check, and save with validation. */
export function useChecklistEditor(
  initialDraft: EditorDraft,
  source: 'new' | 'copy',
  onSave: (checklist: SavedChecklist) => void,
  onCancel: () => void,
) {
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState('');
  const initialJson = useRef(JSON.stringify(initialDraft));
  const [addedCategoryKey, setAddedCategoryKey] = useState<string | null>(null);

  useEffect(() => {
    trackEvent('checklist_editor_open', { source });
  }, [source]);

  const setCategories = (categories: DraftCategory[]) => setDraft((d) => ({ ...d, categories }));
  const { categories } = draft;

  const setName = (name: string) => setDraft((d) => ({ ...d, name }));

  const changeCategory = (index: number, next: DraftCategory) =>
    setCategories(categories.map((c, j) => (j === index ? next : c)));

  const moveCategory = (index: number, delta: number) => setCategories(moveItem(categories, index, delta));

  const handleDeleteCategory = (index: number) => {
    const hasText = categories[index].items.some((item) => item.description.trim() !== '');
    if (hasText && !confirm('このカテゴリと中の項目を削除しますか？')) return;
    setCategories(categories.filter((_, i) => i !== index));
  };

  const handleAddCategory = () => {
    const category = emptyCategory();
    setAddedCategoryKey(category.key);
    setCategories([...categories, category]);
  };

  const importCategories = (imported: DraftCategory[]) => setDraft((d) => addImportedCategories(d, imported));

  const handleCancel = () => {
    const dirty = JSON.stringify(draft) !== initialJson.current;
    if (dirty && !confirm('編集内容を破棄して閉じますか？')) return;
    onCancel();
  };

  const handleSave = () => {
    const result = buildChecklist(draft);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    trackEvent('checklist_editor_save');
    onSave(result.checklist);
  };

  return {
    draft,
    error,
    addedCategoryKey,
    setName,
    changeCategory,
    moveCategory,
    handleDeleteCategory,
    handleAddCategory,
    importCategories,
    handleCancel,
    handleSave,
  };
}
