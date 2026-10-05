import type { RoundExport } from '../types';
import type { LoadedFile } from './useMergeFiles';

function photoCount(data: RoundExport): number {
  return (
    data.roundData.checklistResults.reduce((s, r) => s + r.photos.length, 0) +
    data.roundData.generalPhotos.length
  );
}

function ratedCount(data: RoundExport): number {
  return data.roundData.checklistResults.filter((r) => r.rating !== null).length;
}

/** 同じ病棟名の報告書は1列にまとまるので、まとまる相手がいるファイルを見分ける */
function sharesWard(files: LoadedFile[], file: LoadedFile): boolean {
  const ward = file.data.roundData.wardName.trim();
  if (!ward) return false;
  return files.filter((f) => f.data.roundData.wardName.trim() === ward).length > 1;
}

interface Props {
  files: LoadedFile[];
  /** 統合後の表の列数（同じ病棟名の報告書は1列にまとまる） */
  columnCount: number;
  onMove: (index: number, delta: number) => void;
  onRemove: (id: string) => void;
}

/** 読み込んだ報告書の一覧。並び順が表の列順になる */
export default function LoadedFileList({ files, columnCount, onMove, onRemove }: Props) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-extrabold text-text mb-3">
        読み込んだ報告書（{files.length}件）
        <span className="ml-2 text-xs font-medium text-text-muted">
          同じ病棟名の報告書は1列にまとまります（表は{columnCount}列）。この順序が表の列順になります
        </span>
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
                {sharesWard(files, f) && '・同じ病棟の報告書と1列にまとまります'}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onMove(i, -1)} disabled={i === 0}
                className="w-7 h-7 rounded-t text-text-muted hover:text-text disabled:opacity-25" aria-label="上へ">↑</button>
              <button onClick={() => onMove(i, 1)} disabled={i === files.length - 1}
                className="w-7 h-7 rounded-t text-text-muted hover:text-text disabled:opacity-25" aria-label="下へ">↓</button>
              <button onClick={() => onRemove(f.id)}
                className="w-7 h-7 rounded-t text-danger hover:opacity-70" aria-label="削除">×</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
