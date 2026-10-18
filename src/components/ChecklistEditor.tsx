import { useState } from 'react';
import type { SavedChecklist } from '../types';
import {
  emptyItem,
  joinWithPreviousItem,
  mergeCategoryIntoPrevious,
  moveItem,
  splitCategoryAtItem,
  type DraftCategory,
  type DraftItem,
  type EditorDraft,
} from '../checklistEditor';
import { useChecklistEditor } from '../useChecklistEditor';
import { useChecklistTextImport } from '../useChecklistTextImport';
import ChecklistTextImport from './ChecklistTextImport';

interface Props {
  initialDraft: EditorDraft;
  source: 'new' | 'copy';
  onSave: (checklist: SavedChecklist) => void;
  onCancel: () => void;
}

const ARROW_UP = 'M5 15l7-7 7 7';
const ARROW_DOWN = 'M19 9l-7 7-7-7';
const CROSS = 'M6 18L18 6M6 6l12 12';
const PLUS = 'M12 4v16m8-8H4';
// Arrow rising into a bar: append to the item above
const JOIN_UP = 'M5 4h14M12 20V8m-5 5l5-5 5 5';
// Heading line over indented lines: this item becomes a category heading
const TO_HEADING = 'M4 6h16M8 12h12M8 18h12';
// Two branches merging upward: fold into the category above
const MERGE_UP = 'M12 4v8m0 0a4 4 0 00-4 4v4m4-8a4 4 0 014 4v4';

function Icon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

interface IconButtonProps {
  label: string;
  path: string;
  onClick: () => void;
  disabled?: boolean;
}

function IconButton({ label, path, onClick, disabled }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded text-text-muted hover:text-primary disabled:opacity-30 disabled:hover:text-text-muted transition-colors flex-shrink-0"
    >
      <Icon d={path} />
    </button>
  );
}

interface ItemRowProps {
  item: DraftItem;
  label: string;
  isFirst: boolean;
  isLast: boolean;
  focus: boolean;
  actions: {
    change: (description: string) => void;
    move: (delta: number) => void;
    joinWithPrevious: () => void;
    toCategory: () => void;
    remove: () => void;
  };
}

function ItemRow({ item, label, isFirst, isLast, focus, actions }: ItemRowProps) {
  return (
    <li className="flex items-center gap-1">
      <input
        type="text"
        value={item.description}
        onChange={(e) => actions.change(e.target.value)}
        placeholder="点検項目"
        aria-label={label}
        autoFocus={focus}
        className="flex-1 min-w-0 bg-base border-2 border-line rounded-t px-3 py-2 text-sm text-text placeholder:text-text-faint"
      />
      <IconButton label={`${label}を上へ移動`} path={ARROW_UP} onClick={() => actions.move(-1)} disabled={isFirst} />
      <IconButton label={`${label}を下へ移動`} path={ARROW_DOWN} onClick={() => actions.move(1)} disabled={isLast} />
      <IconButton label={`${label}を前の項目とつなぐ`} path={JOIN_UP} onClick={actions.joinWithPrevious} disabled={isFirst} />
      <IconButton label={`${label}からカテゴリにする`} path={TO_HEADING} onClick={actions.toCategory} />
      <IconButton label={`${label}を削除`} path={CROSS} onClick={actions.remove} />
    </li>
  );
}

interface CategoryCardProps {
  category: DraftCategory;
  index: number;
  count: number;
  focusName: boolean;
  onChange: (next: DraftCategory) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
  onMergeWithPrevious: () => void;
  /** Fixes that also change other categories, so the editor applies them to the whole draft. */
  itemFixes: { joinWithPrevious: (itemIndex: number) => void; toCategory: (itemIndex: number) => void };
}

function CategoryCard({ category, index, count, focusName, onChange, onMove, onDelete, onMergeWithPrevious, itemFixes }: CategoryCardProps) {
  const label = `カテゴリ${index + 1}`;
  const items = category.items;
  const setItems = (next: typeof items) => onChange({ ...category, items: next });
  // Key of the item added last; autoFocus only fires on mount, so other edits never move focus.
  const [addedItemKey, setAddedItemKey] = useState<string | null>(null);

  const addItem = () => {
    const item = emptyItem();
    setAddedItemKey(item.key);
    setItems([...items, item]);
  };

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-1">
        <input
          type="text"
          value={category.name}
          onChange={(e) => onChange({ ...category, name: e.target.value })}
          placeholder="カテゴリ名（例: 手指衛生）"
          aria-label={`${label}の名前`}
          autoFocus={focusName}
          className="flex-1 min-w-0 bg-base border-2 border-line rounded-t px-3 py-2 text-sm font-bold text-text placeholder:text-text-faint placeholder:font-normal"
        />
        <IconButton label={`${label}を上へ移動`} path={ARROW_UP} onClick={() => onMove(-1)} disabled={index === 0} />
        <IconButton label={`${label}を下へ移動`} path={ARROW_DOWN} onClick={() => onMove(1)} disabled={index === count - 1} />
        <IconButton label={`${label}を前のカテゴリとまとめる`} path={MERGE_UP} onClick={onMergeWithPrevious} disabled={index === 0} />
        <IconButton label={`${label}を削除`} path={CROSS} onClick={onDelete} />
      </div>

      <ul className="space-y-1.5 pl-2 border-l-2 border-line">
        {items.map((item, i) => (
          <ItemRow
            key={item.key}
            item={item}
            label={`${label}の項目${i + 1}`}
            isFirst={i === 0}
            isLast={i === items.length - 1}
            focus={item.key === addedItemKey}
            actions={{
              change: (description) => setItems(items.map((it, j) => (j === i ? { ...it, description } : it))),
              move: (delta) => setItems(moveItem(items, i, delta)),
              joinWithPrevious: () => itemFixes.joinWithPrevious(i),
              toCategory: () => itemFixes.toCategory(i),
              remove: () => setItems(items.filter((_, j) => j !== i)),
            }}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={addItem}
        aria-label={`${label}に項目を追加`}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs font-bold text-primary border-2 border-dashed border-line rounded-t hover:border-primary transition-colors"
      >
        <Icon d={PLUS} />
        項目を追加
      </button>
    </div>
  );
}

interface EditorFooterProps {
  error: string;
  onCancel: () => void;
  onSave: () => void;
}

function EditorFooter({ error, onCancel, onSave }: EditorFooterProps) {
  return (
    <div className="border-t border-line bg-surface flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-md mx-auto px-4 pt-3 pb-4 space-y-2">
        {error && (
          <p role="alert" className="text-xs text-red-600 font-bold bg-red-50 px-3 py-2 rounded">{error}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 text-sm font-bold text-text-muted border-2 border-line rounded-t hover:bg-base transition-colors"
          >
            キャンセル
          </button>
          <button type="button" onClick={onSave} className="flex-1 btn-primary py-3 text-sm font-bold">
            保存して適用
          </button>
        </div>
      </div>
    </div>
  );
}

interface EditorHeaderProps {
  source: 'new' | 'copy';
  onClose: () => void;
}

function EditorHeader({ source, onClose }: EditorHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-line bg-surface flex-shrink-0">
      <h2 className="text-sm font-extrabold text-text">
        {source === 'copy' ? 'チェックリストを複製して編集' : 'チェックリストを作成'}
      </h2>
      <button type="button" onClick={onClose} aria-label="閉じる" className="text-text-muted hover:text-text">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d={CROSS} />
        </svg>
      </button>
    </div>
  );
}

export default function ChecklistEditor({ initialDraft, source, onSave, onCancel }: Props) {
  const editor = useChecklistEditor(initialDraft, source, onSave, onCancel);
  const { draft, addedCategoryKey } = editor;
  const { categories } = draft;
  const textImport = useChecklistTextImport(editor.importCategories);
  const cancel = () => editor.handleCancel(textImport.text.trim() !== '');

  return (
    <div className="fixed inset-0 z-50 bg-base flex flex-col">
      <EditorHeader source={source} onClose={cancel} />

      <div className="overflow-y-auto flex-1">
        <div className="w-full max-w-md mx-auto px-4 py-4 space-y-3">
          <div>
            <label htmlFor="checklist-editor-name" className="block text-xs font-bold text-text-muted mb-1.5">
              チェックリストの名前
            </label>
            <input
              id="checklist-editor-name"
              type="text"
              value={draft.name}
              onChange={(e) => editor.setName(e.target.value)}
              placeholder="例: 医療安全ラウンド"
              className="w-full bg-surface border-2 border-line rounded-t px-3 py-2.5 text-sm text-text placeholder:text-text-faint"
            />
          </div>

          <ChecklistTextImport panel={textImport} />

          <p className="text-[11px] text-text-faint leading-relaxed">
            空欄の項目と、項目のないカテゴリは保存時に省かれます。
          </p>

          {categories.map((cat, i) => (
            <CategoryCard
              key={cat.key}
              category={cat}
              index={i}
              count={categories.length}
              focusName={cat.key === addedCategoryKey}
              onChange={(next) => editor.changeCategory(i, next)}
              onMove={(delta) => editor.moveCategory(i, delta)}
              onDelete={() => editor.handleDeleteCategory(i)}
              onMergeWithPrevious={() => editor.updateCategories((c) => mergeCategoryIntoPrevious(c, i))}
              itemFixes={{
                joinWithPrevious: (itemIndex) => editor.updateCategories((c) => joinWithPreviousItem(c, i, itemIndex)),
                toCategory: (itemIndex) => editor.updateCategories((c) => splitCategoryAtItem(c, i, itemIndex)),
              }}
            />
          ))}

          <button
            type="button"
            onClick={editor.handleAddCategory}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-bold border-2 rounded-t transition-colors"
            style={{ borderColor: 'var(--t-primary)', color: 'var(--t-primary)' }}
          >
            <Icon d={PLUS} />
            カテゴリを追加
          </button>
        </div>
      </div>

      <EditorFooter error={editor.error} onCancel={cancel} onSave={editor.handleSave} />
    </div>
  );
}
