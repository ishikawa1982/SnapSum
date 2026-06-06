import { useRef, useState } from 'react';
import type { CapturedImage } from '../types';
import { useAppStore } from '../lib/store';
import { readAmountAt } from '../lib/tapread';
import { NumberOverlay } from './NumberOverlay';
import { ManualNumberList } from './ManualNumberList';

interface Props {
  image: CapturedImage;
  index: number;
}

export function ImageCard({ image, index }: Props) {
  const removeImage = useAppStore((s) => s.removeImage);
  const addReadNumber = useAppStore((s) => s.addReadNumber);
  const imgRef = useRef<HTMLImageElement>(null);

  // 読み取り中の表示（タップ位置にスピナー）と、直前の結果メッセージ
  const [reading, setReading] = useState<{ x: number; y: number } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const hasPhoto = Boolean(image.src);
  const readCount = image.numbers.filter(
    (n) => n.bbox.x1 - n.bbox.x0 > 0,
  ).length;

  const handleTap = async (e: React.MouseEvent<HTMLDivElement>) => {
    const imgEl = imgRef.current;
    if (!imgEl || reading) return;

    const rect = imgEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const fx = x / rect.width;
    const fy = y / rect.height;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;

    setNotFound(false);
    setReading({ x, y });
    if (navigator.vibrate) navigator.vibrate(8);
    try {
      const result = await readAmountAt(imgEl, fx, fy);
      if (result) {
        addReadNumber(image.id, result.value, result.bbox);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setReading(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-medium text-slate-500">
          {hasPhoto ? `写真 ${index + 1}` : '手動入力'}
        </span>
        <div className="flex items-center gap-2">
          {hasPhoto && readCount > 0 && (
            <span className="text-xs text-slate-400">{readCount}件読取</span>
          )}
          <button
            type="button"
            onClick={() => removeImage(image.id)}
            className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            aria-label="この画像を削除"
          >
            削除
          </button>
        </div>
      </div>

      {hasPhoto && image.status !== 'error' && (
        <>
          {/* 画像のどこかをタップするとその周辺の数字を読み取る */}
          <div className="relative bg-slate-900" onClick={handleTap}>
            <img
              ref={imgRef}
              src={image.src}
              alt={`取り込んだ写真 ${index + 1}`}
              className="block h-auto w-full cursor-crosshair select-none"
              draggable={false}
            />
            <NumberOverlay image={image} />

            {reading && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: reading.x,
                  top: reading.y,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Spinner />
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-500">
            {notFound
              ? '数字を読み取れませんでした。金額の上をもう一度タップしてください。'
              : '読み取りたい金額をタップ（タップでON/OFF・長押しで編集）'}
          </div>
        </>
      )}

      {image.status === 'error' && (
        <div className="px-3 py-3 text-sm text-red-600">
          画像の処理に失敗しました。別の画像をお試しください。
        </div>
      )}

      {/* 手動追加された（bbox を持たない）数字を一覧表示 */}
      <ManualNumberList image={image} />
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-9 w-9 animate-spin text-white drop-shadow"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-30"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  );
}
