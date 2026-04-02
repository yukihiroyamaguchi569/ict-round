import { useRef, useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, BorderStyle, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import type { RoundData } from '../types';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

interface Props {
  roundData: RoundData;
  onBack: () => void;
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
    const children: Paragraph[] = [];

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: '感染対策ラウンド報告書', bold: true, size: 32 })],
    }));

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

    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0C6B8A' } },
      spacing: { after: 300 },
      children: [],
    }));

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

      if (cp.comment) {
        children.push(new Paragraph({
          spacing: { after: 200 },
          children: [new TextRun({ text: cp.comment, size: 22 })],
        }));
      }
    }

    children.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'dddddd' } },
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '本報告書は感染対策ラウンドアプリにより自動生成されました', size: 16, color: 'aaaaaa' })],
    }));

    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `感染対策ラウンド_${dateStr}.docx`;

    if (canShare) {
      const file = new File([blob], filename, { type: DOCX_MIME });
      try {
        await navigator.share({
          title: '感染対策ラウンド報告書',
          text: `${roundData.inspectorName} - ${dateStr}`,
          files: [file],
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        saveAs(blob, filename);
      }
    } else {
      saveAs(blob, filename);
    }
  };

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

      {/* Report */}
      <div className="animate-page px-5 py-5">
        <div ref={reportRef} className="card p-5 max-w-2xl mx-auto">
          {/* Title */}
          <div className="text-center pb-4 mb-5">
            <h1 className="text-lg font-extrabold text-text">感染対策ラウンド報告書</h1>
            <div className="w-12 h-1 bg-primary rounded-full mx-auto mt-3" />
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2.5 mb-6">
            <div className="bg-base rounded-t px-4 py-3">
              <p className="text-[10px] text-text-faint font-bold uppercase tracking-wider">担当者</p>
              <p className="text-sm font-bold text-text mt-0.5">{roundData.inspectorName}</p>
            </div>
            <div className="bg-base rounded-t px-4 py-3">
              <p className="text-[10px] text-text-faint font-bold uppercase tracking-wider">実施日時</p>
              <p className="text-sm font-bold text-text mt-0.5">{roundData.startTime}</p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="flex-1 h-px bg-line" />
            <span className="text-xs font-bold text-primary bg-primary-light px-3 py-1 rounded-full">{roundData.checkpoints.length} 箇所を確認</span>
            <div className="flex-1 h-px bg-line" />
          </div>

          {/* Checkpoints */}
          <div className="space-y-4 stagger">
            {roundData.checkpoints.map((cp, index) => (
              <div key={cp.id} className="rounded-t bg-base overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-primary text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0" style={{ boxShadow: 'var(--t-btn-glow)' }}>
                    {index + 1}
                  </span>
                  <span className="font-bold text-sm text-text truncate">{cp.location}</span>
                  <span className="text-[11px] text-text-faint ml-auto flex-shrink-0">{cp.timestamp}</span>
                </div>
                {/* Content */}
                <div className="px-4 pb-4">
                  <img
                    src={cp.photoDataUrl}
                    alt={cp.location}
                    className="w-full max-h-64 object-contain rounded-t bg-surface"
                  />
                  {cp.comment && (
                    <div className="mt-2.5 bg-surface rounded-t px-4 py-3">
                      <p className="text-sm text-text-muted whitespace-pre-wrap leading-relaxed">{cp.comment}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-line text-center">
            <p className="text-[11px] text-text-faint">本報告書は感染対策ラウンドアプリにより自動生成されました</p>
          </div>
        </div>
      </div>
    </div>
  );
}
