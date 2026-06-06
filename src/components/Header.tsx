import { useAppStore } from '../lib/store';

export function Header() {
  const images = useAppStore((s) => s.images);
  const clearAll = useAppStore((s) => s.clearAll);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const hasImages = images.length > 0;

  const handleReset = () => {
    if (window.confirm('全ての画像・選択・合計をリセットしますか？')) {
      clearAll();
    }
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur pt-safe">
      <div className="flex items-baseline gap-2">
        <h1 className="text-xl font-bold tracking-tight text-brand">SnapSum</h1>
        <span className="text-xs text-slate-400">撮る、足す。</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={clearSelection}
          disabled={!hasImages}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
        >
          選択解除
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!hasImages}
          className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          リセット
        </button>
      </div>
    </header>
  );
}
