const TEMPLATE_NAME = 'facility-settings-template.xlsx';

/** Card for picking a settings workbook, with the template download. */
export default function SettingsFileCard({ loading, onFile }: { loading: boolean; onFile: (file: File) => void }) {
  const templateUrl = `${import.meta.env.BASE_URL}${TEMPLATE_NAME}`;
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-extrabold text-text">施設設定の読み込み</h2>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">
          部署グループ・部署・チェック項目・参加者を書いた Excel ファイル（.xlsx）を読み込みます。はじめての場合は、ひな形をダウンロードして記入例を書き換えてください。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={`btn-primary inline-block px-5 py-2.5 text-sm font-bold focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
            loading ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          {loading ? '読み込み中...' : 'ファイルを選ぶ'}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            // Visually hidden but still focusable, so the picker can be opened from the keyboard.
            className="sr-only"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onFile(file);
            }}
          />
        </label>
        <a
          href={templateUrl}
          download={TEMPLATE_NAME}
          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border-2 border-line hover:border-primary hover:text-primary text-text-muted transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          ひな形をダウンロード
        </a>
      </div>
      <p className="text-[11px] text-text-faint leading-relaxed">
        読み込んだ設定はこの端末のブラウザに保存され、外部には送信されません。
      </p>
    </div>
  );
}
