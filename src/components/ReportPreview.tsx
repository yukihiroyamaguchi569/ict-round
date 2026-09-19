import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { saveAs } from 'file-saver';
import type { RoundData, RoundExport, ChecklistCategory } from '../types';
import { findItemById } from '../checklistData';
import { buildDocxBlob, RATING_HEX } from '../docx';
import { embedRoundExport } from '../roundExportDocx';
import { trackEvent } from '../analytics';

// Variant A 検証中: type を省略しているため一時的に未使用（Variant B/恒久対応で復活）
// const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface Props {
  roundData: RoundData;
  categories: ChecklistCategory[];
  onBack: () => void;
}

export default function ReportPreview({ roundData, categories, onBack }: Props) {
  const { theme } = useTheme();
  const reportRef = useRef<HTMLDivElement>(null);
  // 送るのは .docx 1本だけ。統合ページ用のラウンドデータは docx の中に同梱する。
  // docx は写真込みだと生成に時間がかかるため、プレビュー表示時に事前生成して File をキャッシュする。
  // iOS では navigator.share() をタップ直後（transient activation 中）に await を挟まず呼ぶ必要があり、
  // 生成を待ってから share すると共有/メール画面が即閉じてしまうため。
  const [shareFile, setShareFile] = useState<File | null>(null);
  // 共有に失敗した環境ではダウンロード表示に切り替える
  const [shareFailed, setShareFailed] = useState(false);
  // docx の生成に失敗すると共有も保存もできないため、理由を画面に出す
  const [buildError, setBuildError] = useState<string | null>(null);
  // 二重タップで navigator.share() が並行実行されると、後発が InvalidStateError で
  // 落ちて「共有できませんでした」表示になるため、共有中は押せないようにする
  const [sharing, setSharing] = useState(false);
  const canShare = (() => {
    if (typeof navigator === 'undefined' || !('share' in navigator)) return false;
    // Variant A: type を省略（DOCX_MIME を渡すと iOS メール共有が即閉じる問題の検証）
    const testFile = new File([''], 'test.docx');
    return navigator.canShare?.({ files: [testFile] }) ?? false;
  })();

  // プレビュー表示時に docx を事前生成して File をキャッシュしておく。
  // roundData / categories はこの画面の表示中に変化しないため生成は1回でよい。
  useEffect(() => {
    let cancelled = false;
    // ファイル名は半角英数のみ（日本語名だと iOS の AirDrop が失敗する）。
    // 複数人分が受信側で衝突しないよう末尾に乱数を付ける。
    const dateStr = new Date().toISOString().slice(0, 10);
    const docxFilename = `ICTround_${dateStr}_${Math.random().toString(36).slice(2, 6)}.docx`;

    // 統合ページは localStorage を持たないためチェックリスト定義を同梱する。
    const roundExport: RoundExport = {
      format: 'meguru-round',
      version: 1,
      exportedAt: new Date().toISOString(),
      checklistName: roundData.checklistName ?? '',
      categories,
      roundData,
    };

    buildDocxBlob(roundData, categories)
      .then((blob) => embedRoundExport(blob, roundExport))
      .then((blob) => {
        // Variant A: type を省略（手動添付と同様に OS が拡張子から MIME を推定させる）
        if (!cancelled) setShareFile(new File([blob], docxFilename));
      })
      .catch((err: unknown) => {
        console.error('DOCX生成エラー:', err);
        if (!cancelled) setBuildError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShare = () => {
    if (!shareFile || sharing) return;
    setSharing(true);
    // iOS では transient activation が切れると共有画面が即閉じるため、
    // await を挟まずキャッシュ済みの File を同期的に share する。
    // メール作成画面は title/text が無いと中身ゼロで開いて即閉じるため件名・本文を付ける。
    // AirDrop の転送失敗はファイル名の半角英数化で対処済み。
    navigator.share({
      title: '感染対策ラウンド報告書',
      text: `${roundData.inspectorName} - ${new Date().toISOString().slice(0, 10)}`,
      files: [shareFile],
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('共有エラー:', err);
      setShareFailed(true);
    }).finally(() => {
      setSharing(false);
    });
    trackEvent('round_export', { method: 'share' });
  };

  const handleDownload = () => {
    if (!shareFile) return;
    saveAs(shareFile, shareFile.name);
    trackEvent('round_export', { method: 'download' });
  };

  // 生成前のボタン表示。失敗したまま「準備中…」を出し続けないようにする
  const pendingLabel = buildError ? '作成できません' : '準備中…';

  const ratedCount = roundData.checklistResults.filter((r) => r.rating !== null).length;
  const totalItems = roundData.checklistResults.length;
  const totalPhotos =
    roundData.checklistResults.reduce((s, r) => s + r.photos.length, 0) +
    roundData.generalPhotos.length;

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-5 py-3.5 flex items-center justify-between">
        <button onClick={onBack} className="text-text-muted text-sm font-bold hover:text-text transition-colors duration-200 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {theme.backLabel}
        </button>
        {canShare && !shareFailed ? (
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
        ) : (
          // 共有非対応 or 共有失敗
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
        )}
      </div>

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

      {/* Report preview */}
      <div className="animate-page px-4 py-5 pb-10">
        <div ref={reportRef} className="card p-5 max-w-2xl mx-auto space-y-6">
          {/* Title */}
          <div className="text-center pb-4">
            <h1 className="text-lg font-extrabold text-text">感染対策ラウンド報告書</h1>
            <div className="w-12 h-1 bg-primary rounded-full mx-auto mt-3" />
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '担当者', value: roundData.inspectorName },
              { label: '病棟', value: roundData.wardName || '—' },
              { label: '実施日時', value: roundData.startTime },
              { label: 'チェック', value: `${ratedCount}/${totalItems}項目` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-base rounded-t px-3 py-2.5">
                <p className="text-[10px] text-text-faint font-bold uppercase tracking-wider">{label}</p>
                <p className="text-sm font-bold text-text mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Section 1: Checklist */}
          <div>
            <h2 className="text-sm font-extrabold text-text mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-extrabold flex items-center justify-center" style={{ boxShadow: 'var(--t-btn-glow)' }}>1</span>
              チェックリスト
            </h2>
            <table className="w-full text-xs border-collapse rounded-t overflow-hidden">
              <thead>
                <tr className="bg-white">
                  <th className="text-left px-2 py-1.5 font-bold text-text-muted border border-line w-[14%]">ジャンル</th>
                  <th className="text-left px-2 py-1.5 font-bold text-text-muted border border-line">チェック項目</th>
                  <th className="text-center px-2 py-1.5 font-bold text-text-muted border border-line w-[7%]">評価</th>
                </tr>
              </thead>
              <tbody>
                {categories.flatMap((cat) =>
                  cat.items.map((item) => {
                    const result = roundData.checklistResults.find((r) => r.itemId === item.id);
                    const rating = result?.rating;
                    return (
                      <tr key={item.id} className="border-t border-line">
                        <td className="px-2 py-1.5 border border-line bg-white text-text-muted align-top leading-relaxed">{cat.category}</td>
                        <td className="px-2 py-1.5 border border-line text-text leading-relaxed">{item.description}</td>
                        <td className="px-2 py-1.5 border border-line text-center align-middle">
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded font-extrabold"
                            style={
                              rating
                                ? { backgroundColor: RATING_HEX[rating] + '22', color: RATING_HEX[rating], border: `1.5px solid ${RATING_HEX[rating]}` }
                                : { backgroundColor: 'transparent', color: 'var(--t-text-faint)' }
                            }
                          >
                            {rating ?? '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Section 2: Photos */}
          {totalPhotos > 0 && (
            <div>
              <h2 className="text-sm font-extrabold text-text mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-extrabold flex items-center justify-center" style={{ boxShadow: 'var(--t-btn-glow)' }}>2</span>
                写真記録とICTコメント
                <span className="text-xs font-normal text-text-muted">（{totalPhotos}枚）</span>
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {roundData.checklistResults.filter((r) => r.photos.length > 0).flatMap((result) => {
                  const item = findItemById(categories, result.itemId);
                  return result.photos.map((photo) => (
                    <div key={photo.id} className="rounded overflow-hidden bg-base border border-line">
                      <p className="px-1.5 py-1 text-[9px] font-bold text-primary truncate bg-base-deep">{item?.category}：{item?.description.slice(0, 20)}{item && item.description.length > 20 ? '…' : ''}</p>
                      <img src={photo.dataUrl} alt="" className="w-full aspect-square object-contain bg-base" />
                      {photo.comment && <p className="px-1.5 py-1 text-[9px] text-text-muted line-clamp-2">{photo.comment}</p>}
                    </div>
                  ));
                })}
                {roundData.generalPhotos.map((photo) => (
                  <div key={photo.id} className="rounded overflow-hidden bg-base border border-line">
                    <img src={photo.dataUrl} alt="" className="w-full aspect-square object-contain bg-base" />
                    {photo.comment && <p className="px-1.5 py-1 text-[9px] text-text-muted line-clamp-2">{photo.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Evaluation */}
          <div>
            <h2 className="text-sm font-extrabold text-text mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-extrabold flex items-center justify-center" style={{ boxShadow: 'var(--t-btn-glow)' }}>3</span>
              総評
            </h2>
            {roundData.overallEvaluation.trim() ? (
              <div className="bg-base rounded-t px-4 py-3">
                <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{roundData.overallEvaluation}</p>
              </div>
            ) : (
              <p className="text-sm text-text-faint italic px-1">（総評は未入力です）</p>
            )}
          </div>

        </div>

        {/* 共有した .docx の使い道を、送った直後の文脈で案内する */}
        <div className="max-w-2xl mx-auto mt-5 px-1">
          <p className="text-xs text-text-muted leading-relaxed">
            複数部署のレポートを1本にまとめるには、PCで
            <a
              href="./merge.html"
              target="_blank"
              rel="noopener"
              className="font-bold text-primary hover:underline mx-1"
            >
              統合ページ
            </a>
            を開き、各担当者から集めた <code className="font-bold">.docx</code> を読み込んでください。統合に必要なデータはこの報告書の中に入っています。
          </p>
        </div>
      </div>
    </div>
  );
}
