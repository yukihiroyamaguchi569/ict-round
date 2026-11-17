import { useEffect, useState } from 'react';
import { saveAs } from 'file-saver';
import { canShareFiles } from '../useReportFile';
import { localDateString } from '../localDate';
import { buildFacilityDocxBlob } from './facilityDocx';
import { embedFacilityRoundExport } from './facilityReportFile';
import { buildFacilityRoundExport } from './facilityRoundExport';
import type { FacilityRound } from './facilityRound';
import { formatStartedAt } from './dateTimeLocal';

/**
 * ASCII only (a Japanese name makes iOS AirDrop fail). The date is the round's own, on this device's calendar;
 * the suffix keeps files of the same day from colliding on the receiving side.
 */
export function facilityReportFileName(startedAt: string, suffix: string, now: Date = new Date()): string {
  const started = new Date(startedAt);
  const date = localDateString(Number.isNaN(started.getTime()) ? now : started);
  return `ICTround_facility_${date}_${suffix}.docx`;
}

/**
 * The report .docx of a round, with the round and its photo images embedded, built once the photos are read.
 * Built ahead so the share button can call navigator.share without an await in between (iOS closes the share
 * sheet otherwise). No analytics event is sent.
 */
export function useFacilityReportFile(round: FacilityRound, photoData: Record<string, string> | null) {
  // Kept with what it was built from: after an import changes the round, the old file is not handed out.
  const [built, setBuilt] = useState<{ round: FacilityRound; photoData: Record<string, string>; file: File } | null>(null);
  const shareFile = built && built.round === round && built.photoData === photoData ? built.file : null;
  const [buildError, setBuildError] = useState<string | null>(null);
  const [shareFailed, setShareFailed] = useState(false);
  // A second tap while the share sheet is open would fail with InvalidStateError.
  const [sharing, setSharing] = useState(false);
  const canShare = canShareFiles();

  useEffect(() => {
    if (!photoData) return;
    let cancelled = false;
    // eslint-disable-next-line sonarjs/pseudo-random -- file name suffix only to avoid collisions, not security-sensitive
    const suffix = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
    const exportData = buildFacilityRoundExport(round, photoData, new Date());
    buildFacilityDocxBlob(round, photoData)
      .then((blob) => embedFacilityRoundExport(blob, exportData))
      .then((blob) => {
        if (!cancelled) setBuilt({ round, photoData, file: new File([blob], facilityReportFileName(round.startedAt, suffix)) });
      })
      .catch((err: unknown) => {
        console.error('DOCX生成エラー:', err);
        if (!cancelled) setBuildError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [round, photoData]);

  const handleShare = () => {
    if (!shareFile || sharing) return;
    setSharing(true);
    // The mail composer opens empty and closes at once without a title and text.
    navigator
      .share({ title: `感染対策ラウンド ${round.themeName}`, text: formatStartedAt(round.startedAt), files: [shareFile] })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('共有エラー:', err);
        setShareFailed(true);
      })
      .finally(() => setSharing(false));
  };

  const handleDownload = () => {
    if (shareFile) saveAs(shareFile, shareFile.name);
  };

  return { shareFile, shareFailed, buildError, sharing, canShare, handleShare, handleDownload };
}
