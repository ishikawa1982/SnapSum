import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../lib/store';
import { formatYen } from '../lib/format';

// 画面下部に常時固定。選択件数と合計金額を大きく表示する。
// 合計が更新されるたびに軽いアニメーションを付ける。
export function TotalBar() {
  const total = useAppStore((s) => s.total());
  const count = useAppStore((s) => s.selectedCount());

  const [animate, setAnimate] = useState(false);
  const prev = useRef(total);

  useEffect(() => {
    if (prev.current !== total) {
      setAnimate(true);
      prev.current = total;
    }
  }, [total]);

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-safe">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500" aria-live="polite">
          選択中:{' '}
          <span className="font-semibold text-slate-700">{count}</span> 件
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-slate-400">合計</span>
          <span
            onAnimationEnd={() => setAnimate(false)}
            aria-live="polite"
            className={`text-3xl font-extrabold tabular-nums text-brand ${
              animate ? 'animate-pop' : ''
            }`}
          >
            {formatYen(total)}
          </span>
        </div>
      </div>
    </div>
  );
}
