import { create } from 'zustand';
import type { CapturedImage, DetectedNumber } from '../types';
import { ocrEngine } from './ocr';
import { prepareImage } from './image';
import { createManualNumber, wordsToDetectedNumbers } from './parseNumber';

let imageCounter = 0;
function makeImageId(): string {
  imageCounter += 1;
  return `img_${Date.now().toString(36)}_${imageCounter}`;
}

interface AppState {
  images: CapturedImage[];

  // 派生値: 選択中の数字の合計
  total: () => number;
  selectedCount: () => number;
  allNumbers: () => DetectedNumber[];

  addImage: (file: File) => Promise<void>;
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

    // まずプレビューを処理中状態で積む
    let prepared;
    try {
      prepared = await prepareImage(file);
    } catch {
      // 画像のデコードに失敗
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
          },
        ],
      }));
      return;
    }

    set((s) => ({
      images: [
        ...s.images,
        {
          id,
          src: prepared.src,
          width: prepared.width,
          height: prepared.height,
          numbers: [],
          status: 'processing',
          progress: 0,
        },
      ],
    }));

    try {
      let lastPercent = -1;
      const words = await ocrEngine.recognize(prepared.ocrBlob, (p) => {
        // 整数%が変わったときだけ再描画する
        const percent = Math.round(p * 100);
        if (percent === lastPercent) return;
        lastPercent = percent;
        set((s) => ({
          images: s.images.map((img) =>
            img.id === id ? { ...img, progress: p } : img,
          ),
        }));
      });
      const numbers = wordsToDetectedNumbers(words, id);
      set((s) => ({
        images: s.images.map((img) =>
          img.id === id
            ? { ...img, numbers, status: 'done', progress: 1 }
            : img,
        ),
      }));
    } catch {
      set((s) => ({
        images: s.images.map((img) =>
          img.id === id ? { ...img, status: 'error' } : img,
        ),
      }));
    }
  },

  toggleSelect: (numberId) =>
    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        numbers: img.numbers.map((n) =>
          n.id === numberId
            ? // 救済タップ時は除外フラグも解除して通常チップ化する
              { ...n, selected: !n.selected, excluded: false }
            : n,
        ),
      })),
    })),

  editNumber: (numberId, value) =>
    set((s) => ({
      images: s.images.map((img) => ({
        ...img,
        numbers: img.numbers.map((n) =>
          n.id === numberId
            ? {
                ...n,
                value,
                rawText: String(value),
                isManual: true,
                excluded: false,
              }
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
          status: 'done',
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
