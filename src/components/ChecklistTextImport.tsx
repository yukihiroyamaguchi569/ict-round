import type { DraftCategory } from '../checklistEditor';
import type { useChecklistTextImport } from '../useChecklistTextImport';

interface Props {
  // Held by the editor, which also checks for pasted text not yet imported when it closes
  panel: ReturnType<typeof useChecklistTextImport>;
}

const TITLE = '表のテキストを貼り付けて読み込む';

/** How to get the text of a paper or Excel table onto the clipboard. Recognition is done by the OS, not the app. */
function TextImportGuide() {
  return (
    <div className="bg-base rounded-xl px-3 py-2.5 space-y-1.5 text-xs text-text-muted leading-relaxed">
      <p>紙のチェックリストや Excel の表を、文字のまま貼り付けて項目にできます。</p>
      <ul className="list-disc pl-4 space-y-1">
        <li>
          <span className="font-bold text-text">iPhone・iPad</span>：カメラで紙の表を写し、テキスト認識のボタンを押す →
          すべて選択 → コピー
        </li>
        <li>
          <span className="font-bold text-text">Android</span>：Google レンズで紙の表を写し、「テキスト」→ すべて選択 → コピー
        </li>
        <li>
          <span className="font-bold text-text">Excel・Word</span>：表の「カテゴリ」と「項目」の列を選んでコピー
        </li>
      </ul>
      <p className="text-[11px] text-text-faint">写真はこのアプリには送られません。貼り付けた文字だけを使います。</p>
    </div>
  );
}

function TextImportPreview({ categories, itemCount }: { categories: DraftCategory[]; itemCount: number }) {
  if (itemCount === 0) {
    return <p className="text-xs text-text-faint">貼り付けると、ここに振り分けの結果が出ます。</p>;
  }
  return (
    <div className="bg-base rounded-t px-3 py-2.5" aria-label="振り分けの結果" role="region">
      <p className="text-sm font-bold text-text">
        {categories.length}カテゴリ・{itemCount}項目
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {categories.map((cat) => (
          <li key={cat.key} className="text-xs">
            <p className="font-bold text-text">{cat.name || '（カテゴリ名なし）'}</p>
            <ul className="pl-3 text-text-muted space-y-0.5">
              {cat.items.map((item) => (
                <li key={item.key}>・{item.description}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Collapsible section of the checklist editor that turns pasted table text into categories and items. */
export default function ChecklistTextImport({ panel }: Props) {
  if (!panel.open) {
    return (
      <button
        type="button"
        onClick={panel.openPanel}
        aria-expanded={false}
        className="w-full py-2.5 text-xs font-bold text-primary border-2 border-dashed border-line rounded-t hover:border-primary transition-colors"
      >
        {TITLE}
      </button>
    );
  }

  return (
    <section aria-label={TITLE} className="card p-3 space-y-3">
      <h3 className="text-xs font-extrabold text-text">{TITLE}</h3>
      <TextImportGuide />
      <textarea
        value={panel.text}
        onChange={(e) => panel.setText(e.target.value)}
        aria-label="貼り付けるテキスト"
        placeholder="ここに貼り付け（貼り付けた後もここで直せます）"
        rows={6}
        className="w-full bg-base border-2 border-line rounded-t px-3 py-2 text-sm text-text placeholder:text-text-faint"
      />
      <p className="text-[11px] text-text-faint leading-relaxed">
        カテゴリと項目の振り分けが違うときは、上の欄で直してください。行頭に ■ を付けた行はカテゴリになります。入力済みの項目があれば、読み込んだ項目はその後ろに加わります。保存する前に直せます。
      </p>
      <TextImportPreview categories={panel.preview} itemCount={panel.itemCount} />
      <div className="flex gap-3">
        <button
          type="button"
          onClick={panel.close}
          className="flex-1 py-2.5 text-sm font-bold text-text-muted border-2 border-line rounded-t hover:bg-base transition-colors"
        >
          やめる
        </button>
        <button
          type="button"
          onClick={panel.handleImport}
          disabled={panel.itemCount === 0}
          className="flex-1 btn-primary py-2.5 text-sm font-bold disabled:opacity-40"
        >
          読み込む
        </button>
      </div>
    </section>
  );
}
