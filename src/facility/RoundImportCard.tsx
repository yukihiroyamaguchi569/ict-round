import { importReportLines, type ImportOutcome } from './useRoundImport';
import type { MergeReport } from './mergeFacilityRounds';

interface Props {
  importing: boolean;
  outcome: ImportOutcome | null;
  onFile: (file: File) => void;
}

/** Choosing another device's report file to merge into this round, and what the last import did. */
export default function RoundImportCard({ importing, outcome, onFile }: Props) {
  return (
    <>
      <section aria-label="ほかの端末の記録を取り込む" className="card p-5 space-y-3">
        <h3 className="text-base font-extrabold text-text">ほかの端末の記録を取り込む</h3>
        <p className="text-sm text-text-muted">
          ほかの端末で書き出した帳票の Word を選ぶと、このラウンドに合わせます。○ と × が食い違ったマスは × になります。取り込みは取り消せません。
        </p>
        <label
          className={`btn-primary inline-block px-5 py-2.5 text-sm font-bold ${importing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {importing ? '取り込み中...' : 'Word のファイルを選ぶ'}
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onFile(file);
            }}
          />
        </label>
        <p className="text-xs text-text-faint">iPad では「ファイル」App から選べます。</p>
      </section>
      {outcome && <ImportOutcomeView outcome={outcome} />}
    </>
  );
}

function ImportOutcomeView({ outcome }: { outcome: ImportOutcome }) {
  if (outcome.kind === 'failed') {
    return (
      <p role="alert" className="card p-4 border border-danger text-sm font-bold text-danger">
        {outcome.message}
      </p>
    );
  }
  if (outcome.kind === 'unchanged') {
    return (
      <p role="status" className="card p-4 text-sm font-bold text-text">
        新しい内容はありませんでした。
      </p>
    );
  }
  return <ImportReport report={outcome.report} />;
}

function ImportReport({ report }: { report: MergeReport }) {
  const lines = importReportLines(report);
  return (
    <section role="status" aria-label="取り込みの結果" className="card p-5 space-y-2">
      <p className="text-sm font-extrabold text-text">取り込みました</p>
      {lines.length > 0 && (
        <ul className="list-disc pl-5 space-y-1 text-sm text-text break-words">
          {lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
