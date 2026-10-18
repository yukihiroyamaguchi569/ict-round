import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { SavedChecklist } from './types';
import {
  addImportedCategories,
  buildChecklist,
  emptyCategory,
  joinWithPreviousItem,
  mergeCategoryIntoPrevious,
  moveItem,
  newKey,
  splitCategoryAtItem,
  type DraftCategory,
  type EditorDraft,
} from './checklistEditor';
import { trackEvent } from './analytics';

/** Input to focus after adding a category or a fix that removes the focused row or card; a new object per request, so repeating it focuses again. */
export interface FocusRequest {
  key: string;
}

/**
 * The fixes that remove the row or card holding the pressed button (join items, item to category,
 * merge categories), each moving focus to the input that remains so keyboard users are not lost.
 */
function useStructureFixes(
  categories: DraftCategory[],
  setDraft: Dispatch<SetStateAction<EditorDraft>>,
  setFocusRequest: (request: FocusRequest) => void,
) {
  /** Applies a pure restructuring to the latest categories, then focuses the input with focusKey, if any. */
  const restructure = (change: (c: DraftCategory[]) => DraftCategory[], focusKey: string | undefined) => {
    setDraft((d) => ({ ...d, categories: change(d.categories) }));
    if (focusKey !== undefined) setFocusRequest({ key: focusKey });
  };

  /** Joins the item into the previous one and focuses that item's input. */
  const joinItemWithPrevious = (categoryIndex: number, itemIndex: number) => {
    const items = categories[categoryIndex]?.items ?? [];
    restructure(
      (c) => joinWithPreviousItem(c, categoryIndex, itemIndex),
      itemIndex > 0 && itemIndex < items.length ? items[itemIndex - 1].key : undefined,
    );
  };

  /** Turns the item into a new category and focuses its name input. */
  const splitCategoryAt = (categoryIndex: number, itemIndex: number) => {
    const createdKey = newKey();
    restructure(
      (c) => splitCategoryAtItem(c, categoryIndex, itemIndex, createdKey),
      categories[categoryIndex]?.items[itemIndex] ? createdKey : undefined,
    );
  };

  /** Merges the category into the previous one and focuses that category's name input. */
  const mergeCategoryWithPrevious = (categoryIndex: number) =>
    restructure(
      (c) => mergeCategoryIntoPrevious(c, categoryIndex),
      categoryIndex > 0 && categoryIndex < categories.length ? categories[categoryIndex - 1].key : undefined,
    );

  return { joinItemWithPrevious, splitCategoryAt, mergeCategoryWithPrevious };
}

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
  // Set only when adding a category and by the structure fixes, so other edits never move focus
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  useEffect(() => {
    trackEvent('checklist_editor_open', { source });
  }, [source]);

  const setCategories = (categories: DraftCategory[]) => setDraft((d) => ({ ...d, categories }));
  const { categories } = draft;
  const fixes = useStructureFixes(categories, setDraft, setFocusRequest);

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
    setFocusRequest({ key: category.key });
    setCategories([...categories, category]);
  };

  const importCategories = (imported: DraftCategory[]) => setDraft((d) => addImportedCategories(d, imported));

  /** hasPendingText: text pasted into the import panel but not imported yet, which closing would also lose. */
  const handleCancel = (hasPendingText: boolean) => {
    const dirty = hasPendingText || JSON.stringify(draft) !== initialJson.current;
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
    focusRequest,
    ...fixes,
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
