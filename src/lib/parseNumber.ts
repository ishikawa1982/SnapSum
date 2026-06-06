import type { BoundingBox, DetectedNumber } from '../types';

export interface ParsedNumber {
  value: number;
  rawText: string;
  excluded: boolean;
}

// 全角数字・記号を半角へ正規化する
export function toHalfWidth(input: string): string {
  return input
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/，/g, ',') // 全角カンマ
    .replace(/．/g, '.') // 全角ピリオド
    .replace(/\u3000/g, ' '); // 全角スペース → 半角
}

// 通貨記号・単位を除去する
function stripCurrency(input: string): string {
  return input.replace(/[¥$￥円]/g, '').replace(/[,，]/g, '');
}

// OCR が数字を字形の似た英字に誤読しやすい組み合わせ。
const DIGIT_MAP: Record<string, string> = {
  O: '0',
  o: '0',
  I: '1',
  l: '1',
  '|': '1',
  S: '5',
  B: '8',
  Z: '2',
  z: '2',
};

// 「ほぼ数字なのに一部が英字に誤読された」トークンを数字へ補正する。
// 例: "128O" → "1280", "1,28O円" → "1,280円"
// 誤補正を避けるため、数字以外の通常文字を含む語や、英字が数字より多い語は補正しない。
export function repairDigits(input: string): string {
  let digits = 0;
  let confusable = 0;
  for (const ch of input) {
    if (ch >= '0' && ch <= '9') digits++;
    else if (ch in DIGIT_MAP) confusable++;
    else if (/[.,¥$￥円，．、\s-]/.test(ch)) continue;
    // 補正対象外の文字（通常の英字・かな・漢字など）を含む → 金額トークンではない
    else return input;
  }
  if (digits === 0 || confusable === 0) return input;
  // 英字が数字より多い語（例: "B2B"）は誤補正の恐れがあるため触らない
  if (confusable > digits) return input;
  return input.replace(/[OoIl|SBZz]/g, (ch) => DIGIT_MAP[ch] ?? ch);
}

// 電話番号・日付・時刻・郵便番号らしきパターンか判定する。
// これらは金額ではない可能性が高いため除外候補にする。
export function looksLikeNonAmount(rawHalf: string): boolean {
  const s = rawHalf.trim();

  // ハイフン区切り（電話番号・郵便番号・日付）: 123-4567, 03-1234-5678, 2024-01-31
  if (/^\d{1,4}([-/.]\d{1,4}){1,}$/.test(s)) return true;

  // 時刻: 12:30
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return true;

  // 区切りを除いた純粋な桁数が多すぎる（電話番号・口座番号など 8 桁以上）
  const digitsOnly = s.replace(/\D/g, '');
  if (digitsOnly.length >= 8) return true;

  return false;
}

// 1 つの OCR word を金額候補としてパースする。
// 金額として全く解釈できない場合は null を返す。
export function parseAmount(rawText: string): ParsedNumber | null {
  // 字形の似た英字への誤読を先に補正する
  const half = repairDigits(toHalfWidth(rawText));

  // 数字を 1 つも含まなければ対象外
  if (!/\d/.test(half)) return null;

  // 通貨記号を除いてもなお英字を含む語は、レシート上の文字列とみなして除外する。
  // （ホワイトリストを使わない分、ここで文字混じりのゴミ数字を弾く）
  if (/[A-Za-z]/.test(half.replace(/[¥$￥円]/g, ''))) return null;

  const nonAmount = looksLikeNonAmount(half);

  const cleaned = stripCurrency(half).trim();

  // 残った文字列が「数値 (整数 or 小数)」として妥当か検証
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;

  // 0 はゴマ・汚れ・"O" の誤読など、ほぼノイズなので金額として扱わない。
  if (value === 0) return null;

  // 整数部の桁数（採用ルール: 1〜7 桁程度）
  const integerDigits = Math.abs(Math.trunc(value)).toString().length;
  const excluded = nonAmount || integerDigits > 7 || value < 0;

  return {
    value,
    rawText: rawText.trim(),
    excluded,
  };
}

let counter = 0;
function makeId(): string {
  counter += 1;
  return `n_${Date.now().toString(36)}_${counter}`;
}

// タップで読み取った金額から DetectedNumber を生成する（選択済み・bbox 付き）。
export function createReadNumber(
  value: number,
  imageId: string,
  bbox: BoundingBox,
): DetectedNumber {
  return {
    id: makeId(),
    imageId,
    rawText: String(value),
    value,
    bbox,
    confidence: 100,
    selected: true,
    isManual: false,
  };
}

// AI が読み取った合計から DetectedNumber を生成する（選択済み・座標なし）。
export function createAiNumber(value: number, imageId: string): DetectedNumber {
  return {
    id: makeId(),
    imageId,
    rawText: String(value),
    value,
    bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
    confidence: 100,
    selected: true,
    isManual: false,
  };
}

// 手動入力された数値から DetectedNumber を生成する（選択済み・isManual）。
export function createManualNumber(
  value: number,
  imageId: string,
  bbox?: BoundingBox,
): DetectedNumber {
  return {
    id: makeId(),
    imageId,
    rawText: String(value),
    value,
    bbox: bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 },
    confidence: 100,
    selected: true,
    isManual: true,
  };
}
