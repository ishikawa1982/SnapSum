// 画像内の矩形座標（元画像のピクセル座標系）
export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// OCR の生結果から生成する、画面上の 1 つの数字
export interface DetectedNumber {
  id: string; // 一意 ID
  imageId: string; // どの画像由来か（複数レシート対応）
  rawText: string; // OCR の生テキスト 例: "1,280円"
  value: number; // 数値化した金額 例: 1280
  bbox: BoundingBox; // 画像内の座標（オーバーレイ描画用）
  confidence: number; // OCR 信頼度 0〜100
  selected: boolean; // タップで選択中か
  isManual: boolean; // 手動追加・編集されたものか
  excluded: boolean; // 自動判定で金額候補から除外された（グレー表示で救済可能）
}

export interface CapturedImage {
  id: string;
  src: string; // object URL / dataURL
  width: number;
  height: number;
  numbers: DetectedNumber[];
  status: 'processing' | 'done' | 'error';
}
