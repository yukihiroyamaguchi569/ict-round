import type { Rating } from '../types';
import { RATING_HEX } from '../docx';
import { itemRowKey, type MergeResult } from './mergeRounds';

/** Why the last export failed, shown under the export button; nothing while there is no failure */
function ExportError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="text-xs font-bold text-danger mb-3">{message}</p>;
}

/** 1セル分の評価。未評価・項目なしは「—」 */
function RatingBadge({ rating }: { rating: Rating }) {
  if (!rating) return <span className="text-text-faint">—</span>;
  return (
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
  );
}

/** 部署を列とする評価マトリクス。カテゴリごとに見出し行を挟む */
function MergedRatingTable({ merged }: { merged: MergeResult }) {
  return (
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
            <tr key={itemRowKey(cat.category, item)}>
              <td className="px-2 py-1.5 border border-line text-text leading-relaxed">{item.description}</td>
              {merged.columns.map((col) => (
                <td key={col.label} className="px-2 py-1.5 border border-line text-center align-middle">
                  <RatingBadge rating={col.ratings.get(itemRowKey(cat.category, item)) ?? null} />
                </td>
              ))}
            </tr>
          )),
        ])}
      </tbody>
    </table>
  );
}

interface Props {
  merged: MergeResult;
  building: boolean;
  exportError: string | null;
  onExport: () => void;
}

/** 統合結果のプレビューと Word 出力ボタン */
export default function MergePreview({ merged, building, exportError, onExport }: Props) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-sm font-extrabold text-text">統合結果のプレビュー</h2>
        <button
          onClick={onExport}
          disabled={building}
          className="btn-primary px-5 py-2.5 text-sm font-bold disabled:opacity-50 shrink-0"
        >
          {building ? '生成中…' : 'Word出力'}
        </button>
      </div>
      <ExportError message={exportError} />

      <div className="overflow-x-auto">
        <MergedRatingTable merged={merged} />
      </div>

      <p className="text-[11px] text-text-faint mt-3 leading-relaxed">
        Wordにはこの表に加えて、部署ごとの総評と写真も出力されます。
      </p>
    </div>
  );
}
