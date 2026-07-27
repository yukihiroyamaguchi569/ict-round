import { useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import type { RoundExport } from '../types';
import { RATING_HEX } from '../docx';
import { mergeRounds, parseRoundExport } from './mergeRounds';
import { buildMergedDocxBlob } from './mergedDocx';

interface LoadedFile {
  id: string;
  filename: string;
  data: RoundExport;
}

function photoCount(data: RoundExport): number {
  return (
    data.roundData.checklistResults.reduce((s, r) => s + r.photos.length, 0) +
    data.roundData.generalPhotos.length
  );
}

function ratedCount(data: RoundExport): number {
  return data.roundData.checklistResults.filter((r) => r.rating !== null).length;
}

export default function MergeApp() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [building, setBuilding] = useState(false);

  const merged = useMemo(
    () => (files.length > 0 ? mergeRounds(files.map((f) => f.data)) : null),
    [files]
  );

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const loaded: LoadedFile[] = [];
    const failed: string[] = [];

    for (const file of Array.from(fileList)) {
      try {
        const data = parseRoundExport(await file.text());
        loaded.push({ id: crypto.randomUUID(), filename: file.name, data });
      } catch (err) {
        failed.push(`${file.name}: ${err instanceof Error ? err.message : '読み込みに失敗しました'}`);
      }
    }

    setFiles((prev) => [...prev, ...loaded]);
    setErrors(failed);
  };

  const move = (index: number, delta: number) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleExport = async () => {
    if (!merged) return;
    setBuilding(true);
    try {
      const blob = await buildMergedDocxBlob(merged);
      saveAs(blob, `ICTround_merged_${new Date().toISOString().slice(0, 10)}.docx`);
    } catch (err) {
      console.error('統合DOCX生成エラー:', err);
      setErrors([`Word出力に失敗しました: ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="min-h-screen bg-base">
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-5 py-3.5">
        <h1 className="text-base font-extrabold text-text">ラウンド報告書の統合</h1>
        <p className="text-xs text-text-muted mt-0.5">
          複数の部署のラウンドデータ（.json）をまとめて1本のWord報告書にします
        </p>
      </div>

      <div className="animate-page px-4 py-5 pb-16 max-w-5xl mx-auto space-y-5">
        {/* 1. ファイル選択 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
          className={`card p-8 text-center border-2 border-dashed transition-colors duration-200 ${
            dragging ? 'border-primary bg-primary-light' : 'border-line'
          }`}
        >
          <p className="text-sm font-bold text-text">ここに .json ファイルをドラッグ&ドロップ</p>
          <p className="text-xs text-text-muted mt-1">または</p>
          <label className="btn-primary inline-block px-5 py-2.5 text-sm font-bold mt-3 cursor-pointer">
            ファイルを選ぶ
            <input
              type="file"
              multiple
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }}
            />
          </label>
          <p className="text-[11px] text-text-faint mt-4 leading-relaxed">
            めぐる君の報告書プレビュー画面で「共有」を押すと、Wordと一緒に .json が送られます。<br />
            このページは読み込んだデータを保存しません。ページを再読み込みすると消えます。
          </p>
        </div>

        {/* エラー */}
        {errors.length > 0 && (
          <div className="card p-4 border border-danger">
            <p className="text-xs font-extrabold text-danger mb-1.5">読み込めなかったファイル</p>
            <ul className="text-xs text-text space-y-1">
              {errors.map((e) => <li key={e}>・{e}</li>)}
            </ul>
          </div>
        )}

        {/* 2. 読み込んだファイル一覧 */}
        {files.length > 0 && (
          <div className="card p-5">
            <h2 className="text-sm font-extrabold text-text mb-3">
              読み込んだ部署（{files.length}件）
              <span className="ml-2 text-xs font-medium text-text-muted">この順序が表の列順になります</span>
            </h2>
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li key={f.id} className="bg-base rounded-t px-3 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text truncate">
                      {f.data.roundData.wardName || '（部署名なし）'}
                      <span className="ml-2 text-xs font-medium text-text-muted">
                        担当: {f.data.roundData.inspectorName || '—'}
                      </span>
                    </p>
                    <p className="text-[11px] text-text-faint mt-0.5 truncate">
                      評価 {ratedCount(f.data)}/{f.data.roundData.checklistResults.length}項目・
                      写真 {photoCount(f.data)}枚・{f.filename}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => move(i, -1)} disabled={i === 0}
                      className="w-7 h-7 rounded-t text-text-muted hover:text-text disabled:opacity-25" aria-label="上へ">↑</button>
                    <button onClick={() => move(i, 1)} disabled={i === files.length - 1}
                      className="w-7 h-7 rounded-t text-text-muted hover:text-text disabled:opacity-25" aria-label="下へ">↓</button>
                    <button onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                      className="w-7 h-7 rounded-t text-danger hover:opacity-70" aria-label="削除">×</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. 警告 */}
        {merged && merged.warnings.length > 0 && (
          <div className="card p-4 border border-line">
            <p className="text-xs font-extrabold text-text mb-1.5">確認してください</p>
            <ul className="text-xs text-text-muted space-y-1 leading-relaxed">
              {merged.warnings.map((w) => <li key={w}>・{w}</li>)}
            </ul>
          </div>
        )}

        {/* 4. 統合結果プレビュー */}
        {merged && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3 gap-3">
              <h2 className="text-sm font-extrabold text-text">統合結果のプレビュー</h2>
              <button
                onClick={() => void handleExport()}
                disabled={building}
                className="btn-primary px-5 py-2.5 text-sm font-bold disabled:opacity-50 shrink-0"
              >
                {building ? '生成中…' : 'Word出力'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-1.5 font-bold text-text-muted border border-line bg-white min-w-[280px]">
                      チェック項目
                    </th>
                    {merged.columns.map((col) => (
                      <th key={col.label} className="text-center px-2 py-1.5 font-bold text-text-muted border border-line bg-white whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {merged.categories.flatMap((cat) => [
                    <tr key={`cat-${cat.category}`}>
                      <td colSpan={merged.columns.length + 1}
                        className="px-2 py-1.5 border border-line font-extrabold text-primary bg-primary-light">
                        {cat.category}
                      </td>
                    </tr>,
                    ...cat.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-2 py-1.5 border border-line text-text leading-relaxed">{item.description}</td>
                        {merged.columns.map((col) => {
                          const rating = col.ratings.get(item.id) ?? null;
                          return (
                            <td key={col.label} className="px-2 py-1.5 border border-line text-center align-middle">
                              {rating ? (
                                <span
                                  className="inline-flex items-center justify-center w-6 h-6 rounded font-extrabold"
                                  style={{
                                    backgroundColor: RATING_HEX[rating] + '22',
                                    color: RATING_HEX[rating],
                                    border: `1.5px solid ${RATING_HEX[rating]}`,
                                  }}
                                >
                                  {rating}
                                </span>
                              ) : (
                                <span className="text-text-faint">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-text-faint mt-3 leading-relaxed">
              Wordにはこの表に加えて、部署ごとの総評と写真も出力されます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
