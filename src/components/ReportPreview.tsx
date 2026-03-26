import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { RoundData } from '../types';

interface Props {
  roundData: RoundData;
  onBack: () => void;
}

export default function ReportPreview({ roundData, onBack }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    if (!reportRef.current || isExporting) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`感染対策ラウンド_${dateStr}.pdf`);
    } catch {
      alert('PDF出力に失敗しました。もう一度お試しください。');
    } finally {
      setIsExporting(false);
    }
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
          disabled={isExporting}
          className="bg-green-600 text-white rounded-lg px-4 py-2 font-medium hover:bg-green-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {isExporting ? '出力中...' : 'PDF出力'}
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
