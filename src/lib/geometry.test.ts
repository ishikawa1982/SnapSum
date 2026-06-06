import { describe, it, expect } from 'vitest';
import { scaleBox } from './geometry';

describe('scaleBox', () => {
  it('表示サイズが元画像と同じならそのまま', () => {
    const r = scaleBox({ x0: 10, y0: 20, x1: 30, y1: 50 }, 100, 100, 100, 100);
    expect(r).toEqual({ left: 10, top: 20, width: 20, height: 30 });
  });

  it('縮小表示時に座標とサイズをスケールする', () => {
    // 元画像 1000x1000 を 500x500 で表示 → 半分
    const r = scaleBox({ x0: 100, y0: 200, x1: 300, y1: 400 }, 1000, 1000, 500, 500);
    expect(r).toEqual({ left: 50, top: 100, width: 100, height: 100 });
  });

  it('元画像サイズが 0 でも例外を投げない', () => {
    const r = scaleBox({ x0: 10, y0: 10, x1: 20, y1: 20 }, 0, 0, 100, 100);
    expect(r.left).toBe(10);
  });
});
