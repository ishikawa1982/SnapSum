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
  const runAi = useAppStore((s) => s.runAi);
  const imgRef = useRef<HTMLImageElement>(null);

  // AI が検出した合計（座標を持たず、手動でもない数字）
  const aiTotal = image.numbers.find(
    (n) => !n.isManual && n.bbox.x1 - n.bbox.x0 <= 0,
  );

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

      {/* AI による合計読み取りの状態 */}
      {image.aiStatus === 'reading' && (
        <div className="flex items-center gap-2 border-t border-slate-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          <SmallSpinner /> AIが合計を読み取り中…
        </div>
      )}
      {image.aiStatus === 'done' && aiTotal && (
        <div className="border-t border-slate-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          ✅ AIが合計を検出しました（下のチップで確認・修正できます）
        </div>
      )}
      {image.aiStatus === 'done' && !aiTotal && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>AIは合計を読み取れませんでした。</span>
          <button
            type="button"
            onClick={() => runAi(image.id)}
            className="shrink-0 rounded-md bg-amber-600 px-2 py-1 text-xs font-bold text-white"
          >
            再試行
          </button>
        </div>
      )}
      {image.aiStatus === 'error' && (
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{image.aiError ?? 'AIの読み取りに失敗しました。'}</span>
          <button
            type="button"
            onClick={() => runAi(image.id)}
            className="shrink-0 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white"
          >
            再試行
          </button>
        </div>
      )}

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

function SmallSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-emerald-700"
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
