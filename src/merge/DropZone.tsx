import { useState } from 'react';

/** 報告書のドロップ領域とファイル選択ボタン */
export default function DropZone({ onFiles }: { onFiles: (files: FileList | null) => void }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
      className={`card p-8 text-center border-2 border-dashed transition-colors duration-200 ${
        dragging ? 'border-primary bg-primary-light' : 'border-line'
      }`}
    >
      <p className="text-sm font-bold text-text">ここに報告書の .docx ファイルをドラッグ&ドロップ</p>
      <p className="text-xs text-text-muted mt-1">または</p>
      <label className="btn-primary inline-block px-5 py-2.5 text-sm font-bold mt-3 cursor-pointer">
        ファイルを選ぶ
        <input
          type="file"
          multiple
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }}
        />
      </label>
      <p className="text-[11px] text-text-faint mt-4 leading-relaxed">
        めぐる君から共有された報告書（.docx）には、統合に必要なラウンドデータが入っています。受け取ったファイルをそのまま読み込んでください。<br />
        このページは読み込んだデータを保存しません。ページを再読み込みすると消えます。
      </p>
    </div>
  );
}
