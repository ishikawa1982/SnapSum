# SnapSum

> 撮る、足す。

写真を撮り、写り込んだ数字を抽出し、タップした数字の合計を計算する Web アプリです。
複数レシートの金額を撮って足し合わせ、合計金額を算出する用途を想定しています。

**Snap（撮る）→ 数字を抽出 → Tap（タップ）→ Sum（合計）** を最短の操作で完結させます。

## 特長

- 📷 カメラ撮影 / 端末の画像選択から取り込み
- 👆 写真上で**読みたい金額をタップ**すると、その周辺だけを切り出して拡大 OCR し、その数字だけを読み取り
- 🧮 タップした数字を選択して**合計をリアルタイム更新**
- 🧾 複数画像を追加して合算（複数レシート対応）
- ✎ 手動追加・誤認識の編集
- 🔒 **画像は端末の外に送信されません**（OCR は完全クライアント実行）
- 📱 PWA としてホーム追加・オフライン起動が可能

> **読み取り方式**: 画像全体を OCR すると、レシートでは登録番号・日付・電話番号などのノイズを拾いやすく精度が安定しない。本アプリは「タップした点の周辺だけ」を切り出して拡大し、その小領域のみを OCR することで、狙った金額を高精度に読み取る。

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
│   └── ManualAddModal.tsx  手動入力モーダル
└── lib/
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
