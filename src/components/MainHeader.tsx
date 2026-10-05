import { useMemo, useState } from 'react';
import { useIcon } from '../IconContext';
import type { ChecklistCategory, ChecklistItemResult, RoundData } from '../types';
import { getTotalItems } from '../checklistData';
import ThemeSelector from './ThemeSelector';

interface Props {
  roundData: RoundData;
  categories: ChecklistCategory[];
  onInspectorChange: (name: string) => void;
  onSave: () => boolean;
  onHome: () => void;
}

export default function MainHeader({ roundData, categories, onInspectorChange, onSave, onHome }: Props) {
  const { icon } = useIcon();

  return (
    <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-4 py-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onHome} aria-label="トップ画面に戻る" className="flex-shrink-0">
          <img src={`${import.meta.env.BASE_URL}${icon.file}`} alt={icon.alt} className="w-9 h-9 object-contain" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-text leading-tight">感染対策ラウンド</h1>
          <InspectorName
            inspectorName={roundData.inspectorName}
            wardName={roundData.wardName}
            onChange={onInspectorChange}
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ProgressBadge checklistResults={roundData.checklistResults} categories={categories} />
          <SaveButton onSave={onSave} />
          <ThemeSelector />
        </div>
      </div>
    </div>
  );
}

/** Participant name with the ward; tap to edit the name in place. */
function InspectorName({
  inspectorName,
  wardName,
  onChange,
}: {
  inspectorName: string;
  wardName: string;
  onChange: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => {
    setDraft(inspectorName);
    setEditing(true);
  };

  const commit = () => {
    onChange(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder="参加者名"
        className="w-full bg-base border-2 border-primary rounded px-2 py-0.5 text-xs text-text"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="flex items-center gap-1 text-xs text-text-muted truncate max-w-full"
    >
      <span className="truncate">
        参加者: {inspectorName || '（未入力）'}
        {wardName ? `・${wardName}` : ''}
      </span>
      <svg className="w-3 h-3 flex-shrink-0 text-text-faint" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  );
}

/** Rated / total items; green once every item is rated. */
function ProgressBadge({
  checklistResults,
  categories,
}: {
  checklistResults: ChecklistItemResult[];
  categories: ChecklistCategory[];
}) {
  const totalItems = useMemo(() => getTotalItems(categories), [categories]);
  const ratedCount = checklistResults.filter((r) => r.rating !== null).length;

  return (
    <span
      data-testid="overall-progress"
      className="text-xs font-bold px-2.5 py-1 rounded-full"
      style={
        ratedCount === totalItems
          ? { backgroundColor: '#059669', color: '#fff' }
          : { backgroundColor: 'var(--t-primary-light)', color: 'var(--t-primary)' }
      }
    >
      {ratedCount}/{totalItems}
    </span>
  );
}

/** Save button that shows "保存済み" for 2 seconds after a successful save. */
function SaveButton({ onSave }: { onSave: () => boolean }) {
  const [savedFeedback, setSavedFeedback] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        const ok = onSave();
        if (!ok) return;
        setSavedFeedback(true);
        setTimeout(() => setSavedFeedback(false), 2000);
      }}
      className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-colors"
      style={
        savedFeedback
          ? { backgroundColor: '#059669', color: '#fff' }
          : { backgroundColor: 'var(--t-primary-light)', color: 'var(--t-primary)' }
      }
      aria-label="保存"
    >
      {savedFeedback ? (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
      )}
      <span>{savedFeedback ? '保存済み' : '保存'}</span>
    </button>
  );
}
