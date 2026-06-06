import type { BoundingBox } from '../types';

export interface ScaledRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

// 元画像のピクセル座標 bbox を、表示中の画像サイズに合わせた CSS 座標へ変換する。
//   表示X = bbox.x0 * (表示幅 / 元画像幅)
//   表示Y = bbox.y0 * (表示高さ / 元画像高さ)
export function scaleBox(
  bbox: BoundingBox,
  naturalWidth: number,
  naturalHeight: number,
  displayWidth: number,
  displayHeight: number,
): ScaledRect {
  const sx = naturalWidth > 0 ? displayWidth / naturalWidth : 1;
  const sy = naturalHeight > 0 ? displayHeight / naturalHeight : 1;

  return {
    left: bbox.x0 * sx,
    top: bbox.y0 * sy,
    width: (bbox.x1 - bbox.x0) * sx,
    height: (bbox.y1 - bbox.y0) * sy,
  };
}
