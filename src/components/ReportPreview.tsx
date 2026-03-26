import { useRef } from 'react';
import type { RoundData } from '../types';

interface Props {
  roundData: RoundData;
  onBack: () => void;
}

export default function ReportPreview({ roundData, onBack }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = () => {
    if (!reportRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('ポップアップがブロックされました。ポップアップを許可してください。');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>感染対策ラウンド報告書</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; color: #333; }
          .header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { text-align: center; font-size: 20px; margin-bottom: 12px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 13px; color: #555; }
          .meta span { font-weight: 600; color: #333; }
          .checkpoint { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; margin-bottom: 20px; break-inside: avoid; }
          .checkpoint-header { background: #f3f4f6; padding: 8px 12px; display: flex; align-items: center; gap: 8px; }
          .num { background: #2563eb; color: white; font-size: 12px; font-weight: bold; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
          .location { font-weight: 600; }
          .time { margin-left: auto; font-size: 11px; color: #999; }
          .checkpoint-body { padding: 12px; }
          .checkpoint-body img { max-width: 100%; max-height: 300px; object-fit: contain; border-radius: 6px; margin-bottom: 8px; }
          .comment { background: #f9fafb; border-radius: 6px; padding: 10px; font-size: 13px; white-space: pre-wrap; }
          .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #aaa; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>感染対策ラウンド報告書</h1>
          <div class="meta">
            <div><span>担当者:</span> ${escapeHtml(roundData.inspectorName)}</div>
            <div><span>実施日時:</span> ${escapeHtml(roundData.startTime)}</div>
            <div><span>確認箇所数:</span> ${roundData.checkpoints.length}件</div>
          </div>
        </div>
        ${roundData.checkpoints.map((cp, i) => `
          <div class="checkpoint">
            <div class="checkpoint-header">
              <div class="num">${i + 1}</div>
              <div class="location">${escapeHtml(cp.location)}</div>
              <div class="time">${escapeHtml(cp.timestamp)}</div>
            </div>
            <div class="checkpoint-body">
              <img src="${cp.photoDataUrl}" alt="${escapeHtml(cp.location)}">
              ${cp.comment ? `<div class="comment">${escapeHtml(cp.comment)}</div>` : ''}
            </div>
          </div>
        `).join('')}
        <div class="footer">本報告書は感染対策ラウンドアプリにより自動生成されました</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
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
        <button
          onClick={handleExportPdf}
          className="bg-green-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PDF出力
        </button>
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

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
