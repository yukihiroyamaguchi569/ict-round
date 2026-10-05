import type { ReportFile } from '../useReportFile';

/** ヘッダーの出力ボタン。共有できる端末では「共有」、共有非対応か共有に失敗したら「Word出力」 */
export function ReportExportButton({ file }: { file: ReportFile }) {
  const { shareFile, shareFailed, buildError, sharing, canShare, handleShare, handleDownload } = file;
  // 生成前のボタン表示。失敗したまま「準備中…」を出し続けないようにする
  const pendingLabel = buildError ? '作成できません' : '準備中…';

  if (canShare && !shareFailed) {
    return (
      <button
        onClick={handleShare}
        disabled={!shareFile || sharing}
        className="btn-primary px-5 py-2.5 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        {!shareFile ? pendingLabel : '共有'}
      </button>
    );
  }

  // 共有非対応 or 共有失敗
  return (
    <button
      onClick={handleDownload}
      disabled={!shareFile}
      className="btn-primary px-4 py-2.5 text-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {!shareFile ? pendingLabel : 'Word出力'}
    </button>
  );
}

/** 報告書ファイルを作れなかったとき・共有に失敗したときの案内 */
export function ReportExportNotices({ buildError, shareFailed }: { buildError: string | null; shareFailed: boolean }) {
  return (
    <>
      {buildError && (
        <div className="bg-primary-light border-b border-line px-5 py-2.5">
          <p className="text-xs text-text leading-relaxed max-w-2xl mx-auto">
            報告書ファイルを作成できませんでした（{buildError}）。写真の枚数を減らすか、ページを再読み込みしてやり直してください。
          </p>
        </div>
      )}

      {shareFailed && (
        <div className="bg-primary-light border-b border-line px-5 py-2.5">
          <p className="text-xs text-text leading-relaxed max-w-2xl mx-auto">
            共有できませんでした。<strong>Word出力</strong>を押して報告書を保存し、メールなどで送ってください。
          </p>
        </div>
      )}
    </>
  );
}
