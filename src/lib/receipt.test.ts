import { describe, it, expect } from 'vitest';
import { dedupeFragments, pickTotalId } from './receipt';
import type { DetectedNumber } from '../types';

let n = 0;
function mk(
  value: number,
  bbox: { x0: number; y0: number; x1: number; y1: number },
  opts: Partial<DetectedNumber> = {},
): DetectedNumber {
  n += 1;
  return {
    id: `n${n}`,
    imageId: 'img',
    rawText: String(value),
    value,
    bbox,
    confidence: 90,
    selected: false,
    isManual: false,
    excluded: false,
    isTotal: false,
    ...opts,
  };
}

describe('pickTotalId', () => {
  it('有効な金額のうち最もフォントが大きいものを合計に選ぶ', () => {
    // レシートを模した配置: 明細は小さめ、合計だけ背が高い
    const items = [
      mk(1573, { x0: 900, y0: 870, x1: 1000, y1: 906 }), // h=36 明細
      mk(1628, { x0: 900, y0: 990, x1: 1000, y1: 1026 }), // h=36 明細
      mk(3201, { x0: 900, y0: 1120, x1: 1000, y1: 1158 }), // h=38 小計
      mk(3201, { x0: 900, y0: 1370, x1: 1010, y1: 1411 }), // h=41 合計（最大）
    ];
    const id = pickTotalId(items);
    expect(items.find((i) => i.id === id)?.value).toBe(3201);
    // 高さ最大（合計欄）が選ばれている
    expect(id).toBe(items[3].id);
  });

  it('除外された数字（登録番号など）は合計候補にしない', () => {
    const items = [
      mk(480, { x0: 0, y0: 0, x1: 40, y1: 40 }),
      mk(20101030790, { x0: 0, y0: 100, x1: 200, y1: 145 }, { excluded: true }),
    ];
    const id = pickTotalId(items);
    expect(items.find((i) => i.id === id)?.value).toBe(480);
  });

  it('候補が無ければ null', () => {
    expect(pickTotalId([])).toBeNull();
    expect(pickTotalId([mk(5, { x0: 0, y0: 0, x1: 0, y1: 0 })])).toBeNull();
  });
});

describe('dedupeFragments', () => {
  it('大きな数字に重なる部分読みの断片を取り除く', () => {
    const full = mk(3201, { x0: 900, y0: 1370, x1: 1010, y1: 1411 }); // 合計全体
    const frag1 = mk(3, { x0: 900, y0: 1372, x1: 925, y1: 1409 }); // "¥3"
    const frag2 = mk(201, { x0: 950, y0: 1372, x1: 1008, y1: 1409 }); // "201"
    const other = mk(1573, { x0: 900, y0: 870, x1: 1000, y1: 906 }); // 別行
    const result = dedupeFragments([full, frag1, frag2, other]);
    const values = result.map((r) => r.value).sort((a, b) => a - b);
    expect(values).toEqual([1573, 3201]);
  });

  it('座標を持たない手動入力は残す', () => {
    const manual = mk(500, { x0: 0, y0: 0, x1: 0, y1: 0 }, { isManual: true });
    expect(dedupeFragments([manual])).toHaveLength(1);
  });
});
