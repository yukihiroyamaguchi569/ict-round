import type { Checkpoint } from '../types';

interface Props {
  checkpoints: Checkpoint[];
  onDelete: (id: string) => void;
  onAddNew: () => void;
  onGenerateReport: () => void;
}

export default function CheckpointList({ checkpoints, onDelete, onAddNew, onGenerateReport }: Props) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800">
          チェックポイント一覧
          <span className="ml-2 text-sm font-normal text-gray-500">({checkpoints.length}件)</span>
        </h2>
      </div>

      {checkpoints.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>チェックポイントがありません</p>
          <p className="text-sm mt-1">下のボタンから追加してください</p>
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {checkpoints.map((cp) => (
            <div key={cp.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex">
                <img src={cp.photoDataUrl} alt={cp.location} className="w-24 h-24 object-cover flex-shrink-0" />
                <div className="p-3 flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800 truncate">{cp.location}</h3>
                      <p className="text-xs text-gray-400">{cp.timestamp}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (window.confirm(`${cp.location}を削除してもよろしいですか？`)) {
                          onDelete(cp.id);
                        }
                      }}
                      aria-label={`${cp.location}を削除`}
                      className="text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  {cp.comment && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{cp.comment}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3">
        <button
          onClick={onAddNew}
          className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          追加
        </button>
        {checkpoints.length > 0 && (
          <button
            onClick={onGenerateReport}
            className="flex-1 bg-green-600 text-white rounded-lg py-3 font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            レポート作成
          </button>
        )}
      </div>

      {/* Bottom spacer for fixed footer */}
      <div className="h-20" />
    </div>
  );
}
