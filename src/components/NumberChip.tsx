import { useState } from 'react';
import type { DetectedNumber } from '../types';
import { formatYen } from '../lib/format';
import { useAppStore } from '../lib/store';

interface Props {
  number: DetectedNumber;
  style: React.CSSProperties;
}

// 画像上に重ねて表示される、タップ可能な数字チップ。
// 未選択＝薄い枠 / 選択中＝塗りつぶし＋太字。色だけに依存せずチェック印でも選択を示す。
export function NumberChip({ number, style }: Props) {
  const toggleSelect = useAppStore((s) => s.toggleSelect);
  const editNumber = useAppStore((s) => s.editNumber);
  const [animate, setAnimate] = useState(false);

  const handleClick = () => {
    setAnimate(true);
    if (navigator.vibrate) navigator.vibrate(8);
    toggleSelect(number.id);
  };

  // 長押し / 右クリックで編集（誤認識の補正）
  const handleEdit = () => {
    const input = window.prompt(
      '正しい金額を入力してください',
      String(number.value),
    );
    if (input == null) return;
    const v = Number(input.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(v)) editNumber(number.id, v);
  };

  const base =
    'absolute flex min-h-[28px] min-w-[28px] items-center justify-center rounded-md border-2 px-1.5 text-xs font-semibold shadow-sm transition-colors select-none';

  const stateClass = number.selected
    ? 'border-brand bg-brand text-white font-bold'
    : number.excluded
      ? 'border-slate-300 bg-white/70 text-slate-400'
      : 'border-brand/60 bg-white/90 text-brand';

  return (
    <button
      type="button"
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        handleEdit();
      }}
      onAnimationEnd={() => setAnimate(false)}
      style={style}
      aria-pressed={number.selected}
      aria-label={`${formatYen(number.value)} ${
        number.selected ? '選択中' : '未選択'
      }`}
      className={`${base} ${stateClass} ${animate ? 'animate-pop' : ''}`}
      title="タップで選択 / 長押し（右クリック）で編集"
    >
      {number.selected && (
        <svg
          viewBox="0 0 20 20"
          className="mr-0.5 h-3 w-3 shrink-0"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className="whitespace-nowrap">{formatYen(number.value)}</span>
    </button>
  );
}
