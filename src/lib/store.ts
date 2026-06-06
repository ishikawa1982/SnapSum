import { create } from 'zustand';
import type { BoundingBox, CapturedImage, DetectedNumber } from '../types';
import { ocrEngine } from './ocr';
import { prepareImage } from './image';
import { createManualNumber, createReadNumber } from './parseNumber';

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
    try {
      const prepared = await prepareImage(file);
      // モデルを先読みして、最初のタップ読み取りの待ち時間を隠す
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
          },
        ],
      }));
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
          },
        ],
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
