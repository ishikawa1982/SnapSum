import type { BoundingBox, DetectedNumber } from '../types';

function area(b: BoundingBox): number {
  return Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
}

function height(b: BoundingBox): number {
  return b.y1 - b.y0;
}

function intersectionArea(a: BoundingBox, b: BoundingBox): number {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
}

// SPARSE_TEXT では大きな数字（特に合計）が「¥3,201」全体と「¥3」「201」のように
// 重複して読まれることがある。面積の大半が、より高さのある別の数字に含まれている
// ものは「部分読み（断片）」とみなして取り除く。
export function dedupeFragments(numbers: DetectedNumber[]): DetectedNumber[] {
  return numbers.filter((n) => {
    const a = area(n.bbox);
    if (a <= 0) return true; // 手動入力など座標を持たないものは残す
    const nH = height(n.bbox);
    const swallowed = numbers.some((m) => {
      if (m.id === n.id) return false;
      if (area(m.bbox) <= a) return false; // より大きい箱にのみ呑み込まれ得る
      if (height(m.bbox) < nH) return false;
      return intersectionArea(n.bbox, m.bbox) / a >= 0.6;
    });
    return !swallowed;
  });
}

// レシートの合計金額らしき数字の id を返す。
//
// 「合計」の文字自体は OCR で安定して読めないため、キーワードには頼らない。
// 合計は明細・税の各項目の総和なので、レシート上の金額の中で最大になりやすい、
// という性質を主な信号に使う（フォント高さより頑健。背の高い誤読の単独数字に釣られない）。
// 通貨記号（¥ / 円）付きの金額があればそれを優先し、無ければ全候補から選ぶ。
// 値が同じならフォントが大きい方・より下にある方（＝合計欄に近い）を優先する。
export function pickTotalId(numbers: DetectedNumber[]): string | null {
  const candidates = numbers.filter((n) => !n.excluded && height(n.bbox) > 0);
  if (candidates.length === 0) return null;

  const yenTagged = candidates.filter((n) => /[¥￥円]/.test(n.rawText));
  const pool = yenTagged.length > 0 ? yenTagged : candidates;

  const best = [...pool].sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value; // 値が大きい方
    const dh = height(b.bbox) - height(a.bbox);
    if (dh !== 0) return dh; // フォントが大きい方
    return b.bbox.y0 - a.bbox.y0; // 下にある方
  })[0];

  return best.id;
}
