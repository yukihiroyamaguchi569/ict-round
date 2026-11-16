import type { SettingsError } from './facilitySettings';

/** "「部署」シートの 5 行目: …" when the error points at a row; the message alone otherwise. */
function describeError(error: SettingsError): string {
  if (error.sheet !== undefined && error.row !== undefined) {
    return `「${error.sheet}」シートの ${error.row} 行目: ${error.message}`;
  }
  return error.message;
}

/** Errors found in the chosen file. The saved settings, if any, are left as they were. */
export default function SettingsErrorList({ errors, hasSaved }: { errors: SettingsError[]; hasSaved: boolean }) {
  return (
    <div role="alert" className="card p-4 border border-danger">
      <p className="text-xs font-extrabold text-danger mb-1.5">
        読み込めませんでした（{errors.length} 件）。ファイルを直して、もう一度選んでください
      </p>
      <ul className="text-xs text-text space-y-1 leading-relaxed">
        {errors.map((e, i) => (
          // Two errors can share the same text (e.g. the same message on one row), so the index is part of the key.
          <li key={`${i}-${describeError(e)}`}>・{describeError(e)}</li>
        ))}
      </ul>
      {hasSaved && <p className="text-[11px] text-text-muted mt-2">保存している設定は変わっていません。</p>}
    </div>
  );
}
