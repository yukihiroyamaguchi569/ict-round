interface Props {
  value: string;
  onChange: (text: string) => void;
}

export default function EvaluationTab({ value, onChange }: Props) {
  const insertBullet = () => {
    const bullet = value ? '\n・' : '・';
    onChange(value + bullet);
  };

  return (
    <div className="px-4 py-4 pb-6">
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-bold text-text-muted">総評</label>
          <button
            type="button"
            onClick={insertBullet}
            className="h-8 px-3 rounded-t bg-base-deep text-text-muted text-sm font-bold hover:bg-primary-light hover:text-primary transition-colors duration-150"
            aria-label="箇条書きを挿入"
          >
            ・ 箇条書き
          </button>
        </div>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={'・全体的な感染対策の遵守状況は良好でした。\n・手指衛生の実施率が向上しており、改善が見られます。\n・PPEの適切な使用について再教育が必要です。\n・次回ラウンドまでに○○の改善を依頼します。\n・継続的な取り組みへの感謝を伝えました。'}
          rows={10}
          className="w-full bg-base border-2 border-line rounded-t px-4 py-3 text-base text-text placeholder:text-text-faint transition-all duration-200 resize-none leading-relaxed"
        />

        <div className="flex justify-end mt-2">
          <span className="text-xs text-text-faint">{value.length} 文字</span>
        </div>
      </div>

      {!value && (
        <p className="text-xs text-text-faint text-center mt-4 leading-relaxed">
          ラウンド終了後、全体の総評を入力してください。<br />箇条書きで5文程度が目安です。
        </p>
      )}
    </div>
  );
}
