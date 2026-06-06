import { describe, it, expect } from 'vitest';
import {
  parseAmount,
  toHalfWidth,
  looksLikeNonAmount,
  repairDigits,
  wordsToDetectedNumbers,
} from './parseNumber';
import type { OcrWord } from './ocr';

describe('toHalfWidth', () => {
  it('全角数字を半角に変換する', () => {
    expect(toHalfWidth('１２３')).toBe('123');
  });
  it('全角カンマ・ピリオドを変換する', () => {
    expect(toHalfWidth('１，２８０')).toBe('1,280');
    expect(toHalfWidth('１２．５０')).toBe('12.50');
  });
});

describe('parseAmount', () => {
  it('カンマ区切りと円記号を除去して数値化する', () => {
    expect(parseAmount('1,280円')?.value).toBe(1280);
  });
  it('¥ 記号付きを数値化する', () => {
    expect(parseAmount('¥3,000')?.value).toBe(3000);
  });
  it('小数を保持する', () => {
    expect(parseAmount('12.50')?.value).toBe(12.5);
  });
  it('全角金額を数値化する', () => {
    expect(parseAmount('１，２８０')?.value).toBe(1280);
  });
  it('数字を含まない文字列は null', () => {
    expect(parseAmount('合計')).toBeNull();
    expect(parseAmount('円')).toBeNull();
  });
  it('通常の金額は除外されない', () => {
    const r = parseAmount('480');
    expect(r?.excluded).toBe(false);
  });
  it('8桁以上は除外候補にする（電話番号・口座番号など）', () => {
    const r = parseAmount('12345678');
    expect(r?.excluded).toBe(true);
  });
  it('日付らしき値は除外候補にする', () => {
    const r = parseAmount('2024-01-31');
    expect(r?.excluded).toBe(true);
  });
});

describe('repairDigits', () => {
  it('末尾の O を 0 に補正する', () => {
    expect(repairDigits('128O')).toBe('1280');
  });
  it('通貨・カンマを保ったまま補正する', () => {
    expect(repairDigits('1,28O円')).toBe('1,280円');
  });
  it('S を 5 に補正する', () => {
    expect(repairDigits('S00')).toBe('500');
  });
  it('通常の単語（数字以外の文字を含む）は補正しない', () => {
    expect(repairDigits('Office')).toBe('Office');
    expect(repairDigits('合計')).toBe('合計');
  });
  it('英字が数字より多い語は誤補正を避けて触らない', () => {
    expect(repairDigits('SS5')).toBe('SS5');
  });
  it('純粋な数字はそのまま', () => {
    expect(repairDigits('1280')).toBe('1280');
  });
});

describe('parseAmount 誤読補正と文字混じり除外', () => {
  it('誤読された金額を補正して数値化する', () => {
    expect(parseAmount('1,28O円')?.value).toBe(1280);
  });
  it('英字を含む文字列（住所・店名など）は金額とみなさない', () => {
    expect(parseAmount('Tel123')).toBeNull();
    expect(parseAmount('Room202')).toBeNull();
  });
});

describe('looksLikeNonAmount', () => {
  it('電話番号を検出', () => {
    expect(looksLikeNonAmount('03-1234-5678')).toBe(true);
  });
  it('時刻を検出', () => {
    expect(looksLikeNonAmount('12:30')).toBe(true);
  });
  it('郵便番号を検出', () => {
    expect(looksLikeNonAmount('123-4567')).toBe(true);
  });
  it('通常の金額は非検出', () => {
    expect(looksLikeNonAmount('1280')).toBe(false);
  });
});

describe('wordsToDetectedNumbers', () => {
  const mk = (text: string, confidence: number): OcrWord => ({
    text,
    confidence,
    bbox: { x0: 0, y0: 0, x1: 10, y1: 10 },
  });

  it('金額 word のみを DetectedNumber 化する', () => {
    const words = [mk('1,280円', 90), mk('合計', 95), mk('480', 88)];
    const result = wordsToDetectedNumbers(words, 'img1');
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.value)).toEqual([1280, 480]);
    expect(result.every((n) => n.imageId === 'img1')).toBe(true);
  });

  it('信頼度が低い word は除外フラグを立てて残す', () => {
    const words = [mk('500', 10)];
    const result = wordsToDetectedNumbers(words, 'img1', { minConfidence: 30 });
    expect(result).toHaveLength(1);
    expect(result[0].excluded).toBe(true);
  });
});
