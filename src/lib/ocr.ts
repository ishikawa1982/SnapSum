import Tesseract, { createWorker } from 'tesseract.js';
import type { BoundingBox } from '../types';

// OCR が認識した最小テキスト単位（word）
export interface OcrWord {
  text: string;
  bbox: BoundingBox;
  confidence: number;
}

// OCR を抽象化し、後で Cloud Vision 等に差し替え可能にするインターフェース
export interface OcrEngine {
  recognize(image: Blob): Promise<OcrWord[]>;
  terminate?(): Promise<void>;
}

// Tesseract.js によるクライアント実行 OCR 実装。
// worker を 1 度だけ生成して使い回す（モデルの再読み込みコストを避ける）。
export class TesseractOcrEngine implements OcrEngine {
  private workerPromise: Promise<Tesseract.Worker> | null = null;

  private getWorker(): Promise<Tesseract.Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker('jpn+eng', undefined, {
        // 進捗ログは必要に応じて UI 側で購読する
      }).then(async (worker) => {
        await worker.setParameters({
          // 数字・通貨記号・区切りに絞って誤認識を減らす
          tessedit_char_whitelist: '0123456789.,¥$円，．、 ',
          preserve_interword_spaces: '1',
        });
        return worker;
      });
    }
    return this.workerPromise;
  }

  async recognize(image: Blob): Promise<OcrWord[]> {
    const worker = await this.getWorker();
    const { data } = await worker.recognize(image, {}, { blocks: true });

    const words: OcrWord[] = [];
    // tesseract.js v5: data.words はトップレベルにも入る
    const rawWords = collectWords(data);
    for (const w of rawWords) {
      if (!w.text || !w.text.trim()) continue;
      words.push({
        text: w.text,
        bbox: {
          x0: w.bbox.x0,
          y0: w.bbox.y0,
          x1: w.bbox.x1,
          y1: w.bbox.y1,
        },
        confidence: w.confidence,
      });
    }
    return words;
  }

  async terminate(): Promise<void> {
    if (this.workerPromise) {
      const worker = await this.workerPromise;
      await worker.terminate();
      this.workerPromise = null;
    }
  }
}

// recognize の結果から word の一覧を取り出す（API バージョン差異を吸収）。
function collectWords(data: Tesseract.Page): Array<{
  text: string;
  confidence: number;
  bbox: BoundingBox;
}> {
  if (Array.isArray(data.words) && data.words.length > 0) {
    return data.words as never;
  }
  // blocks からたどる場合のフォールバック
  const out: Array<{ text: string; confidence: number; bbox: BoundingBox }> =
    [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          out.push({
            text: word.text,
            confidence: word.confidence,
            bbox: word.bbox,
          });
        }
      }
    }
  }
  return out;
}

// アプリ全体で共有する OCR エンジンのシングルトン
export const ocrEngine: OcrEngine = new TesseractOcrEngine();
