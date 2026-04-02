import { useRef, useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel,
  BorderStyle, AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { RoundData, Photo } from '../types';
import { CHECKLIST_CATEGORIES, getItemById } from '../checklistData';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const RATING_HEX: Record<string, string> = {
  A: '059669',
  B: '2D9F70',
  C: 'D4A017',
  D: 'E07A5F',
  E: 'DC2626',
};

const RATING_BG: Record<string, string> = {
  A: 'D1FAE5',
  B: 'D1FAE5',
  C: 'FEF9C3',
  D: 'FEE2E2',
  E: 'FEE2E2',
};

interface Props {
  roundData: RoundData;
  onBack: () => void;
}

function base64ToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let j = 0; j < binaryStr.length; j++) {
    bytes[j] = binaryStr.charCodeAt(j);
  }
  return bytes;
}

function imageParasFromPhoto(photo: Photo): Paragraph[] {
  const paras: Paragraph[] = [];
  try {
    paras.push(new Paragraph({
      spacing: { after: 80 },
      children: [new ImageRun({
        data: base64ToUint8Array(photo.dataUrl),
        transformation: { width: 460, height: 345 },
        type: 'jpg',
      })],
    }));
  } catch {
    // skip
  }
  if (photo.comment) {
    paras.push(new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: photo.comment, size: 20 })],
    }));
  }
  return paras;
}

export default function ReportPreview({ roundData, onBack }: Props) {
  const { theme } = useTheme();
  const reportRef = useRef<HTMLDivElement>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if ('share' in navigator) {
      const testFile = new File([''], 'test.docx', { type: DOCX_MIME });
      setCanShare(navigator.canShare?.({ files: [testFile] }) ?? false);
    }
  }, []);

  const handleExportDocx = async () => {
    const children: (Paragraph | Table)[] = [];

    // ===== Title =====
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: '感染対策ラウンド報告書', bold: true, size: 32 })],
    }));

    children.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: '担当者: ', bold: true }),
        new TextRun(roundData.inspectorName),
        new TextRun('　'),
        new TextRun({ text: '病棟: ', bold: true }),
        new TextRun(roundData.wardName || '—'),
        new TextRun('　'),
        new TextRun({ text: '実施日時: ', bold: true }),
        new TextRun(roundData.startTime),
      ],
    }));

    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0C6B8A' } },
      spacing: { after: 300 },
      children: [],
    }));

    // ===== Section 1: Checklist Table =====
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 160 },
      children: [new TextRun({ text: '1. チェックリスト', bold: true, size: 26 })],
    }));

    for (const cat of CHECKLIST_CATEGORIES) {
      // Category heading row
      const catRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              shading: { type: ShadingType.SOLID, color: 'EDF1F7', fill: 'EDF1F7' },
              children: [new Paragraph({
                children: [new TextRun({ text: cat.category, bold: true, size: 22 })],
              })],
            }),
          ],
        }),
      ];

      for (const item of cat.items) {
        const result = roundData.checklistResults.find((r) => r.itemId === item.id);
        const rating = result?.rating ?? '—';
        const ratingColor = rating !== '—' ? RATING_HEX[rating] : 'AAAAAA';
        const ratingBg = rating !== '—' ? RATING_BG[rating] : 'F9F9F9';

        catRows.push(new TableRow({
          children: [
            new TableCell({
              width: { size: 88, type: WidthType.PERCENTAGE },
              children: [new Paragraph({
                children: [new TextRun({ text: item.description, size: 20 })],
              })],
            }),
            new TableCell({
              width: { size: 12, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color: ratingBg, fill: ratingBg },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: rating, bold: true, size: 24, color: ratingColor })],
              })],
            }),
          ],
        }));
      }

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: catRows,
      }));
      children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
    }

    // ===== Section 2: Photos =====
    const itemPhotosExist = roundData.checklistResults.some((r) => r.photos.length > 0);
    const generalPhotosExist = roundData.generalPhotos.length > 0;

    if (itemPhotosExist || generalPhotosExist) {
      children.push(new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'dddddd' } },
        spacing: { before: 300 },
        children: [],
      }));
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 160 },
        children: [new TextRun({ text: '2. 写真記録', bold: true, size: 26 })],
      }));

      // Item-linked photos
      for (const result of roundData.checklistResults) {
        if (result.photos.length === 0) continue;
        const item = getItemById(result.itemId);
        children.push(new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [new TextRun({ text: `▶ ${item?.category ?? ''}: ${item?.description ?? ''}`, bold: true, size: 20, color: '444444' })],
        }));
        for (const photo of result.photos) {
          children.push(...imageParasFromPhoto(photo));
        }
      }

      // General photos
      if (generalPhotosExist) {
        children.push(new Paragraph({
          spacing: { before: 160, after: 80 },
          children: [new TextRun({ text: '▶ 汎用写真', bold: true, size: 20, color: '444444' })],
        }));
        for (const photo of roundData.generalPhotos) {
          children.push(...imageParasFromPhoto(photo));
        }
      }
    }

    // ===== Section 3: Evaluation =====
    children.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: 'dddddd' } },
      spacing: { before: 300 },
      children: [],
    }));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 160 },
      children: [new TextRun({ text: '3. 総評', bold: true, size: 26 })],
    }));

    if (roundData.overallEvaluation.trim()) {
      const lines = roundData.overallEvaluation.split('\n');
      for (const line of lines) {
        children.push(new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: line, size: 22 })],
        }));
      }
    } else {
      children.push(new Paragraph({
        children: [new TextRun({ text: '（記載なし）', size: 22, color: 'AAAAAA' })],
      }));
    }

    // Footer
    children.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' } },
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '本報告書は感染対策ラウンドアプリにより自動生成されました', size: 16, color: 'aaaaaa' })],
    }));

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `感染対策ラウンド_${roundData.wardName || '報告書'}_${dateStr}.docx`;

    if (canShare) {
      const file = new File([blob], filename, { type: DOCX_MIME });
      try {
        await navigator.share({ title: '感染対策ラウンド報告書', text: `${roundData.inspectorName} - ${dateStr}`, files: [file] });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        saveAs(blob, filename);
      }
    } else {
      saveAs(blob, filename);
    }
  };

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
        <button
          onClick={handleExportDocx}
          className="btn-primary px-5 py-2.5 text-sm font-bold flex items-center gap-1.5"
        >
          {canShare ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          {canShare ? '共有' : 'Word出力'}
        </button>
      </div>

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
            <div className="space-y-2">
              {CHECKLIST_CATEGORIES.map((cat) => (
                <div key={cat.category} className="rounded-t overflow-hidden bg-base">
                  <div className="px-3 py-1.5 bg-base-deep">
                    <span className="text-xs font-bold text-text-muted">{cat.category}</span>
                  </div>
                  <div className="divide-y divide-line">
                    {cat.items.map((item) => {
                      const result = roundData.checklistResults.find((r) => r.itemId === item.id);
                      const rating = result?.rating;
                      return (
                        <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                          <p className="flex-1 text-xs text-text leading-relaxed">{item.description}</p>
                          <span
                            className="flex-shrink-0 w-8 h-8 rounded-t font-extrabold text-sm flex items-center justify-center"
                            style={
                              rating
                                ? { backgroundColor: RATING_HEX[rating] + '22', color: RATING_HEX[rating], border: `1.5px solid ${RATING_HEX[rating]}` }
                                : { backgroundColor: 'var(--t-base-deep)', color: 'var(--t-text-faint)' }
                            }
                          >
                            {rating ?? '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Photos */}
          {totalPhotos > 0 && (
            <div>
              <h2 className="text-sm font-extrabold text-text mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-primary text-white text-xs font-extrabold flex items-center justify-center" style={{ boxShadow: 'var(--t-btn-glow)' }}>2</span>
                写真記録
                <span className="text-xs font-normal text-text-muted">（{totalPhotos}枚）</span>
              </h2>
              <div className="space-y-3">
                {roundData.checklistResults.filter((r) => r.photos.length > 0).map((result) => {
                  const item = getItemById(result.itemId);
                  return result.photos.map((photo) => (
                    <div key={photo.id} className="rounded-t overflow-hidden bg-base">
                      <div className="px-3 py-1.5 bg-base-deep">
                        <span className="text-[10px] font-bold text-primary">{item?.category}：{item?.description.slice(0, 40)}{item && item.description.length > 40 ? '…' : ''}</span>
                      </div>
                      <img src={photo.dataUrl} alt="" className="w-full max-h-48 object-contain bg-surface" />
                      {photo.comment && <p className="px-3 py-2 text-sm text-text-muted">{photo.comment}</p>}
                    </div>
                  ));
                })}
                {roundData.generalPhotos.map((photo) => (
                  <div key={photo.id} className="rounded-t overflow-hidden bg-base">
                    <div className="px-3 py-1.5 bg-base-deep">
                      <span className="text-[10px] font-bold text-text-muted">汎用写真</span>
                    </div>
                    <img src={photo.dataUrl} alt="" className="w-full max-h-48 object-contain bg-surface" />
                    {photo.comment && <p className="px-3 py-2 text-sm text-text-muted">{photo.comment}</p>}
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

          {/* Footer */}
          <div className="pt-4 border-t border-line text-center">
            <p className="text-[11px] text-text-faint">本報告書は感染対策ラウンドアプリにより自動生成されました</p>
          </div>
        </div>
      </div>
    </div>
  );
}
