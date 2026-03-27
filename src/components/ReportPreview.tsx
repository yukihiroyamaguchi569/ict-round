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
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2563eb' } },
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
        <button onClick={onBack} className="text-blue-600 font-medium flex items-center gap-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleExportDocx}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Word
          </button>
        </div>
      </div>

      {/* Report Content */}
      <div className="p-4">
        <div ref={reportRef} className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto">
          {/* Report Header */}
          <div className="border-b-2 border-blue-600 pb-4 mb-6">
            <h1 className="text-xl font-bold text-gray-800 text-center">感染対策ラウンド報告書</h1>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>
                <span className="font-medium">担当者:</span> {roundData.inspectorName}
              </div>
              <div>
                <span className="font-medium">実施日時:</span> {roundData.startTime}
              </div>
              <div>
                <span className="font-medium">確認箇所数:</span> {roundData.checkpoints.length}件
              </div>
            </div>
          </div>

          {/* Checkpoints */}
          <div className="space-y-6">
            {roundData.checkpoints.map((cp, index) => (
              <div key={cp.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 flex items-center gap-2">
                  <span className="bg-blue-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="font-medium text-gray-800">{cp.location}</span>
                  <span className="text-xs text-gray-400 ml-auto">{cp.timestamp}</span>
                </div>
                <div className="p-4">
                  <img
                    src={cp.photoDataUrl}
                    alt={cp.location}
                    className="w-full max-h-80 object-contain rounded-lg mb-3"
                  />
                  {cp.comment && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{cp.comment}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
            <p>本報告書は感染対策ラウンドアプリにより自動生成されました</p>
          </div>
        </div>
      </div>
    </div>
  );
}
