import { useState, type RefObject } from 'react';
import { useTheme } from '../ThemeContext';
import { useIcon } from '../IconContext';
import ThemeSelector from './ThemeSelector';
import ChecklistPicker, { ChecklistPickerDialogs } from './ChecklistPicker';
import InstallBanner from './InstallBanner';
import type { SavedChecklist } from '../types';
import { useChecklistPicker } from '../useChecklistPicker';
import { useAppShare } from '../useAppShare';
import { trackEvent } from '../analytics';
import AppShareDialog from './AppShareDialog';

interface Props {
  library: SavedChecklist[];
  activeId: string;
  savedRoundsCount: number;
  initialName: string;
  onStart: (name: string, wardName: string) => void;
  onStartSample: () => Promise<void>;
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
  onStartSample,
  onSelectChecklist,
  onAddChecklist,
  onDeleteChecklist,
  onViewSaved,
}: Props) {
  const { theme } = useTheme();
  const { icon } = useIcon();
  const picker = useChecklistPicker({ onSelectChecklist, onAddChecklist, onDeleteChecklist });
  const share = useAppShare();

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-6">
      {/* While the share dialog is open, keep the screen behind it out of reach of Tab and typing */}
      <div className="fixed top-4 right-4 z-10" inert={share.open}>
        <ThemeSelector />
      </div>

      <div className="animate-page w-full max-w-sm" inert={share.open}>
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

        {/* First-time users get the sample right under the form; after that it moves to the quiet links */}
        {savedRoundsCount === 0 && <SampleTryButton prominent onStartSample={onStartSample} />}

        <InstallBanner />

        <MergeLinkCard />

        <AboutShareLinks onOpenShare={share.openDialog} shareTriggerRef={share.triggerRef} onStartSample={savedRoundsCount > 0 ? onStartSample : undefined} />

        <p className="text-center text-text-faint text-xs mt-8">ICTラウンドアプリ「{icon.label}」 v{__APP_VERSION__} (build {__BUILD_DATE__})</p>
      </div>

      <ChecklistPickerDialogs picker={picker} />
      {/* Outside .animate-page for the same reason as the picker dialogs */}
      {share.open && <AppShareDialog share={share} />}
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

/**
 * Starts the sample round, already filled in, so the report can be tried out without input.
 * Disabled while the sample photos load.
 */
function SampleTryButton({ prominent = false, onStartSample }: { prominent?: boolean; onStartSample: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const label = pending ? '準備中…' : 'サンプルで試す';

  const handleClick = () => {
    setPending(true);
    void onStartSample().finally(() => setPending(false));
  };

  if (!prominent) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="underline underline-offset-2 hover:text-text transition-colors"
      >
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="card w-full p-4 mt-4 flex items-center gap-3 text-left border-2 border-dashed border-primary hover:bg-base-deep transition-colors disabled:opacity-60"
    >
      <span
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: 'var(--t-primary-light)' }}
        aria-hidden="true"
      >
        <svg className="w-5 h-5" fill="none" stroke="var(--t-primary)" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-primary">{label}</span>
        <span className="block text-xs text-text-muted mt-0.5 leading-relaxed">
          入力済みの例で報告書の出力まで試せます（保存されません）
        </span>
      </span>
    </button>
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

/**
 * Quiet links under the merge card: the user guide, the About page, and introducing the app to a colleague,
 * led by the sample when onStartSample is given (once rounds have been saved).
 */
function AboutShareLinks({
  onOpenShare,
  shareTriggerRef,
  onStartSample,
}: {
  onOpenShare: () => void;
  shareTriggerRef: RefObject<HTMLButtonElement | null>;
  onStartSample?: () => Promise<void>;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-text-muted">
      {onStartSample && <SampleTryButton onStartSample={onStartSample} />}
      {/* New tab, like the other links, so an installed app never navigates away from itself */}
      <a
        href="./docs/user-guide/"
        target="_blank"
        rel="noopener"
        onClick={() => trackEvent('help_open', { from: 'start' })}
        className="underline underline-offset-2 hover:text-text transition-colors"
      >
        使い方
      </a>
      <a
        href="./about/"
        target="_blank"
        rel="noopener"
        onClick={() => trackEvent('about_link_click')}
        className="underline underline-offset-2 hover:text-text transition-colors"
      >
        めぐる君について
      </a>
      <button
        ref={shareTriggerRef}
        type="button"
        onClick={onOpenShare}
        aria-haspopup="dialog"
        className="flex items-center gap-1 underline underline-offset-2 hover:text-text transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
        </svg>
        同僚に紹介する
      </button>
    </div>
  );
}
