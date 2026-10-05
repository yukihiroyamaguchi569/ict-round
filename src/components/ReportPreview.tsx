import { useTheme } from '../ThemeContext';
import type { RoundData, ChecklistCategory } from '../types';
import { useReportFile } from '../useReportFile';
import { ReportExportButton, ReportExportNotices } from './ReportExport';
import ReportDocument from './ReportDocument';

interface Props {
  roundData: RoundData;
  categories: ChecklistCategory[];
  onBack: () => void;
}

export default function ReportPreview({ roundData, categories, onBack }: Props) {
  const { theme } = useTheme();
  const file = useReportFile(roundData, categories);

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
        <ReportExportButton file={file} />
      </div>

      <ReportExportNotices buildError={file.buildError} shareFailed={file.shareFailed} />

      {/* Report preview */}
      <div className="animate-page px-4 py-5 pb-10">
        <ReportDocument roundData={roundData} categories={categories} />

        {/* 共有した .docx の使い道を、送った直後の文脈で案内する */}
        <div className="max-w-2xl mx-auto mt-5 px-1">
          <p className="text-xs text-text-muted leading-relaxed">
            複数部署のレポートを1本にまとめるには、PCで
            <a
              href="./merge.html"
              target="_blank"
              rel="noopener"
              className="font-bold text-primary hover:underline mx-1"
            >
              統合ページ
            </a>
            を開き、各担当者から集めた <code className="font-bold">.docx</code> を読み込んでください。統合に必要なデータはこの報告書の中に入っています。
          </p>
        </div>
      </div>
    </div>
  );
}
