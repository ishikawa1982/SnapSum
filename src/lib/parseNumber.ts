import type { OcrWord } from './ocr';
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
  const half = toHalfWidth(rawText);

  // 数字を 1 つも含まなければ対象外
  if (!/\d/.test(half)) return null;

  const nonAmount = looksLikeNonAmount(half);

  const cleaned = stripCurrency(half).trim();

  // 残った文字列が「数値 (整数 or 小数)」として妥当か検証
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const value = Number(match[0]);
  if (!Number.isFinite(value)) return null;

  // 整数部の桁数（採用ルール: 1〜7 桁程度）
  const integerDigits = Math.abs(Math.trunc(value)).toString().length;
  const excluded = nonAmount || integerDigits > 7 || value <= 0;

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

// OCR の word 配列を DetectedNumber 配列へ変換する。
// confidence が極端に低い word も「除外候補」として残し、タップで救済可能にする。
export function wordsToDetectedNumbers(
  words: OcrWord[],
  imageId: string,
  options: { minConfidence?: number } = {},
): DetectedNumber[] {
  const minConfidence = options.minConfidence ?? 30;
  const out: DetectedNumber[] = [];

  for (const word of words) {
    const parsed = parseAmount(word.text);
    if (!parsed) continue;

    const lowConfidence = word.confidence < minConfidence;

    out.push({
      id: makeId(),
      imageId,
      rawText: parsed.rawText,
      value: parsed.value,
      bbox: word.bbox,
      confidence: word.confidence,
      selected: false,
      isManual: false,
      excluded: parsed.excluded || lowConfidence,
    });
  }

  return out;
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
    excluded: false,
  };
}
