import { useState } from 'react';
import type { SavedChecklist } from '../types';
import { emptyItem, moveItem, type DraftCategory, type EditorDraft } from '../checklistEditor';
import { useChecklistEditor } from '../useChecklistEditor';
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

interface CategoryCardProps {
  category: DraftCategory;
  index: number;
  count: number;
  focusName: boolean;
  onChange: (next: DraftCategory) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}

function CategoryCard({ category, index, count, focusName, onChange, onMove, onDelete }: CategoryCardProps) {
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
        <IconButton label={`${label}を削除`} path={CROSS} onClick={onDelete} />
      </div>

      <ul className="space-y-1.5 pl-2 border-l-2 border-line">
        {items.map((item, i) => {
          const itemLabel = `${label}の項目${i + 1}`;
          return (
            <li key={item.key} className="flex items-center gap-1">
              <input
                type="text"
                value={item.description}
                onChange={(e) => setItems(items.map((it, j) => (j === i ? { ...it, description: e.target.value } : it)))}
                placeholder="点検項目"
                aria-label={itemLabel}
                autoFocus={item.key === addedItemKey}
                className="flex-1 min-w-0 bg-base border-2 border-line rounded-t px-3 py-2 text-sm text-text placeholder:text-text-faint"
              />
              <IconButton label={`${itemLabel}を上へ移動`} path={ARROW_UP} onClick={() => setItems(moveItem(items, i, -1))} disabled={i === 0} />
              <IconButton label={`${itemLabel}を下へ移動`} path={ARROW_DOWN} onClick={() => setItems(moveItem(items, i, 1))} disabled={i === items.length - 1} />
              <IconButton label={`${itemLabel}を削除`} path={CROSS} onClick={() => setItems(items.filter((_, j) => j !== i))} />
            </li>
          );
        })}
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

  return (
    <div className="fixed inset-0 z-50 bg-base flex flex-col">
      <EditorHeader source={source} onClose={editor.handleCancel} />

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

          <ChecklistTextImport onImport={editor.importCategories} />

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

      <EditorFooter error={editor.error} onCancel={editor.handleCancel} onSave={editor.handleSave} />
    </div>
  );
}
