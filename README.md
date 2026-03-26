# ICN感染対策ラウンドアプリ

病院の感染対策ラウンドを、スマートフォンやタブレットでそのまま記録するための React + TypeScript 製 Web アプリです。担当者名を入力してラウンドを開始し、各チェックポイントごとに写真・場所名・コメントを登録し、最後に報告書を確認して PDF 出力または共有できます。

## 主な機能

- ラウンド開始時に担当者名と開始日時を記録
- チェックポイントごとに場所名を入力
- カメラ撮影または画像選択で写真を登録
- Web Speech API を使った日本語の音声入力
- チェックポイント一覧の確認と削除
- レポートプレビュー表示
- 印刷画面経由の PDF 出力
- Web Share API を使った共有

## 技術スタック

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- `html2canvas`
- `jspdf`

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

ブラウザで表示されたローカル URL を開いて利用します。

## GitHub Pages 公開

このアプリは GitHub Pages 向けに設定されています。

- 公開想定 URL: `https://yukihiroyamaguchi569.github.io/ict-round/`
- Vite の `base` は [vite.config.ts](/Users/Yukis_MacBook/claude-code/harness-engeneering/vite.config.ts) で `/ict-round/` に設定済み
- GitHub Actions のデプロイ設定は [.github/workflows/deploy.yml](/Users/Yukis_MacBook/claude-code/harness-engeneering/.github/workflows/deploy.yml) にあります
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
- リポジトリ名を変更した場合は [vite.config.ts](/Users/Yukis_MacBook/claude-code/harness-engeneering/vite.config.ts) の `base` も合わせて変更する

## 利用手順

1. 担当者名を入力してラウンドを開始します。
2. 「追加」からチェックポイントを登録します。
3. 場所名を入力し、写真を撮影または選択します。
4. 必要に応じて音声入力または手入力でコメントを追加します。
5. 一覧画面で登録内容を確認し、不要な項目は削除します。
6. 「レポート作成」から報告書を確認し、共有または PDF 出力します。

## 利用可能なスクリプト

- `npm run dev` : 開発サーバーを起動
- `npm run build` : TypeScript チェックと本番ビルドを実行
- `npm run preview` : ビルド結果をローカル確認
- `npm run lint` : ESLint を実行

## 実装上の注意

- データはアプリ内の state のみで管理しており、ページ再読み込み後の永続化はありません。
- 音声入力は `SpeechRecognition` / `webkitSpeechRecognition` に依存するため、ブラウザによっては利用できません。
- 共有機能は `navigator.share` / `navigator.canShare` に依存します。未対応端末では PDF 出力を利用してください。
- PDF ボタンは印刷用ウィンドウを開いてブラウザの印刷機能を使います。ポップアップブロックが有効な場合は許可が必要です。
- 画像は 10MB 以下のみ登録できます。
- GitHub Pages 配信ではサブパス `/ict-round/` 配下で動作する前提です。

## 推奨利用環境

- iPhone / iPad Safari などのモバイルブラウザ
- 写真撮影と共有を行うため、カメラ権限が利用できる端末

## 関連ドキュメント

- `docs/plan.md` : 要件と実装計画
- `docs/review.md` : レビュー結果
- `docs/handoff-implementer.md` : 実装引き継ぎメモ
