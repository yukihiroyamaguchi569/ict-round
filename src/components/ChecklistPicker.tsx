import ChecklistImportDialog from './ChecklistImportDialog';
import ChecklistEditor from './ChecklistEditor';
import type { SavedChecklist } from '../types';
import type { ChecklistPickerState } from '../useChecklistPicker';

interface Props {
  library: SavedChecklist[];
  activeId: string;
  onSelectChecklist: (id: string) => void;
  picker: ChecklistPickerState;
}

/** "Checklist to use" card: select, copy to edit, delete, and the options to add a new checklist by editor or import. */
export default function ChecklistPicker({ library, activeId, onSelectChecklist, picker }: Props) {
  return (
    <div className="card p-4 mb-4 space-y-2">
      <div className="mb-1">
        <span className="text-xs font-bold text-text-muted">使用するチェックリスト</span>
      </div>

      {library.map((c) => (
        <ChecklistRow
          key={c.id}
          checklist={c}
          active={c.id === activeId}
          deletable={library.length > 1}
          onSelect={() => onSelectChecklist(c.id)}
          onCopy={() => picker.openCopyEditor(c)}
          onDelete={() => picker.handleDelete(c.id)}
        />
      ))}

      <AddChecklistOptions
        expanded={picker.showAddOptions}
        onToggle={picker.toggleAddOptions}
        onCreate={picker.openNewEditor}
        onImport={picker.openImport}
      />
    </div>
  );
}

/**
 * The import dialog and the editor opened from the picker.
 * Render them outside .animate-page: its transform would become the containing block of their position: fixed.
 */
export function ChecklistPickerDialogs({ picker }: { picker: ChecklistPickerState }) {
  return (
    <>
      {picker.showImport && (
        <ChecklistImportDialog
          onSave={picker.handleSaveImport}
          onCancel={picker.closeImport}
        />
      )}

      {picker.editor && (
        <ChecklistEditor
          initialDraft={picker.editor.draft}
          source={picker.editor.source}
          onSave={picker.handleSaveEditor}
          onCancel={picker.closeEditor}
        />
      )}
    </>
  );
}

interface ChecklistRowProps {
  checklist: SavedChecklist;
  active: boolean;
  deletable: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onDelete: () => void;
}

/** One selectable checklist with its counts, copy button, and (when more than one is left) delete button. */
function ChecklistRow({ checklist: c, active, deletable, onSelect, onCopy, onDelete }: ChecklistRowProps) {
  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-t cursor-pointer transition-colors"
      style={
        active
          ? { backgroundColor: 'var(--t-primary-light)', border: '1.5px solid var(--t-primary)' }
          : { backgroundColor: 'var(--t-base)', border: '1.5px solid var(--t-line)' }
      }
      onClick={onSelect}
    >
      <div
        className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
        style={
          active
            ? { borderColor: 'var(--t-primary)', backgroundColor: 'var(--t-primary)' }
            : { borderColor: 'var(--t-line)', backgroundColor: 'transparent' }
        }
      >
        {active && (
          <div className="w-2 h-2 rounded-full bg-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text truncate">{c.name}</p>
        <p className="text-[10px] text-text-faint">
          {c.categories.length}カテゴリ・{c.categories.reduce((s, cat) => s + cat.items.length, 0)}項目
          {c.isDefault && <span className="ml-1 text-primary font-bold">（標準）</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onCopy(); }}
        className="text-text-faint hover:text-primary transition-colors p-1"
        aria-label="複製して編集"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </button>
      {deletable && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-text-faint hover:text-red-500 transition-colors p-1"
          aria-label="削除"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface AddChecklistOptionsProps {
  expanded: boolean;
  onToggle: () => void;
  onCreate: () => void;
  onImport: () => void;
}

/** "Add a new checklist" toggle and its two choices: create on screen or import a file. */
function AddChecklistOptions({ expanded, onToggle, onCreate, onImport }: AddChecklistOptionsProps) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold border-2 rounded-t transition-colors"
        style={{ borderColor: 'var(--t-primary)', color: 'var(--t-primary)' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        新しいチェックリストを追加する
      </button>

      {expanded && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCreate}
            className="py-2.5 text-xs font-bold border-2 border-line rounded-t text-text-muted hover:text-primary hover:border-primary transition-colors"
          >
            画面で作成する
          </button>
          <button
            type="button"
            onClick={onImport}
            className="py-2.5 text-xs font-bold border-2 border-line rounded-t text-text-muted hover:text-primary hover:border-primary transition-colors"
          >
            ファイルから取り込む
          </button>
        </div>
      )}
    </>
  );
}
