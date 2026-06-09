import Anthropic from '@anthropic-ai/sdk';
import Tesseract, { createWorker, PSM } from 'tesseract.js';
import type { BoundingBox } from '../types';

// OCR が認識した最小テキスト単位（word）
export interface OcrWord {
  text: string;
  bbox: BoundingBox;
  confidence: number;
  isTotal?: boolean; // Claude Vision が合計金額として特定した場合 true
}

export type ProgressCallback = (progress: number) => void;

// OCR を抽象化し、後で Cloud Vision 等に差し替え可能にするインターフェース
export interface OcrEngine {
  recognize(image: Blob, onProgress?: ProgressCallback): Promise<OcrWord[]>;
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

// Claude Vision API を使った高精度 OCR エンジン
export class ClaudeVisionOcrEngine implements OcrEngine {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async recognize(
    image: Blob,
    onProgress?: ProgressCallback,
  ): Promise<OcrWord[]> {
    onProgress?.(0.1);

    const bitmap = await createImageBitmap(image);
    const imageWidth = bitmap.width;
    const imageHeight = bitmap.height;
    bitmap.close();

    const arrayBuffer = await image.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64Data = btoa(binary);

    const mediaType = (image.type || 'image/png') as
      | 'image/jpeg'
      | 'image/png'
      | 'image/gif'
      | 'image/webp';

    const prompt = `このレシートの画像を解析し、金額らしき数字をすべて抽出してください。
以下の JSON 形式で返してください（コードブロックや説明文は不要です）：

{
  "amounts": [
    {
      "text": "¥3,201",
      "normalizedX": 0.75,
      "normalizedY": 0.92,
      "isTotal": true
    }
  ]
}

ルール：
- text: レシートに印刷されている元の表記（通貨記号・カンマ含む）
- normalizedX: 画像の左端を 0.0、右端を 1.0 とした水平位置（金額の中心）
- normalizedY: 画像の上端を 0.0、下端を 1.0 とした垂直位置（金額の中心）
- isTotal: 「合計」「お会計」「総合計」「Tax incl.」「Total」などの合計金額なら true、そうでなければ false
- 金額でない数字（電話番号・日付・商品番号など）は含めないでください
- 数字が読み取れない場合は amounts を空配列にしてください`;

    let responseText = '';
    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      });
      onProgress?.(0.9);

      const block = response.content[0];
      if (block.type !== 'text') return [];
      responseText = block.text.trim();
    } catch {
      // API 呼び出し失敗 → 呼び出し元（store）の catch に任せる
      throw new Error('Claude Vision API の呼び出しに失敗しました');
    }

    try {
      const json = JSON.parse(responseText) as {
        amounts: Array<{
          text: string;
          normalizedX: number;
          normalizedY: number;
          isTotal: boolean;
        }>;
      };

      const words: OcrWord[] = (json.amounts ?? []).map((a) => {
        const cx = Math.max(0, Math.min(1, a.normalizedX ?? 0.75)) * imageWidth;
        const cy = Math.max(0, Math.min(1, a.normalizedY ?? 0.5)) * imageHeight;
        const halfW = imageWidth * 0.12;
        const halfH = imageHeight * 0.02;
        const bbox: BoundingBox = {
          x0: Math.max(0, cx - halfW),
          y0: Math.max(0, cy - halfH),
          x1: Math.min(imageWidth, cx + halfW),
          y1: Math.min(imageHeight, cy + halfH),
        };
        return {
          text: a.text ?? '',
          bbox,
          confidence: 90,
          isTotal: a.isTotal === true,
        };
      });

      onProgress?.(1.0);
      return words;
    } catch {
      // JSON パース失敗 → 空配列を返す（store が error 状態にしないよう空で返す）
      onProgress?.(1.0);
      return [];
    }
  }
}

// VITE_ANTHROPIC_API_KEY が設定されていれば Claude Vision を、なければ Tesseract を使う
function createOcrEngine(): OcrEngine {
  const apiKey = (import.meta as { env?: Record<string, string> }).env
    ?.VITE_ANTHROPIC_API_KEY;
  if (apiKey) return new ClaudeVisionOcrEngine(apiKey);
  return new TesseractOcrEngine();
}

// アプリ全体で共有する OCR エンジンのシングルトン
export const ocrEngine: OcrEngine = createOcrEngine();
