import type { CapturedImage } from '../types';
import { useAppStore } from '../lib/store';
import { NumberOverlay } from './NumberOverlay';
import { ManualNumberList } from './ManualNumberList';

interface Props {
  image: CapturedImage;
  index: number;
}

export function ImageCard({ image, index }: Props) {
  const removeImage = useAppStore((s) => s.removeImage);

  const detectedCount = image.numbers.filter((n) => !n.excluded).length;
  const hasPhoto = Boolean(image.src);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-sm font-medium text-slate-500">
          {hasPhoto ? `写真 ${index + 1}` : '手動入力'}
        </span>
        <div className="flex items-center gap-2">
          {image.status === 'done' && hasPhoto && (
            <span className="text-xs text-slate-400">
              {detectedCount}件の数字
            </span>
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

      {hasPhoto && (
        <div className="relative bg-slate-900">
          <img
            src={image.src}
            alt={`取り込んだ写真 ${index + 1}`}
            className="block h-auto w-full select-none"
            draggable={false}
          />
          <NumberOverlay image={image} />

          {image.status === 'processing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 text-white">
              <Spinner />
              <span className="text-sm font-medium">数字を読み取り中…</span>
              {image.progress != null && image.progress > 0 && (
                <span className="text-xs tabular-nums text-white/80">
                  {Math.round(image.progress * 100)}%
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {image.status === 'error' && (
        <div className="px-3 py-3 text-sm text-red-600">
          画像の処理に失敗しました。別の画像をお試しください。
        </div>
      )}

      {image.status === 'done' && hasPhoto && detectedCount === 0 && (
        <div className="border-t border-slate-100 px-3 py-3 text-sm text-slate-500">
          数字が見つかりませんでした。
          <span className="text-slate-400">
            「手動で追加」から金額を入力できます。
          </span>
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
      className="h-8 w-8 animate-spin text-white"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
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
