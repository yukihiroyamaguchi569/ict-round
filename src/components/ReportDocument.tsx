import { useRef } from 'react';
import type { RoundData, ChecklistCategory } from '../types';
import { findItemById } from '../checklistData';
import { RATING_HEX } from '../docx';

interface Props {
  roundData: RoundData;
  categories: ChecklistCategory[];
}

/** 1. チェックリスト: 全項目と評価の表 */
function ReportChecklist({ roundData, categories }: Props) {
  return (
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
  );
}

/** 2. 写真記録とICTコメント: 項目の写真 → 全体写真の順 */
function ReportPhotos({ roundData, categories, totalPhotos }: Props & { totalPhotos: number }) {
  return (
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
  );
}

/** 画面上の報告書プレビュー。並びは出力する .docx と同じ */
export default function ReportDocument({ roundData, categories }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const ratedCount = roundData.checklistResults.filter((r) => r.rating !== null).length;
  const totalItems = roundData.checklistResults.length;
  const totalPhotos =
    roundData.checklistResults.reduce((s, r) => s + r.photos.length, 0) +
    roundData.generalPhotos.length;

  return (
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
      <ReportChecklist roundData={roundData} categories={categories} />

      {/* Section 2: Photos */}
      {totalPhotos > 0 && <ReportPhotos roundData={roundData} categories={categories} totalPhotos={totalPhotos} />}

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
  );
}
