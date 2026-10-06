import { useMergeFiles } from './useMergeFiles';
import DropZone from './DropZone';
import LoadedFileList from './LoadedFileList';
import MergePreview from './MergePreview';

export default function MergeApp() {
  const { files, errors, merged, exportError, building, addFiles, move, remove, exportDocx } = useMergeFiles();

  return (
    <div className="min-h-screen bg-base">
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-lg border-b border-line px-5 py-3.5">
        <h1 className="text-base font-extrabold text-text">ラウンド報告書の統合</h1>
        <p className="text-xs text-text-muted mt-0.5">
          複数の部署の報告書（.docx）をまとめて1本のWord報告書にします
        </p>
      </div>

      <div className="animate-page px-4 py-5 pb-16 max-w-5xl mx-auto space-y-5">
        {/* 1. ファイル選択 */}
        <DropZone onFiles={(fileList) => void addFiles(fileList)} />

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
          <LoadedFileList files={files} columnCount={merged?.columns.length ?? 0} onMove={move} onRemove={remove} />
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
          <MergePreview merged={merged} building={building} exportError={exportError} onExport={() => void exportDocx()} />
        )}
      </div>
    </div>
  );
}
