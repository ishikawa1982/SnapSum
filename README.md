# SnapSum

> 撮る、足す。

写真を撮り、写り込んだ数字を抽出し、タップした数字の合計を計算する Web アプリです。
複数レシートの金額を撮って足し合わせ、合計金額を算出する用途を想定しています。

**Snap（撮る）→ 数字を抽出 → Tap（タップ）→ Sum（合計）** を最短の操作で完結させます。

## 特長

- 📷 カメラ撮影 / 端末の画像選択から取り込み
- 🤖 **AIモード（任意）**: Anthropic の API キーを設定すると、撮影した写真を Claude が読み取り、**合計金額を自動検出**して積み上げる（高精度）
- 👆 **タップモード（既定）**: 写真上で読みたい金額をタップすると、その周辺だけを切り出して拡大 OCR し、その数字だけを読み取り（端末内で完結）
- 🧮 数字を選択して**合計をリアルタイム更新**
- 🧾 複数画像を追加して合算（複数レシート対応）
- ✎ 手動追加・誤認識の編集
- 📱 PWA としてホーム追加・オフライン起動が可能

### 2つの読み取り方式

| 方式 | 精度 | プライバシー | 必要なもの |
| --- | --- | --- | --- |
| **AIモード** | 高い（合計を自動検出） | 写真を Anthropic に送信 | 自分の Anthropic API キー（⚙️設定） |
| **タップモード** | 中（狙った数字をタップ） | **端末外に送信しない** | 不要（Tesseract.js） |

> 画像全体を端末内 OCR で読むと、レシートでは登録番号・日付などのノイズを拾いやすく合計の自動検出が難しい。精度が必要な場合は AI（Claude のビジョン）に画像を渡すのが確実。OCR 部分は `OcrEngine` インターフェースで抽象化してあり、こうした差し替えを前提にしている。API キーは端末のブラウザ内（localStorage）にのみ保存され、リポジトリやサーバーには保存しない。

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| フレームワーク | React + TypeScript |
| ビルド | Vite |
| スタイル | Tailwind CSS |
| OCR | Tesseract.js（クライアント実行・単語単位の bbox を取得） |
| 状態管理 | Zustand |
| PWA | vite-plugin-pwa |

OCR 部分は `OcrEngine` インターフェース（`src/lib/ocr.ts`）で抽象化しており、
将来 Google Cloud Vision 等へ差し替え可能です。

## 開発

```bash
npm install      # 依存関係をインストール
npm run dev      # 開発サーバを起動
npm test         # ユニットテスト（数字パース・座標変換）
npm run build    # 本番ビルド（型チェック + Vite ビルド）
npm run lint     # ESLint
```

PWA アイコンを再生成する場合:

```bash
node scripts/gen-icons.mjs
```

## プロジェクト構成

```
src/
├── App.tsx                 画面全体のレイアウト
├── types.ts                データモデル（DetectedNumber / CapturedImage 等）
├── components/
│   ├── Header.tsx          ロゴ・選択解除・リセット
│   ├── ImageList.tsx       取り込んだ画像を縦に並べる / 空状態
│   ├── ImageCard.tsx       画像 1 枚（写真 + 処理状態 + エラー/空表示）
│   ├── NumberOverlay.tsx   bbox を表示サイズにスケールして重ねる
│   ├── NumberChip.tsx      タップ可能な数字チップ
│   ├── ManualNumberList.tsx 手動追加した数字の一覧
│   ├── TotalBar.tsx        合計・選択件数（下部固定）
│   ├── ActionBar.tsx       写真追加 / 手動追加
│   ├── ManualAddModal.tsx  手動入力モーダル
│   └── SettingsModal.tsx   AI設定（APIキー・モデル）
└── lib/
    ├── aiOcr.ts            Anthropic Messages API を呼び、写真から合計を読み取る
    ├── settings.ts         APIキー・モデルの保存（localStorage）
    ├── ocr.ts              OcrEngine インターフェース + Tesseract 実装
    ├── tapread.ts          タップ点の周辺を切り出し→拡大→OCR→最寄りの金額を返す
    ├── parseNumber.ts      テキスト → 金額への正規化・誤読補正
    ├── geometry.ts         元画像座標 → 表示座標へのスケール変換
    ├── image.ts            取り込み画像のリサイズ（長辺 ~2000px）
    ├── format.ts           金額フォーマット
    └── store.ts            AppState（Zustand・合計の派生計算）
```

## 数字パースの方針

タップで読み取ったテキストを金額へ変換する際、全角→半角・通貨記号/桁区切りの除去・
字形の似た誤読（`O→0` `l→1` `S→5` `B→8` など）の補正を行います。電話番号・日付・時刻
らしきパターンは金額から除外します。最終的にどの数字を合計に含めるかは**ユーザーのタップ**に委ねます。
