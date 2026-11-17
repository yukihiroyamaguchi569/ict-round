interface Props {
  subtitle: string;
  /** Shows a back button labelled `backLabel` before the title. */
  onBack?: () => void;
  backLabel?: string;
  /** Keeps the back button from being used, e.g. while a save is in flight. */
  backDisabled?: boolean;
}

/** Sticky header of the facility page's screens: the page title, a subtitle and an optional back button. */
export default function ScreenHeader({ subtitle, onBack, backLabel = 'ホームへ戻る', backDisabled = false }: Props) {
  const title = (
    <div>
      <h1 className="text-base font-extrabold text-text">施設ラウンド</h1>
      <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
    </div>
  );
  return (
    <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-5 py-3.5">
      {onBack ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={backDisabled}
            aria-label={backLabel}
            className="text-text-muted hover:text-text transition-colors p-2 -ml-2 rounded-lg disabled:opacity-30"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {title}
        </div>
      ) : (
        title
      )}
    </div>
  );
}
