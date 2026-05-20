# ICTラウンドアプリ「めぐる君」 技術仕様書

**文書番号:** ICT-TS-001  
**対象者:** 情報システム部門・委員会担当者  
**作成日:** 2026年4月18日

---

## 1. システム概要

| 項目 | 内容 |
|------|------|
| システム名 | ICTラウンドアプリ「めぐる君」 |
| 種別 | クライアントサイド Web アプリケーション / PWA |
| 目的 | 感染対策ラウンドの記録、保存、報告書作成の効率化 |
| 利用者 | ICT メンバー、感染対策ラウンド実施者 |
| 配布形態 | 静的ファイル配信 |
| データ保管先 | ブラウザメモリおよび `localStorage` |

---

## 2. アーキテクチャ

### 2.1 構成

```text
[利用者端末]
  ├── Webブラウザ
  │     ├── React アプリ
  │     ├── Service Worker
  │     ├── localStorage
  │     └── Web APIs
  │          ├── File API
  │          ├── Canvas API
  │          ├── Web Share API
  │          └── SpeechRecognition
  │
  └── 静的ファイル配信サーバー
```

### 2.2 バックエンド

- バックエンドサーバー: なし
- データベース: なし
- 認証基盤: なし
- 外部業務 API: なし

### 2.3 主要技術スタック

| 分類 | 技術 | 実装上のバージョン |
|------|------|-------------------|
| フレームワーク | React | `^19.2.4` |
| 言語 | TypeScript | `~5.9.3` |
| ビルドツール | Vite | `^8.0.1` |
| CSS | Tailwind CSS | `^4.2.2` |
| Word 生成 | `docx` | `^9.6.1` |
| ファイル保存 | `file-saver` | `^2.0.5` |
| チェックリスト読込 | `xlsx` | `^0.18.5` |

---

## 3. 画面構成

### 3.1 画面一覧

1. ラウンド開始画面
2. 保存済みラウンド一覧画面
3. メイン画面
4. 写真追加画面
5. レポートプレビュー画面

### 3.2 メイン画面のタブ

- `チェック`
- `写真`
- `総評`

固定ヘッダーには以下を表示します。

- アプリアイコン
- 担当者名 / 病棟名
- 評価進捗
- 保存ボタン
- 外観設定ボタン

固定フッターには以下を表示します。

- タブ切替
- 写真枚数バッジ
- 総評入力済みバッジ
- レポートボタン

---

## 4. データモデル

### 4.1 チェックリスト定義

```ts
interface ChecklistItemDef {
  id: string;
  category: string;
  description: string;
}

interface ChecklistCategory {
  category: string;
  items: ChecklistItemDef[];
}

interface SavedChecklist {
  id: string;
  name: string;
  createdAt: string;
  isDefault?: boolean;
  categories: ChecklistCategory[];
}
```

### 4.2 ラウンドデータ

```ts
type Rating = 'A' | 'B' | 'C' | null;

interface Photo {
  id: string;
  dataUrl: string;
  comment: string;
  timestamp: string;
}

interface ChecklistItemResult {
  itemId: string;
  rating: Rating;
  photos: Photo[];
}

interface RoundData {
  inspectorName: string;
  wardName: string;
  startTime: string;
  checklistResults: ChecklistItemResult[];
  generalPhotos: Photo[];
  overallEvaluation: string;
  checklistName?: string;
}

interface SavedRound {
  id: string;
  title: string;
  savedAt: string;
  version: 1;
  checklistId: string;
  roundData: RoundData;
}
```

---

## 5. 永続化仕様

### 5.1 `localStorage` キー

| キー | 内容 |
|------|------|
| `icn-round:checklist-library` | 保存済みチェックリスト一覧 |
| `icn-round:active-checklist-id` | 選択中チェックリスト ID |
| `icn-round:saved-rounds` | 保存済みラウンド一覧 |
| `icn-round-theme` | テーマ設定 |
| `icn-round-icon` | アイコン設定 |

### 5.2 保存方針

- 入力中ラウンドは React state 上に保持
- `保存` 操作時のみ `SavedRound` を `localStorage` に保存
- チェックリストライブラリは追加 / 削除時に都度保存
- テーマ、アイコン、選択中チェックリストは変更時に保存

### 5.3 初期データ

初回起動時、`seedDefaultIfFirstRun()` により標準チェックリストを 1 件生成します。

- ID: `default`
- 名称: `標準チェックリスト`
- 内容: 9カテゴリ・22項目

---

## 6. 機能仕様

### 6.1 ラウンド開始

- 担当者名は必須
- 病棟名は任意
- 開始時刻は `new Date().toLocaleString('ja-JP')` で生成
- 選択中チェックリストに基づき `checklistResults` を初期化

### 6.2 チェックリスト評価

- 各項目に `A` `B` `C` `null` を設定
- 進捗は `rating !== null` の件数から算出
- カテゴリアコーディオンは先頭カテゴリのみ初期展開

### 6.3 チェックリスト取り込み

- 対応形式: `.csv` `.xls` `.xlsx`
- CSV は独自パーサで 2 列を解析
- Excel は `xlsx` ライブラリで先頭シートのみ読込
- 1 行目が `category` で始まる場合は見出し行としてスキップ
- 同一カテゴリ名は自動グルーピング
- 取り込み後は新規 `SavedChecklist` として保存

### 6.4 写真入力

- `<input type="file" accept="image/*">` を使用
- 10MB を超える画像は拒否
- `Canvas` で JPEG に再エンコード
- 圧縮条件:
  - 最大幅 `1200px`
  - 品質 `0.8`
- 保存形式: `dataUrl`
- 項目紐付き写真と汎用写真を区別して保持

### 6.5 総評入力

- プレーンテキスト入力
- 箇条書き記号挿入補助あり
- `SpeechRecognition` / `webkitSpeechRecognition` が利用可能な場合のみ音声入力対応
- 言語設定は `ja-JP`
- `continuous = true`
- `interimResults = true`

### 6.6 レポートプレビュー / 出力

- プレビュー画面ではチェック結果、写真、総評を HTML で表示
- 出力時は `docx` ライブラリで `.docx` を生成
- 共有可能端末では `navigator.share({ files })` を優先
- 共有非対応時は `file-saver` によりダウンロード
- ファイル名形式:
  - `感染対策ラウンド_<病棟名または報告書>_<YYYY-MM-DD>.docx`

### 6.7 外観設定

- テーマ 3 種:
  - `warm`
  - `minimal`
  - `medical`
- アイコン 2 種:
  - `ran`
  - `meguru`

---

## 7. 通信・オフライン

### 7.1 外部通信

| 通信先 | 用途 |
|--------|------|
| 配信元ホスト | HTML / JS / CSS / 画像配信 |
| `fonts.googleapis.com` | Google Fonts CSS |
| `fonts.gstatic.com` | Google Fonts 本体 |

### 7.2 Service Worker

`index.html` で `./sw.js` を登録します。

キャッシュ戦略は以下です。

- アプリシェル: インストール時に事前キャッシュ
- Google Fonts: Cache First
- ナビゲーション: Network First
- 同一オリジンの `/assets/`: Cache First
- その他の同一オリジン GET: Network First

### 7.3 オフライン動作

- 初回アクセス後は、キャッシュ済みアセット範囲で再訪可能
- ただし外部フォント未取得時は代替フォント表示となる可能性あり
- ラウンドデータ共有や同期の仕組みは持たない

---

## 8. セキュリティ・個人情報

### 8.1 取り扱うデータ

- 担当者名
- 病棟名
- チェック結果
- 写真
- 総評

### 8.2 外部送信

- ラウンド内容を外部 API へ送信する処理は実装していません
- ただしフォント取得と静的ファイル取得の通信は発生します

### 8.3 個人情報上の留意点

- 患者情報専用の入力欄はなし
- 写真に個人情報が写り込む運用リスクは残る
- 保存済みラウンドや写真は端末ブラウザの `localStorage` に残る

### 8.4 認証

- アプリ自身はログイン機能を持ちません
- アクセス制限が必要な場合は、配信環境側で制御します

---

## 9. ホスティング要件

### 9.1 配信条件

- 静的ファイル配信のみ
- サーバーサイドランタイム不要
- HTTPS 推奨

### 9.2 Vite 設定

- `base: './'`
- `__APP_VERSION__` を `package.json` から埋め込み
- `__BUILD_DATE__` を `MMDD` 形式で埋め込み

### 9.3 配置ファイル

- `index.html`
- `manifest.json`
- `sw.js`
- `assets/*`
- アイコン画像

---

## 10. ビルド・運用

### 10.1 コマンド

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

### 10.2 本番ビルド

- `tsc -b && vite build`
- 出力先: `dist/`

### 10.3 更新反映

- Service Worker の更新検知時は自動で再読み込みを試行
- 静的ファイル差し替えで更新可能

---

## 11. 既知の実装前提

- 保存済みデータは同一ブラウザ内でのみ利用可能
- `localStorage` 容量に依存するため、大量の高解像度写真保存には限界がある
- 音声入力とファイル共有はブラウザ実装差異の影響を受ける
- `.docx` のみ対応し、PDF 生成機能は未実装

---

## 12 ライセンス

Apache 2.0
