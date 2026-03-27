import { useRef } from 'react';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import type { RoundData } from '../types';

interface Props {
  roundData: RoundData;
  onBack: () => void;
}

export default function ReportPreview({ roundData, onBack }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportDocx = async () => {
    const children: Paragraph[] = [];

    // Title
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: '感染対策ラウンド報告書', bold: true, size: 32 })],
    }));

    // Meta
    children.push(new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: '担当者: ', bold: true }),
        new TextRun(roundData.inspectorName),
        new TextRun('    '),
        new TextRun({ text: '実施日時: ', bold: true }),
        new TextRun(roundData.startTime),
      ],
    }));
    children.push(new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: '確認箇所数: ', bold: true }),
        new TextRun(`${roundData.checkpoints.length}件`),
      ],
    }));

    // Separator
    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2D6B5A' } },
      spacing: { after: 300 },
      children: [],
    }));

    // Checkpoints
    for (let i = 0; i < roundData.checkpoints.length; i++) {
      const cp = roundData.checkpoints[i];

      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({ text: `${i + 1}. ${cp.location}`, bold: true, size: 24 }),
          new TextRun({ text: `  ${cp.timestamp}`, size: 18, color: '999999' }),
        ],
      }));

      // Photo
      try {
        const base64 = cp.photoDataUrl.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j);
        }
        children.push(new Paragraph({
          spacing: { after: 100 },
          children: [new ImageRun({
            data: bytes,
            transformation: { width: 500, height: 375 },
            type: 'jpg',
          })],
        }));
      } catch {
        // skip image if conversion fails
      }

      // Comment
      if (cp.comment) {
        children.push(new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: cp.comment, size: 22 })],
        }));
      }
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
    saveAs(blob, `感染対策ラウンド_${dateStr}.docx`);
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cream/80 backdrop-blur-xl border-b border-border px-5 py-3 flex items-center justify-between">
        <button onClick={onBack} className="text-ink-muted text-sm font-medium hover:text-ink transition-colors duration-200 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <button
          onClick={handleExportDocx}
          className="bg-sage text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-sage-dark transition-all duration-200 active:scale-[0.98] flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Word出力
        </button>
      </div>

      {/* Report Content */}
      <div className="animate-page px-5 py-6">
        <div ref={reportRef} className="bg-surface rounded-2xl border border-border p-6 max-w-2xl mx-auto">
          {/* Report Header */}
          <div className="pb-5 mb-6 border-b border-border">
            <h1 className="text-lg font-semibold text-ink text-center tracking-tight">感染対策ラウンド報告書</h1>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-cream rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-ink-faint uppercase tracking-widest mb-0.5">担当者</p>
                <p className="text-sm font-medium text-ink">{roundData.inspectorName}</p>
              </div>
              <div className="bg-cream rounded-xl px-3 py-2.5">
                <p className="text-[10px] text-ink-faint uppercase tracking-widest mb-0.5">実施日時</p>
                <p className="text-sm font-medium text-ink">{roundData.startTime}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-muted">
              <span className="w-5 h-5 rounded-lg bg-sage text-white text-[10px] font-semibold flex items-center justify-center">{roundData.checkpoints.length}</span>
              <span>箇所を確認</span>
            </div>
          </div>

          {/* Checkpoints */}
          <div className="space-y-5 stagger-children">
            {roundData.checkpoints.map((cp, index) => (
              <div key={cp.id} className="rounded-xl border border-border overflow-hidden">
                {/* Checkpoint header */}
                <div className="px-4 py-2.5 flex items-center gap-2.5 bg-cream">
                  <span className="w-6 h-6 rounded-lg bg-sage text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="font-medium text-sm text-ink truncate">{cp.location}</span>
                  <span className="text-[11px] text-ink-faint ml-auto flex-shrink-0">{cp.timestamp}</span>
                </div>
                {/* Photo & comment */}
                <div className="p-3">
                  <img
                    src={cp.photoDataUrl}
                    alt={cp.location}
                    className="w-full max-h-72 object-contain rounded-xl bg-cream"
                  />
                  {cp.comment && (
                    <div className="mt-3 bg-cream rounded-xl px-3.5 py-2.5">
                      <p className="text-sm text-ink-muted whitespace-pre-wrap leading-relaxed">{cp.comment}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-border text-center">
            <p className="text-[11px] text-ink-faint font-light">本報告書は感染対策ラウンドアプリにより自動生成されました</p>
          </div>
        </div>
      </div>
    </div>
  );
}
