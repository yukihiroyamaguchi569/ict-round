import { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import type { RoundData, RoundExport, ChecklistCategory } from './types';
import { buildDocxBlob, reportTitle } from './docx';
import { embedRoundExport } from './roundExportDocx';
import { trackEvent } from './analytics';
import { localDateString } from './localDate';
import { markRoundsUsed } from './roundUsage';

// Variant A 検証中: type を省略しているため一時的に未使用（Variant B/恒久対応で復活）
// const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * 報告書のファイル名。半角英数のみ（日本語名だと iOS の AirDrop が失敗する）。
 * 複数人分が受信側で衝突しないよう末尾に乱数の suffix を付ける。
 */
function reportFileName(date: string, suffix: string): string {
  return `ICTround_${date}_${suffix}.docx`;
}

/** 統合ページは localStorage を持たないためチェックリスト定義を同梱する */
function buildRoundExport(roundData: RoundData, categories: ChecklistCategory[], exportedAt: string): RoundExport {
  return {
    format: 'meguru-round',
    version: 1,
    exportedAt,
    checklistName: roundData.checklistName ?? '',
    categories,
    roundData,
  };
}

/** この端末の Web Share API でファイルを共有できるか */
function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !('share' in navigator)) return false;
  // Variant A: type を省略（DOCX_MIME を渡すと iOS メール共有が即閉じる問題の検証）
  const testFile = new File([''], 'test.docx');
  return navigator.canShare?.({ files: [testFile] }) ?? false;
}

/**
 * 報告書の .docx の事前生成と、共有・ダウンロード。
 * 送るのは .docx 1本だけ。統合ページ用のラウンドデータは docx の中に同梱する。
 * docx は写真込みだと生成に時間がかかるため、プレビュー表示時に事前生成して File をキャッシュする。
 * iOS では navigator.share() をタップ直後（transient activation 中）に await を挟まず呼ぶ必要があり、
 * 生成を待ってから share すると共有/メール画面が即閉じてしまうため。
 */
export function useReportFile(roundData: RoundData, categories: ChecklistCategory[], isSample = false) {
  const [shareFile, setShareFile] = useState<File | null>(null);
  // 共有に失敗した環境ではダウンロード表示に切り替える
  const [shareFailed, setShareFailed] = useState(false);
  // docx の生成に失敗すると共有も保存もできないため、理由を画面に出す
  const [buildError, setBuildError] = useState<string | null>(null);
  // 二重タップで navigator.share() が並行実行されると、後発が InvalidStateError で
  // 落ちて「共有できませんでした」表示になるため、共有中は押せないようにする
  const [sharing, setSharing] = useState(false);
  // Fixed once when the preview opens, so the pre-built file name and the share text never disagree across midnight
  const [reportDate] = useState(localDateString);
  const canShare = canShareFiles();

  // プレビュー表示時に docx を事前生成して File をキャッシュしておく。
  // roundData / categories はこの画面の表示中に変化しない（App の state をそのまま渡している）ため、生成は1回になる。
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line sonarjs/pseudo-random -- filename suffix only to avoid collisions, not security-sensitive
    const docxFilename = reportFileName(reportDate, Math.random().toString(36).slice(2, 6));
    const roundExport = buildRoundExport(roundData, categories, new Date().toISOString());

    buildDocxBlob(roundData, categories, isSample)
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
  }, [roundData, categories, isSample, reportDate]);

  const handleShare = () => {
    if (!shareFile || sharing) return;
    setSharing(true);
    // iOS では transient activation が切れると共有画面が即閉じるため、
    // await を挟まずキャッシュ済みの File を同期的に share する。
    // メール作成画面は title/text が無いと中身ゼロで開いて即閉じるため件名・本文を付ける。
    // AirDrop の転送失敗はファイル名の半角英数化で対処済み。
    navigator.share({
      title: reportTitle(isSample),
      text: `${roundData.inspectorName} - ${reportDate}`,
      files: [shareFile],
    }).then(() => {
      // Count only completed shares, same as main (PR #87): a cancelled share sheet is not an export.
      trackEvent('round_export', { method: 'share', sample: isSample });
      if (!isSample) markRoundsUsed();
    }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('共有エラー:', err);
      setShareFailed(true);
    }).finally(() => {
      setSharing(false);
    });
  };

  const handleDownload = () => {
    if (!shareFile) return;
    saveAs(shareFile, shareFile.name);
    trackEvent('round_export', { method: 'download', sample: isSample });
    if (!isSample) markRoundsUsed();
  };

  return { shareFile, shareFailed, buildError, sharing, canShare, handleShare, handleDownload };
}

export type ReportFile = ReturnType<typeof useReportFile>;
