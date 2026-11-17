/** Entry to the report screen, below the overall card. */
export default function ReportCard({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="帳票（遵守率と Word 出力）"
      className="card w-full flex items-center gap-3 p-5 text-left hover:ring-2 hover:ring-primary transition"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-base font-extrabold text-text">帳票</span>
        <span className="block text-sm text-text-muted mt-1">部署ごとの遵守率・Word で書き出す</span>
      </span>
      <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
