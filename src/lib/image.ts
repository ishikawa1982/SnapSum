export interface PreparedImage {
  ocrBlob: Blob; // OCR に渡す前処理済み（グレースケール＋二値化）画像
  src: string; // プレビュー表示用 object URL（カラー）
  width: number; // リサイズ後の幅（= OCR 座標系の基準）
  height: number; // リサイズ後の高さ
}

// 非機能要件: 取り込み画像は長辺 1,500〜2,000px 程度にリサイズしてから OCR にかける。
// 表示用（カラー）と OCR 用（前処理済み）を同じ寸法で作ることで、
// OCR が返す bbox 座標系と表示画像のスケールを一致させる。
const MAX_LONG_EDGE = 2000;

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const { width: ow, height: oh } = bitmap;

  const longEdge = Math.max(ow, oh);
  // 小さすぎる画像は OCR 精度が落ちるため最低 1000px 程度まで拡大する
  const scale =
    longEdge > MAX_LONG_EDGE
      ? MAX_LONG_EDGE / longEdge
      : longEdge < 1000
        ? 1000 / longEdge
        : 1;
  const width = Math.round(ow * scale);
  const height = Math.round(oh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D コンテキストを取得できませんでした');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 表示用カラー画像（JPEG で軽量に）
  const src = URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg'));

  // OCR 用: グレースケール → 適応的二値化（影・かすれに強い）。二値画像は PNG で劣化なく。
  preprocessForOcr(ctx, width, height);
  const ocrBlob = await canvasToBlob(canvas, 'image/png');

  return { ocrBlob, src, width, height };
}

// レシート OCR 向けの前処理。
// グレースケール化したのち、局所平均との差で二値化（adaptive mean threshold）する。
// 大域的な閾値（Otsu）と違い、影や照明ムラのある写真でも文字を残しやすい。
function preprocessForOcr(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const n = width * height;

  // 1) グレースケール（輝度）
  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }

  // 2) 積分画像（summed-area table）で局所平均を高速計算
  const iw = width + 1;
  const integral = new Float64Array(iw * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    for (let x = 1; x <= width; x++) {
      rowSum += gray[(y - 1) * width + (x - 1)];
      integral[y * iw + x] = integral[(y - 1) * iw + x] + rowSum;
    }
  }

  // 3) 適応的二値化
  // 窓は文字高に対して十分大きく取り、C は背景ノイズを黒に落とさない程度に。
  const radius = Math.max(8, Math.round(Math.min(width, height) / 40));
  const C = 8; // 平均からこの値以上暗ければ「文字（黒）」
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum =
        integral[y1 * iw + x1] -
        integral[y0 * iw + x1] -
        integral[y1 * iw + x0] +
        integral[y0 * iw + x0];
      const mean = sum / area;
      const v = gray[y * width + x] < mean - C ? 0 : 255;
      const o = (y * width + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = v;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: 'image/jpeg' | 'image/png',
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('画像の変換に失敗しました'));
      },
      type,
      type === 'image/jpeg' ? 0.92 : undefined,
    );
  });
}
