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

  // OCR 用: グレースケール＋コントラスト伸長。圧縮ノイズを避けるため PNG で渡す。
  preprocessForOcr(ctx, width, height);
  const ocrBlob = await canvasToBlob(canvas, 'image/png');

  return { ocrBlob, src, width, height };
}

// OCR 向けの前処理。
// グレースケール化し、明暗のパーセンタイルで線形にコントラストを伸長する。
//
// 以前は局所適応二値化をかけていたが、木目や紙のテクスチャなど低コントラストの
// 背景まで黒ノイズに増幅してしまい、誤検出（¥0 だらけ）の温床になっていた。
// 二値化は Tesseract が内部で行うため、ここでは「文字を読みやすく整える」までに留める。
function preprocessForOcr(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const n = width * height;

  // 1) グレースケール（輝度）＋ヒストグラム
  const gray = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const g =
      (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) | 0;
    gray[i] = g;
    hist[g]++;
  }

  // 2) 1〜99 パーセンタイルを黒〜白に割り当てる（外れ値に強いコントラスト伸長）
  const lo = percentile(hist, n, 0.01);
  const hi = percentile(hist, n, 0.99);
  const range = Math.max(1, hi - lo);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    lut[v] = ((v - lo) / range) * 255;
  }

  for (let i = 0; i < n; i++) {
    const v = lut[gray[i]];
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = v;
  }

  ctx.putImageData(image, 0, 0);
}

// 累積ヒストグラムから指定パーセンタイルの輝度値を求める
function percentile(hist: Uint32Array, total: number, p: number): number {
  const target = total * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
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
