import { useState, useRef } from 'react';
import type { SavedChecklist, ChecklistCategory } from '../types';
import { parseCsv, parseXlsx } from '../checklistImport';

interface Props {
  onSave: (checklist: SavedChecklist) => void;
  onCancel: () => void;
}

export default function ChecklistImportDialog({ onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<ChecklistCategory[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setPreview(null);
    setLoading(true);
    setFileName(file.name);

    try {
      let categories: ChecklistCategory[];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buf = await file.arrayBuffer();
        categories = await parseXlsx(buf);
      } else {
        const text = await file.text();
        categories = parseCsv(text);
      }
      setPreview(categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!preview) return;
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const useName = name.trim() || fileName.replace(/\.[^.]+$/, '') || '取込チェックリスト';
    onSave({
      id,
      name: useName,
      createdAt: new Date().toISOString(),
      categories: preview,
    });
  };

  const totalItems = preview?.reduce((sum, cat) => sum + cat.items.length, 0) ?? 0;
  const templateUrl = `${import.meta.env.BASE_URL}round-checklist-template.xlsx`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-text/40 backdrop-blur-sm">
      <div className="bg-surface w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <h2 className="text-sm font-extrabold text-text">チェックリストを取り込む</h2>
          <button type="button" onClick={onCancel} className="text-text-muted hover:text-text">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Method 1 */}
          <div className="bg-base rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold text-white flex-shrink-0" style={{ backgroundColor: 'var(--t-primary)' }}>1</span>
              <p className="text-xs font-extrabold text-text">PCで作ったファイルを使う</p>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              PCでExcel（.xlsx）またはCSVを作成し、メール・AirDrop・クラウドなどでこの端末に送ってください。
            </p>
            <div className="overflow-x-auto">
              <p className="text-[10px] text-text-faint mb-1">ファイル形式：A列＝カテゴリ名、B列＝点検項目（見出し行は不要）</p>
              <table className="w-full border-collapse text-left text-[10px]">
                <tbody>
                  <tr>
                    <td className="border border-line px-2 py-1 text-text-muted">手指衛生</td>
                    <td className="border border-line px-2 py-1 text-text-muted">手指消毒剤が各ベッドサイドに配置されている</td>
                  </tr>
                  <tr>
                    <td className="border border-line px-2 py-1 text-text-muted">手指衛生</td>
                    <td className="border border-line px-2 py-1 text-text-muted">アルコール手指消毒の5つのタイミングが掲示されている</td>
                  </tr>
                  <tr>
                    <td className="border border-line px-2 py-1 text-text-muted">個人防護具</td>
                    <td className="border border-line px-2 py-1 text-text-muted">使い捨て手袋が適切に廃棄されている</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Method 2 */}
          <div className="bg-base rounded-xl px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-extrabold text-white flex-shrink-0" style={{ backgroundColor: 'var(--t-primary)' }}>2</span>
              <p className="text-xs font-extrabold text-text">テンプレートを修正して使う</p>
            </div>
            <p className="text-xs text-text-muted leading-relaxed">
              テンプレートをダウンロードし、この端末のExcel・Numbersなどで項目を編集してください。編集後、下のファイル選択から取り込めます。
            </p>
            <a
              href={templateUrl}
              download="round-checklist-template.xlsx"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border-2 border-line hover:border-primary hover:text-primary text-text-muted transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              テンプレートをダウンロード
            </a>
          </div>

          {/* Common: name + file picker */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">
                名前<span className="text-text-faint font-normal ml-1">（空欄ならファイル名を使用）</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 3階東病棟専用"
                className="w-full bg-base border-2 border-line rounded-t px-3 py-2.5 text-sm text-text placeholder:text-text-faint"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-muted mb-1.5">ファイルを選択</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-line rounded-t py-4 text-sm text-text-muted hover:border-primary hover:text-primary transition-colors"
              >
                {fileName ? (
                  <span className="font-bold text-text">{fileName}</span>
                ) : (
                  'タップしてファイルを選択 (.csv / .xlsx)'
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFile}
                className="hidden"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 font-bold bg-red-50 px-3 py-2 rounded">{error}</p>
          )}

          {/* Loading */}
          {loading && (
            <p className="text-xs text-text-muted text-center py-2">読み込み中...</p>
          )}

          {/* Preview */}
          {preview && (
            <div className="bg-base rounded-t px-3 py-2.5">
              <p className="text-xs font-bold text-text-muted mb-1">プレビュー</p>
              <p className="text-sm font-bold text-text">
                {preview.length}カテゴリ・{totalItems}項目
              </p>
              <ul className="mt-1 space-y-0.5">
                {preview.map((cat) => (
                  <li key={cat.category} className="text-xs text-text-muted">
                    {cat.category}（{cat.items.length}項目）
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex gap-3 flex-shrink-0 border-t border-line">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 text-sm font-bold text-text-muted border-2 border-line rounded-t hover:bg-base transition-colors"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!preview}
            className="flex-1 btn-primary py-3 text-sm font-bold disabled:opacity-40"
          >
            保存して適用
          </button>
        </div>
      </div>
    </div>
  );
}
