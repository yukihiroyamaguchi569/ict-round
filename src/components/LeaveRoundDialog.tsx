interface Props {
  onSaveAndLeave: () => void;
  onLeave: () => void;
  onCancel: () => void;
}

export default function LeaveRoundDialog({ onSaveAndLeave, onLeave, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-text/40 backdrop-blur-sm">
      <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-text">トップ画面に戻りますか？</h2>
          <p className="mt-1 text-sm text-text-muted leading-relaxed">
            このラウンドには保存されていない変更があります。
          </p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onSaveAndLeave}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ backgroundColor: 'var(--t-primary)' }}
          >
            保存して戻る
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-red-600 border-2 border-line hover:border-red-300 transition-colors"
          >
            保存せずに戻る
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-text-muted border-2 border-line hover:border-primary hover:text-primary transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
