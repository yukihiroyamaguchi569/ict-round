import { useState } from 'react';
import { useTheme } from '../ThemeContext';
import { useIcon } from '../IconContext';
import ThemeSelector from './ThemeSelector';
import ChecklistPicker, { ChecklistPickerDialogs } from './ChecklistPicker';
import InstallBanner from './InstallBanner';
import type { SavedChecklist } from '../types';
import { useChecklistPicker } from '../useChecklistPicker';

interface Props {
  library: SavedChecklist[];
  activeId: string;
  savedRoundsCount: number;
  initialName: string;
  onStart: (name: string, wardName: string) => void;
  onSelectChecklist: (id: string) => void;
  onAddChecklist: (c: SavedChecklist) => void;
  onDeleteChecklist: (id: string) => void;
  onViewSaved: () => void;
}

export default function RoundStart({
  library,
  activeId,
  savedRoundsCount,
  initialName,
  onStart,
  onSelectChecklist,
  onAddChecklist,
  onDeleteChecklist,
  onViewSaved,
}: Props) {
  const { theme } = useTheme();
  const { icon } = useIcon();
  const picker = useChecklistPicker({ onSelectChecklist, onAddChecklist, onDeleteChecklist });

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-6">
      <div className="fixed top-4 right-4 z-10">
        <ThemeSelector />
      </div>

      <div className="animate-page w-full max-w-sm">
        {/* Icon */}
        <div className="flex items-center justify-center mb-8">
          <img src={`${import.meta.env.BASE_URL}${icon.file}`} alt={icon.alt} className="w-40 h-40 object-contain drop-shadow-md" />
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-text">{theme.startTitle}</h1>
          <p className="text-text-muted text-sm mt-2 leading-relaxed whitespace-pre-line">{theme.startSubtitle}</p>
        </div>

        {/* Checklist selector */}
        <ChecklistPicker
          library={library}
          activeId={activeId}
          onSelectChecklist={onSelectChecklist}
          picker={picker}
        />

        {/* Form */}
        <StartForm
          initialName={initialName}
          savedRoundsCount={savedRoundsCount}
          onStart={onStart}
          onViewSaved={onViewSaved}
        />

        <InstallBanner />

        <MergeLinkCard />

        <p className="text-center text-text-faint text-xs mt-8">ICTラウンドアプリ「{icon.label}」 v{__APP_VERSION__} (build {__BUILD_DATE__})</p>
      </div>

      <ChecklistPickerDialogs picker={picker} />
    </div>
  );
}

interface StartFormProps {
  initialName: string;
  savedRoundsCount: number;
  onStart: (name: string, wardName: string) => void;
  onViewSaved: () => void;
}

/** Participant and ward name inputs, the start button, and the button to open saved rounds. */
function StartForm({ initialName, savedRoundsCount, onStart, onViewSaved }: StartFormProps) {
  // Carry over the participant name so consecutive ward rounds do not require retyping it
  const [name, setName] = useState(initialName);
  const [wardName, setWardName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onStart(name.trim(), wardName.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <div>
        <label className="block text-sm font-bold text-text-muted mb-2">参加者</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: 山田 花子"
          className="w-full bg-base border-2 border-line rounded-t px-4 py-3.5 text-base text-text placeholder:text-text-faint transition-all duration-200"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-bold text-text-muted mb-2">
          病棟名
          <span className="text-text-faint font-normal ml-1">（任意）</span>
        </label>
        <input
          type="text"
          value={wardName}
          onChange={(e) => setWardName(e.target.value)}
          placeholder="例: 3階東病棟"
          className="w-full bg-base border-2 border-line rounded-t px-4 py-3.5 text-base text-text placeholder:text-text-faint transition-all duration-200"
        />
      </div>

      <button
        type="submit"
        disabled={!name.trim()}
        className="btn-primary w-full py-4 text-base font-bold"
      >
        ラウンド開始
      </button>

      <button
        type="button"
        onClick={onViewSaved}
        className="w-full py-3 text-sm font-bold border-2 border-line rounded-t text-text-muted hover:text-text hover:border-primary transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
        保存済みラウンドを開く
        {savedRoundsCount > 0 && (
          <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--t-primary-light)', color: 'var(--t-primary)' }}>
            {savedRoundsCount}
          </span>
        )}
      </button>
    </form>
  );
}

/** Card linking to the merge page that combines reports from several departments. */
// 統合ページは PC で開く別ページ（相対パスなので GitHub Pages / Cloudflare Pages のどちらでも通る）
function MergeLinkCard() {
  return (
    <div className="card p-4 mt-4 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--t-primary-light)' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="var(--t-primary)" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h5l3 3h8a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v5m0-5l-2 2m2-2l2 2" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-text">複数部署のレポートを統合</p>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
          集めたデータをPCで1本のWord報告書にまとめます
        </p>
      </div>
      <a
        href="./merge.html"
        target="_blank"
        rel="noopener"
        className="text-xs font-bold px-3 py-2 rounded-t flex-shrink-0 transition-colors"
        style={{ backgroundColor: 'var(--t-primary)', color: '#fff' }}
      >
        開く
      </a>
    </div>
  );
}
