import { useCallback, useRef, useState, type RefObject } from 'react';
import type { FacilityRound } from './facilityRound';
import { loadFacilityRoundFile, type LoadFacilityRoundResult } from './facilityReportFile';
import { mergeFacilityRounds, type MergeReport } from './mergeFacilityRounds';
import type { ExportedPhoto } from './facilityRoundExport';
import { saveErrorMessage } from '../roundData';

/** What the last import did: merged (with what it did), nothing new, or not imported with the reason. */
export type ImportOutcome =
  | { kind: 'imported'; report: MergeReport }
  | { kind: 'unchanged' }
  | { kind: 'failed'; message: string };

type FileFailure = Extract<LoadFacilityRoundResult, { ok: false }>['reason'];

const FILE_FAILURE_MESSAGES: Record<FileFailure, string> = {
  'too-large': 'ファイルが大きすぎるため、取り込めませんでした（50MB まで）。',
  'not-docx': 'Word のファイル（.docx）ではないため、取り込めませんでした。',
  'no-round-data': 'このファイルにはラウンドの記録が入っていません。ほかの端末の帳票の画面で書き出した Word を選んでください。',
};

export function fileFailureMessage(reason: FileFailure): string {
  return FILE_FAILURE_MESSAGES[reason];
}

export function themeMismatchMessage(here: string, file: string): string {
  return `テーマが違うので取り込めません（こちら: ${here}、ファイル: ${file}）。`;
}

const IMPORT_FAILED_MESSAGE = '取り込めませんでした。ラウンドを開き直してから、もう一度ファイルを選んでください。';

export const IMPORT_PHOTO_ERROR_MESSAGE = '写真を保存できなかったため、取り込みませんでした。もう一度ファイルを選んでください。';

/** The quota message of saveErrorMessage when storage is full, otherwise the import photo message. */
export function importPhotoErrorMessage(error: unknown): string {
  const message = saveErrorMessage(error);
  return message === saveErrorMessage(null) ? IMPORT_PHOTO_ERROR_MESSAGE : message;
}

/** The lines of a merge report, in the order a reader checks them. */
export function importReportLines(report: MergeReport): string[] {
  const lines: string[] = [];
  if (report.differentDay) lines.push('違う日のラウンドの記録でした。日付が合っているか確かめてください。');
  if (report.addedDepartments.length > 0) lines.push(`足した部署: ${report.addedDepartments.join('、')}`);
  for (const conflict of report.conflicts) {
    lines.push(`食い違ったため × にしたマス: ${conflict.department}：${conflict.itemText}`);
  }
  for (const text of report.unknownItems) lines.push(`このラウンドに無いため取り込めなかった項目: ${text}`);
  if (report.notApplicableCells > 0) lines.push(`対象外のため入れなかったマス: ${report.notApplicableCells} 個`);
  if (report.addedPhotos > 0) lines.push(`足した写真: ${report.addedPhotos} 枚`);
  return lines;
}

type Change = (apply: (current: FacilityRound) => FacilityRound) => Promise<boolean> | undefined;

interface RoundImportDeps {
  latestRef: RefObject<FacilityRound | null>;
  /** Applies a change on screen and saves it in the queue of every other save; undefined when nothing changed. */
  change: Change;
  /** Stores photo images; null when all were stored. */
  storePhotos: (photos: ExportedPhoto[]) => Promise<{ error: unknown } | null>;
}

/**
 * Importing a report file of another device into the round on screen: the file is read and checked, the new
 * photo images are stored, and only then the merged round is saved. A failed save of the round is shown like
 * any other autosave failure. One import at a time.
 */
export function useRoundImport({ latestRef, change, storePhotos }: RoundImportDeps) {
  const [importing, setImporting] = useState(false);
  const [importOutcome, setImportOutcome] = useState<ImportOutcome | null>(null);
  const busy = useRef(false);

  const run = useCallback(
    async (file: Blob): Promise<ImportOutcome> => {
      const loaded = await loadFacilityRoundFile(file);
      if (!loaded.ok) return { kind: 'failed', message: fileFailureMessage(loaded.reason) };
      const incoming = loaded.export.round;
      const current = latestRef.current;
      if (!current) return { kind: 'failed', message: IMPORT_FAILED_MESSAGE };
      const preview = mergeFacilityRounds(current, incoming);
      if (!preview.ok) return { kind: 'failed', message: themeMismatchMessage(current.themeName, incoming.themeName) };

      const newIds = new Set(preview.newPhotoIds);
      const failure = await storePhotos(loaded.export.photos.filter((p) => newIds.has(p.id)));
      if (failure) return { kind: 'failed', message: importPhotoErrorMessage(failure.error) };

      // Merged again onto the round as it is now: a mark may have been entered while the photos were stored.
      const result: { report: MergeReport | null } = { report: null };
      const saved = change((latest) => {
        const merged = mergeFacilityRounds(latest, incoming);
        if (!merged.ok || JSON.stringify(merged.round) === JSON.stringify(latest)) return latest;
        result.report = merged.report;
        return merged.round;
      });
      await saved;
      return result.report ? { kind: 'imported', report: result.report } : { kind: 'unchanged' };
    },
    [latestRef, change, storePhotos]
  );

  const importFile = useCallback(
    async (file: Blob) => {
      if (busy.current) return;
      busy.current = true;
      setImporting(true);
      setImportOutcome(null);
      try {
        setImportOutcome(await run(file));
      } finally {
        busy.current = false;
        setImporting(false);
      }
    },
    [run]
  );

  return { importing, importOutcome, importFile };
}
