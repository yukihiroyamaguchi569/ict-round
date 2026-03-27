import type { Checkpoint } from '../types';

interface Props {
  checkpoints: Checkpoint[];
  onDelete: (id: string) => void;
  onAddNew: () => void;
  onGenerateReport: () => void;
}

export default function CheckpointList({ checkpoints, onDelete, onAddNew, onGenerateReport }: Props) {
  return (
    <div className="animate-page px-5 pt-2 pb-28">
      {/* Section label */}
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xs font-medium text-ink-muted uppercase tracking-widest">
          チェックポイント
        </h2>
        <span className="text-xs text-ink-faint">{checkpoints.length}件</span>
      </div>

      {checkpoints.length === 0 ? (
        <div className="text-center py-20 animate-fade">
          <div className="w-14 h-14 rounded-2xl bg-cream-dark flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-ink-faint" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-ink-muted text-sm">まだチェックポイントがありません</p>
          <p className="text-ink-faint text-xs mt-1">下のボタンから追加してください</p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {checkpoints.map((cp) => (
            <div key={cp.id} className="bg-surface rounded-2xl border border-border overflow-hidden transition-all duration-200 active:scale-[0.99]">
              <div className="flex">
                <img src={cp.photoDataUrl} alt={cp.location} className="w-20 h-20 object-cover flex-shrink-0" />
                <div className="p-3 flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm text-ink truncate">{cp.location}</h3>
                      <p className="text-xs text-ink-faint mt-0.5">{cp.timestamp}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`${cp.location}を削除してもよろしいですか？`)) {
                          onDelete(cp.id);
                        }
                      }}
                      aria-label={`${cp.location}を削除`}
                      className="text-ink-faint hover:text-danger flex-shrink-0 p-1 -mr-1 transition-colors duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {cp.comment && (
                    <p className="text-xs text-ink-muted mt-1.5 line-clamp-1">{cp.comment}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream/80 backdrop-blur-xl border-t border-border p-4 flex gap-3">
        <button
          onClick={onAddNew}
          className="flex-1 bg-sage text-white rounded-xl py-3 font-medium text-sm tracking-wide hover:bg-sage-dark transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          追加
        </button>
        {checkpoints.length > 0 && (
          <button
            onClick={onGenerateReport}
            className="flex-1 bg-surface text-ink border border-border rounded-xl py-3 font-medium text-sm tracking-wide hover:bg-cream-dark transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            レポート作成
          </button>
        )}
      </div>
    </div>
  );
}
