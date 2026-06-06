import type { CapturedImage } from '../types';
import { formatYen } from '../lib/format';
import { useAppStore } from '../lib/store';

interface Props {
  image: CapturedImage;
}

// bbox を持たない（手動追加された）数字をチップとして一覧表示する。
// オーバーレイには載らないため、ここでタップ選択・削除できるようにする。
export function ManualNumberList({ image }: Props) {
  const toggleSelect = useAppStore((s) => s.toggleSelect);
  const editNumber = useAppStore((s) => s.editNumber);
  const removeNumber = useAppStore((s) => s.removeNumber);

  const manual = image.numbers.filter(
    (n) => n.bbox.x1 - n.bbox.x0 <= 0 || n.bbox.y1 - n.bbox.y0 <= 0,
  );

  if (manual.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-3">
      {manual.map((n) => (
        <div key={n.id} className="flex items-center">
          <button
            type="button"
            onClick={() => toggleSelect(n.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              const input = window.prompt('金額を編集', String(n.value));
              if (input == null) return;
              const v = Number(input.replace(/[^0-9.-]/g, ''));
              if (Number.isFinite(v)) editNumber(n.id, v);
            }}
            aria-pressed={n.selected}
            className={`flex min-h-[36px] items-center gap-1 rounded-l-lg border-2 px-3 text-sm font-semibold ${
              n.selected
                ? 'border-brand bg-brand text-white'
                : 'border-brand/50 bg-white text-brand'
            }`}
          >
            {n.selected && <span aria-hidden>✓</span>}
            {formatYen(n.value)}
          </button>
          <button
            type="button"
            onClick={() => removeNumber(n.id)}
            aria-label="削除"
            className="flex min-h-[36px] items-center rounded-r-lg border-2 border-l-0 border-slate-200 bg-slate-50 px-2 text-slate-400 hover:text-red-500"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
