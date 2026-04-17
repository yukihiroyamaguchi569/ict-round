import type { SavedRound } from '../types';

interface Props {
  savedRounds: SavedRound[];
  onLoad: (round: SavedRound) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export default function SavedRoundsList({ savedRounds, onLoad, onDelete, onBack }: Props) {
  const handleDelete = (id: string) => {
    if (!confirm('この保存済みラウンドを削除しますか？')) return;
    onDelete(id);
  };

  const sorted = [...savedRounds].reverse();

  return (
    <div className="min-h-screen bg-base">
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-text-muted hover:text-text transition-colors p-1 -ml-1"
          aria-label="戻る"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-bold text-text">保存済みラウンド</h1>
        <span className="ml-auto text-xs text-text-muted">{savedRounds.length}件</span>
      </div>

      <div className="p-4 space-y-3">
        {sorted.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-16">
            保存済みラウンドはありません
          </div>
        ) : (
          sorted.map((round) => (
            <div key={round.id} className="card p-4">
              <div className="mb-3">
                <p className="text-sm font-bold text-text">{round.title}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  保存日時: {new Date(round.savedAt).toLocaleString('ja-JP')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onLoad(round)}
                  className="btn-primary flex-1 py-2.5 text-sm font-bold"
                >
                  開く
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(round.id)}
                  className="px-4 py-2.5 text-sm font-bold border-2 border-line rounded-t text-text-muted hover:text-red-500 hover:border-red-300 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
