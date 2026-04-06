# ICN感染対策ラウンドアプリ

病院の感染対策ラウンドを、スマートフォンやタブレットでそのまま記録するための React + TypeScript 製 Web アプリです。担当者名と病棟名を入力してラウンドを開始し、チェックリスト評価、写真記録、総評入力を行い、最後に Word 形式の報告書として保存または共有できます。

## 主な機能

- ラウンド開始時に担当者名、病棟名、開始日時を記録
- カテゴリ別チェックリストに対して A〜C 評価を入力
- 各チェック項目に紐づく写真を追加（カメラ撮影またはデバイス内の既存写真から選択）
- 項目に紐づかない汎用写真を追加
- 総評で日本語音声入力を利用可能
- チェック、写真、総評をタブで切り替えて入力
- レポートプレビューで内容を確認
- Word (`.docx`) ファイルとして保存、対応端末では共有
- 3種類のテーマ切り替えを保持

## 現在の画面構成

1. ラウンド開始画面
2. メイン画面
3. チェックタブ
4. 写真タブ
5. 総評タブ
6. レポートプレビュー画面

## レポート内容

生成される報告書には次の内容が含まれます。

- 担当者名
- 病棟名
- 実施日時
- チェックリスト評価一覧
- 写真記録（項目紐付き・汎用）
- 総評

出力形式は PDF ではなく `.docx` です。

## 技術スタック

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- `docx`
- `file-saver`

## セットアップ

### 前提

- Node.js
- npm

### インストール

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

表示されたローカル URL をブラウザで開いて利用します。

## 利用手順

1. 担当者名を入力し、必要なら病棟名も入力してラウンドを開始します。
2. チェックタブで各項目を A〜C で評価します。
3. 写真タブから写真を追加します。カメラ撮影のほか、デバイス内の既存写真も選択できます。
4. 写真追加後は自動的に写真タブのトップに戻ります。
5. 総評タブで総評を入力します。必要に応じて音声入力を使います。
6. レポートボタンから内容を確認します。
7. Word ボタンまたは共有ボタンで報告書を保存します。

## 利用可能なスクリプト

- `npm run dev` : 開発サーバーを起動
- `npm run build` : TypeScript チェックと本番ビルドを実行
- `npm run preview` : ビルド結果をローカル確認
- `npm run lint` : ESLint を実行

## 実装上の注意

- アプリはクライアント完結で動作し、バックエンドはありません。
- ラウンドデータは React state のみで保持され、ページ再読み込み後には残りません。
- テーマ設定のみ `localStorage` に保存されます。
- 総評の音声入力は `SpeechRecognition` / `webkitSpeechRecognition` に依存するため、ブラウザによっては利用できません。
- 画像は 10MB 以下のみ登録できます。
- 画像はブラウザ内で圧縮後、データ URL として保持されます。
- GitHub Pages 配信では相対パスでアセットを参照する設定です。

## 推奨利用環境

- iPhone / iPad Safari などのモバイルブラウザ
- カメラ撮影と共有が利用できる端末

## GitHub Pages 公開

このアプリは GitHub Pages 向けに設定されています。

- 公開想定 URL: `https://yukihiroyamaguchi569.github.io/ict-round/`
- デプロイ先 URL: `https://ict-round.conect.llc/`
- Vite の `base` は `vite.config.ts` で `./` に設定済み
- GitHub Actions のデプロイ設定は `.github/workflows/deploy.yml` にあります
- `main` ブランチへ push すると GitHub Pages へ自動デプロイされます

### 反映方法

1. ローカルで修正します。
2. 必要に応じて `npm run build` でビルド確認します。
3. 変更を `main` ブランチへ commit / push します。
4. GitHub Actions の `Deploy to GitHub Pages` が実行されます。
5. 完了後、GitHub Pages 側に最新版が反映されます。

### 初回設定の確認項目

- GitHub リポジトリの `Settings > Pages` で `GitHub Actions` を使用する設定にする
- 公開先リポジトリ名が `ict-round` であることを確認する
- リポジトリ名を変更した場合は `vite.config.ts` の `base` も合わせて変更する

## 関連ドキュメント

- `CLAUDE.md` : コード探索と作業方針
- `docs/plan.md` : 初期計画メモ
- `docs/review.md` : レビュー記録
- `docs/handoff-implementer.md` : 実装引き継ぎメモ
- `docs/reference/round-checklist.xlsx` : チェックリスト原本
- `docs/assets/distribution-qr.png` : 配布用QRコード
