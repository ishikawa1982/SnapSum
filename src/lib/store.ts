import { create } from 'zustand';
import type { BoundingBox, CapturedImage, DetectedNumber } from '../types';
import { ocrEngine } from './ocr';
import { prepareImage } from './image';
import {
  createAiNumber,
  createManualNumber,
  createReadNumber,
} from './parseNumber';
import { extractReceiptTotal, aiErrorMessage } from './aiOcr';
import { getApiKey, getModel, hasApiKey } from './settings';

let imageCounter = 0;
function makeImageId(): string {
  imageCounter += 1;
  return `img_${Date.now().toString(36)}_${imageCounter}`;
}

type SetFn = (fn: (s: AppState) => Partial<AppState>) => void;

// AI が読み取った数字か（座標を持たず、手動でもないもの）。再読み取り時に差し替える。
function isAiNumber(n: DetectedNumber): boolean {
  return !n.isManual && n.bbox.x1 - n.bbox.x0 <= 0 && n.bbox.y1 - n.bbox.y0 <= 0;
}

// 画像を AI に渡して合計を読み取り、結果を反映する。
async function runAiWithBlob(
  imageId: string,
  blob: Blob,
  set: SetFn,
): Promise<void> {
  try {
    const result = await extractReceiptTotal(blob, {
      apiKey: getApiKey(),
      model: getModel(),
    });
    set((s) => ({
      images: s.images.map((img) => {
        if (img.id !== imageId) return img;
        // 以前の AI 検出は差し替える（再読み取りで重複させない）
        const kept = img.numbers.filter((n) => !isAiNumber(n));
        const numbers =
          result.total != null
            ? [...kept, createAiNumber(result.total, imageId)]
            : kept;
        return { ...img, numbers, aiStatus: 'done' as const };
      }),
    }));
  } catch (err) {
    set((s) => ({
      images: s.images.map((img) =>
        img.id === imageId
          ? { ...img, aiStatus: 'error' as const, aiError: aiErrorMessage(err) }
          : img,
      ),
    }));
  }
}

interface AppState {
  images: CapturedImage[];

  // 派生値: 選択中の数字の合計
  total: () => number;
  selectedCount: () => number;
  allNumbers: () => DetectedNumber[];

  addImage: (file: File) => Promise<void>;
  runAi: (imageId: string) => Promise<void>;
  addReadNumber: (imageId: string, value: number, bbox: BoundingBox) => void;
  toggleSelect: (numberId: string) => void;
  editNumber: (numberId: string, value: number) => void;
  removeNumber: (numberId: string) => void;
  addManualNumber: (value: number) => void;
  removeImage: (imageId: string) => void;

  clearSelection: () => void; // 全選択解除
  clearAll: () => void; // 全画像削除（リセット）
}

export const useAppStore = create<AppState>((set, get) => ({
  images: [],

  total: () =>
    get()
      .allNumbers()
      .filter((n) => n.selected)
      .reduce((sum, n) => sum + n.value, 0),

  selectedCount: () => get().allNumbers().filter((n) => n.selected).length,

  allNumbers: () => get().images.flatMap((img) => img.numbers),

  addImage: async (file) => {
    const id = makeImageId();
    const aiOn = hasApiKey();
    try {
      const prepared = await prepareImage(file);
      // タップ読み取り用 OCR モデルを先読みしておく
      ocrEngine.warmup?.();
      set((s) => ({
        images: [
          ...s.images,
          {
            id,
            src: prepared.src,
            width: prepared.width,
            height: prepared.height,
            numbers: [],
            status: 'ready',
            aiStatus: aiOn ? 'reading' : 'off',
          },
        ],
      }));
      // APIキーがあれば、AI に合計を読み取らせて自動で積み上げる
      if (aiOn) await runAiWithBlob(id, prepared.blob, set);
    } catch {
      set((s) => ({
        images: [
          ...s.images,
          {
            id,
            src: URL.createObjectURL(file),
            width: 0,
            height: 0,
            numbers: [],
            status: 'error',
            aiStatus: 'off',
          },
        ],
      }));
    }
  },

  runAi: async (imageId) => {
    const img = get().images.find((i) => i.id === imageId);
    if (!img || !img.src) return;
    set((s) => ({
      images: s.images.map((i) =>
        i.id === imageId ? { ...i, aiStatus: 'reading', aiError: undefined } : i,
      ),
    }));
    try {
      const blob = await fetch(img.src).then((r) => r.blob());
      await runAiWithBlob(imageId, blob, set);
    } catch (err) {
      set((s) => ({
        images: s.images.map((i) =>
          i.id === imageId
            ? { ...i, aiStatus: 'error', aiError: aiErrorMessage(err) }
            : i,
        ),
      }));
    }
  },

  addReadNumber: (imageId, value, bbox) =>
    set((s) => ({
      images: s.images.map((img) =>
        img.id === imageId
          ? {
              ...img,
              numbers: [...img.numbers, createReadNumber(value, imageId, bbox)],
            }
          : img,
      ),
    })),

  toggleSelect: (numberId) =>
    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        numbers: img.numbers.map((n) =>
          n.id === numberId ? { ...n, selected: !n.selected } : n,
        ),
      })),
    })),

  editNumber: (numberId, value) =>
    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        numbers: img.numbers.map((n) =>
          n.id === numberId
            ? { ...n, value, rawText: String(value), isManual: true }
            : n,
        ),
      })),
    })),

  removeNumber: (numberId) =>
    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        numbers: img.numbers.filter((n) => n.id !== numberId),
      })),
    })),

  addManualNumber: (value) =>
    set((s) => {
      // 既存画像があれば最後の画像に紐付け、なければ仮想画像を用意する
      const images = [...s.images];
      let target = images[images.length - 1];
      if (!target) {
        target = {
          id: makeImageId(),
          src: '',
          width: 0,
          height: 0,
          numbers: [],
          status: 'ready',
          aiStatus: 'off',
        };
        images.push(target);
      }
      const manual = createManualNumber(value, target.id);
      images[images.length - 1] = {
        ...target,
        numbers: [...target.numbers, manual],
      };
      return { images };
    }),

  removeImage: (imageId) =>
    set((s) => {
      const target = s.images.find((img) => img.id === imageId);
      if (target?.src) URL.revokeObjectURL(target.src);
      return { images: s.images.filter((img) => img.id !== imageId) };
    }),

  clearSelection: () =>
    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        numbers: img.numbers.map((n) => ({ ...n, selected: false })),
      })),
    })),

  clearAll: () =>
    set((s) => {
      for (const img of s.images) {
        if (img.src) URL.revokeObjectURL(img.src);
      }
      return { images: [] };
    }),
}));
