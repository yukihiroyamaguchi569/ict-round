import { useEffect } from 'react';
import type { Release } from '../whatsNew';

interface Props {
  releases: Release[];
  onClose: () => void;
}

export default function WhatsNewDialog({ releases, onClose }: Props) {
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4"
      >
        <h2 id="whats-new-title" className="text-base font-bold text-text">新機能のお知らせ</h2>
        <div tabIndex={0} className="max-h-[70vh] overflow-y-auto space-y-4">
          {releases.map((release, i) => (
            <section key={`${release.version}-${i}`}>
              <h3 className="text-sm font-bold text-text">
                v{release.version}（{release.date}）
              </h3>
              <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-text-muted leading-relaxed">
                {release.changes.map((change, i) => (
                  <li key={i}>{change}</li>
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
