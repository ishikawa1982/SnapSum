import type { BoundingBox } from '../types';
import { ocrEngine } from './ocr';
import { parseAmount } from './parseNumber';

export interface ReadResult {
  value: number;
  bbox: BoundingBox; // 元画像（表示画像）座標系での矩形
}

// タップ点の周囲だけを切り出して拡大し、その小領域だけを OCR する。
// 全体を読むのと違い、ノイズが入らず、文字も大きく拡大できるので精度が高い。
//
// fx, fy はタップ位置の画像内割合（0〜1）。img は表示中の <img> 要素。
export async function readAmountAt(
  img: HTMLImageElement,
  fx: number,
  fy: number,
): Promise<ReadResult | null> {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) return null;

  const cx = fx * W;
  const cy = fy * H;

  // タップ点を中心に、横は広め・縦は一行強の帯を切り出す。
  const bandW = Math.round(W * 0.55);
  const bandH = Math.max(70, Math.round(H * 0.06));
  const left = Math.max(0, Math.round(cx - bandW / 2));
  const top = Math.max(0, Math.round(cy - bandH / 2));
  const width = Math.min(W - left, bandW);
  const height = Math.min(H - top, bandH);

  // 文字が十分大きくなるよう拡大する
  const targetH = 150;
  const scale = targetH / height;
  const dw = Math.round(width * scale);
  const dh = targetH;

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, left, top, width, height, 0, 0, dw, dh);

  // グレースケール＋コントラスト伸長で読みやすく整える
  enhance(ctx, dw, dh);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) return null;

  const words = await ocrEngine.recognize(blob);

  // タップ点（切り出し画像内のローカル座標）に最も近い金額語を選ぶ
  const localTapX = (cx - left) * scale;
  const localTapY = (cy - top) * scale;

  let best: { value: number; bbox: BoundingBox; dist: number } | null = null;
  for (const w of words) {
    if (w.confidence < 30) continue;
    const parsed = parseAmount(w.text);
    if (!parsed || parsed.value <= 0) continue;

    const mx = (w.bbox.x0 + w.bbox.x1) / 2;
    const my = (w.bbox.y0 + w.bbox.y1) / 2;
    const dist = Math.hypot(mx - localTapX, my - localTapY);

    if (!best || dist < best.dist) {
      // 矩形を元画像座標へ戻す
      const bbox: BoundingBox = {
        x0: left + w.bbox.x0 / scale,
        y0: top + w.bbox.y0 / scale,
        x1: left + w.bbox.x1 / scale,
        y1: top + w.bbox.y1 / scale,
      };
      best = { value: parsed.value, bbox, dist };
    }
  }

  return best ? { value: best.value, bbox: best.bbox } : null;
}

// グレースケール化し、1〜99 パーセンタイルで線形にコントラストを伸長する。
function enhance(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const n = width * height;

  const gray = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const g =
      (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) | 0;
    gray[i] = g;
    hist[g]++;
  }

  const lo = percentile(hist, n, 0.01);
  const hi = percentile(hist, n, 0.99);
  const range = Math.max(1, hi - lo);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = ((v - lo) / range) * 255;

  for (let i = 0; i < n; i++) {
    const v = lut[gray[i]];
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
}

function percentile(hist: Uint32Array, total: number, p: number): number {
  const target = total * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 255;
}
