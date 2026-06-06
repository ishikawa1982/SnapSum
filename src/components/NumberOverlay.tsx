import { useEffect, useRef, useState } from 'react';
import type { CapturedImage } from '../types';
import { scaleBox } from '../lib/geometry';
import { NumberChip } from './NumberChip';

interface Props {
  image: CapturedImage;
  // false のときは自動検出した合計チップだけを表示する（既定）。
  // true のときは検出した全数字を表示し、合計の付け替え・修正を可能にする。
  showAll: boolean;
}

// 画像の上に絶対配置で bbox をスケール変換して数字チップを重ねる。
// 画面回転・リサイズ時に ResizeObserver で表示サイズを再計算する。
export function NumberOverlay({ image, showAll }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 既定では合計チップのみ。展開時は全数字を表示する。
  const visible = showAll
    ? image.numbers
    : image.numbers.filter((n) => n.isTotal);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0">
      {size.width > 0 &&
        visible.map((n) => {
          const rect = scaleBox(
            n.bbox,
            image.width,
            image.height,
            size.width,
            size.height,
          );
          // 手動追加など bbox を持たない数字はオーバーレイに描画しない
          if (rect.width <= 0 || rect.height <= 0) return null;
          return (
            <div key={n.id} className="pointer-events-auto">
              <NumberChip
                number={n}
                style={{
                  left: `${rect.left}px`,
                  top: `${rect.top}px`,
                  // チップが小さすぎてもタップしやすいよう最小サイズはCSS側で担保
                  minWidth: `${Math.max(rect.width, 28)}px`,
                }}
              />
            </div>
          );
        })}
    </div>
  );
}
