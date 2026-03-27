import type { Checkpoint } from '../types';

interface Props {
  checkpoints: Checkpoint[];
  onDelete: (id: string) => void;
  onAddNew: () => void;
  onGenerateReport: () => void;
}

export default function CheckpointList({ checkpoints, onDelete, onAddNew, onGenerateReport }: Props) {
  return (
    <div className="animate-page px-5 pt-4 pb-32">
      {/* Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-text">チェックポイント一覧</h2>
        <span className="text-xs font-bold text-primary bg-primary-light px-2.5 py-1 rounded-full">{checkpoints.length} 件</span>
      </div>

      {checkpoints.length === 0 ? (
        <div className="text-center py-16 animate-fade">
          <div className="w-20 h-20 rounded-t-lg bg-base-deep flex items-center justify-center mx-auto mb-5">
            <svg className="w-9 h-9 text-text-faint" fill="none" stroke="currentColor" strokeWidth={1.3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-text-muted text-sm font-bold">まだ何もありません</p>
          <p className="text-text-faint text-xs mt-1.5 leading-relaxed">下の「追加」ボタンから<br />チェックポイントを記録しましょう</p>
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {checkpoints.map((cp) => (
            <div key={cp.id} className="card overflow-hidden transition-all duration-200 active:scale-[0.98]">
              <div className="flex">
                <img src={cp.photoDataUrl} alt={cp.location} className="w-22 h-22 object-cover flex-shrink-0" />
                <div className="p-3.5 flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-text truncate">{cp.location}</h3>
                      <p className="text-xs text-text-faint mt-0.5">{cp.timestamp}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`${cp.location}を削除してもよろしいですか？`)) {
                          onDelete(cp.id);
                        }
                      }}
                      aria-label={`${cp.location}を削除`}
                      className="text-text-faint hover:text-danger hover:bg-danger-light flex-shrink-0 p-1.5 -mr-1 rounded-xl transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {cp.comment && (
                    <p className="text-xs text-text-muted mt-1.5 line-clamp-2 leading-relaxed">{cp.comment}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-line p-4 pb-6 flex gap-3">
        <button
          onClick={onAddNew}
          className="btn-primary flex-1 py-3.5 font-bold text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          追加
        </button>
        {checkpoints.length > 0 && (
          <button
            onClick={onGenerateReport}
            className="flex-1 bg-ok-light text-ok border-2 border-ok/20 rounded-t py-3.5 font-bold text-sm hover:bg-ok hover:text-white hover:border-ok transition-all duration-200 active:scale-[0.97] flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            レポート作成
          </button>
        )}
      </div>
    </div>
  );
}
