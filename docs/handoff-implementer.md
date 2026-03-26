# Implementer 引き継ぎ書

## 実装済み内容

### プロジェクト構成
- **Vite + React + TypeScript** で初期化
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **jsPDF + html2canvas** でPDF出力

### ファイル一覧
| ファイル | 役割 |
|---|---|
| `src/types.ts` | `Checkpoint`, `RoundData` 型定義 |
| `src/speech.d.ts` | Web Speech API 型宣言 |
| `src/App.tsx` | 画面遷移とstate管理（start / list / add / report） |
| `src/components/RoundStart.tsx` | ラウンド開始画面（担当者名入力） |
| `src/components/CheckpointForm.tsx` | チェックポイント追加（写真・音声・場所名） |
| `src/components/CheckpointList.tsx` | 一覧表示・削除・レポート遷移 |
| `src/components/ReportPreview.tsx` | レポートプレビュー＋PDF出力 |

### 画面遷移
```
RoundStart → CheckpointList ⇄ CheckpointForm → ReportPreview → PDF
```

### 技術的な判断
- **localStorage未使用**: セッション中のstateのみ（plan通り）
- **音声入力**: `webkitSpeechRecognition` を使用、`ja-JP`設定
- **写真**: `<input type="file" accept="image/*" capture="environment">`
- **PDF**: html2canvas でレポート全体をキャプチャ → jsPDF で複数ページ対応

### ビルド状態
- `npm run build` — 成功（warning: chunk > 500KB は html2canvas 由来、許容範囲）
