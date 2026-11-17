interface Props {
  onStay: () => void;
  onLeave: () => void;
}

/** On-screen confirmation before leaving a round whose input could not be saved. */
export default function UnsavedLeaveDialog({ onStay, onLeave }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-text/40 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-leave-title"
        aria-describedby="unsaved-leave-text"
        className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 space-y-4"
      >
        <div>
          <h2 id="unsaved-leave-title" className="text-base font-bold text-text">
            ホームへ戻りますか？
          </h2>
          <p id="unsaved-leave-text" className="mt-1 text-sm text-text-muted leading-relaxed">
            保存できていない入力があります。戻るとこの入力は失われます。
          </p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={onStay}
            // Focus starts on the safe choice.
            autoFocus
            className="btn-primary w-full py-3 text-sm font-bold"
          >
            この画面に残る
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="w-full py-3 rounded-xl text-sm font-bold text-danger border-2 border-line hover:border-danger transition-colors"
          >
            保存せずに戻る
          </button>
        </div>
      </div>
    </div>
  );
}
