import { useEffect, useRef } from 'react';
import type { Release } from '../whatsNew';

interface Props {
  releases: Release[];
  onClose: () => void;
}

export default function WhatsNewDialog({ releases, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Move focus into the dialog, then give it back to where it was when the dialog closes.
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-text/40 backdrop-blur-sm">
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4 flex flex-col max-h-[90dvh] focus:outline-none"
      >
        <h2 id="whats-new-title" className="text-base font-bold text-text">新機能のお知らせ</h2>
        <div tabIndex={0} className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {releases.map((release, i) => (
            <section key={`${release.version}-${i}`}>
              <h3 className="text-sm font-bold text-text">
                v{release.version}（{release.date}）
              </h3>
              <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-text-muted leading-relaxed">
                {release.changes.map((change, j) => (
                  <li key={j}>{change}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="space-y-2">
          <a
            href={`${import.meta.env.BASE_URL}updates/`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm font-bold text-primary underline"
          >
            更新履歴をすべて見る
          </a>
          <button
            type="button"
            onClick={onClose}
            className="btn-primary w-full py-2.5 text-sm font-bold"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
