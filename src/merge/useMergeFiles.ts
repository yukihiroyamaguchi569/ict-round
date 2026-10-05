import { useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import type { RoundExport } from '../types';
import { mergeRounds } from './mergeRounds';
import { loadRoundFile } from './loadRoundFile';
import { buildMergedDocxBlob } from './mergedDocx';
import { localDateString } from '../localDate';

export interface LoadedFile {
  id: string;
  filename: string;
  data: RoundExport;
}

/** index の要素を delta だけ移した新しい配列。範囲外へは動かさず、元の配列をそのまま返す */
export function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** 選ばれたファイルを順に読み込み、読めたものと、読めなかったファイルの理由に分ける */
async function loadFiles(fileList: FileList): Promise<{ loaded: LoadedFile[]; failed: string[] }> {
  const loaded: LoadedFile[] = [];
  const failed: string[] = [];
  for (const file of Array.from(fileList)) {
    try {
      const data = await loadRoundFile(file);
      loaded.push({ id: crypto.randomUUID(), filename: file.name, data });
    } catch (err) {
      failed.push(`${file.name}: ${err instanceof Error ? err.message : '読み込みに失敗しました'}`);
    }
  }
  return { loaded, failed };
}

/** 統合ページの状態: 読み込んだ報告書とその並び、読み込みエラー、統合結果、Word 出力 */
export function useMergeFiles() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  // Kept apart from load errors: those are listed under "読み込めなかったファイル"
  const [exportError, setExportError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  const merged = useMemo(
    () => (files.length > 0 ? mergeRounds(files.map((f) => f.data)) : null),
    [files]
  );

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const { loaded, failed } = await loadFiles(fileList);
    setFiles((prev) => [...prev, ...loaded]);
    setErrors(failed);
  };

  const move = (index: number, delta: number) => setFiles((prev) => moveItem(prev, index, delta));

  const remove = (id: string) => setFiles((prev) => prev.filter((x) => x.id !== id));

  const exportDocx = async () => {
    // Stryker disable next-line ConditionalExpression: the export button is rendered only while there is a merge result
    if (!merged) return;
    setBuilding(true);
    setExportError(null);
    try {
      const blob = await buildMergedDocxBlob(merged);
      saveAs(blob, `ICTround_merged_${localDateString()}.docx`);
    } catch (err) {
      console.error('統合DOCX生成エラー:', err);
      setExportError(`Word出力に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBuilding(false);
    }
  };

  return { files, errors, merged, exportError, building, addFiles, move, remove, exportDocx };
}
