import Tesseract, { createWorker, PSM } from 'tesseract.js';
import type { BoundingBox } from '../types';

// OCR が認識した最小テキスト単位（word）
export interface OcrWord {
  text: string;
  bbox: BoundingBox;
  confidence: number;
}

export type ProgressCallback = (progress: number) => void;

// OCR を抽象化し、後で Cloud Vision 等に差し替え可能にするインターフェース
export interface OcrEngine {
  recognize(image: Blob, onProgress?: ProgressCallback): Promise<OcrWord[]>;
  warmup?(): void; // モデルの事前読み込み（初回タップの待ち時間を隠す）
  terminate?(): Promise<void>;
}

// Tesseract.js によるクライアント実行 OCR 実装。
// worker を 1 度だけ生成して使い回す（モデルの再読み込みコストを避ける）。
export class TesseractOcrEngine implements OcrEngine {
  private workerPromise: Promise<Tesseract.Worker> | null = null;
  private onProgress: ProgressCallback | null = null;

  private getWorker(): Promise<Tesseract.Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker('jpn+eng', undefined, {
        logger: (m) => {
          if (m.status === 'recognizing text' && this.onProgress) {
            this.onProgress(m.progress);
          }
        },
      }).then(async (worker) => {
        await worker.setParameters({
          // 数字に文字を無理やり寄せると誤検出が増えるため、ホワイトリストは使わない。
          // 文字混じりの語はパース側（parseNumber）で除外する。
          //
          // レシートの金額や値札は行・ブロックに整列していないことが多く、既定の AUTO では
          // ほとんど検出できなかった（実測）。SPARSE_TEXT は配置を仮定せず散在する文字を
          // 拾うため、金額の取りこぼしが減る。
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          // DPI を明示してレイアウト推定を安定させる。
          user_defined_dpi: '300',
          preserve_interword_spaces: '1',
        });
        return worker;
      });
    }
    return this.workerPromise;
  }

  warmup(): void {
    // 失敗してもここでは握りつぶす（recognize 時に改めて評価される）
    void this.getWorker().catch(() => {});
  }

  async recognize(
    image: Blob,
    onProgress?: ProgressCallback,
  ): Promise<OcrWord[]> {
    const worker = await this.getWorker();
    this.onProgress = onProgress ?? null;
    try {
      const { data } = await worker.recognize(image, {}, { blocks: true });

      const words: OcrWord[] = [];
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
    } finally {
      this.onProgress = null;
    }
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
