import { useRef } from 'react';
import { useAppStore } from '../lib/store';

interface Props {
  onManualAdd: () => void;
}

// 写真追加（file input 起動）と手動追加の 2 アクション。
export function ActionBar({ onManualAdd }: Props) {
  const addImage = useAppStore((s) => s.addImage);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    // 複数選択にも対応して順次取り込む
    Array.from(files).forEach((file) => {
      void addImage(file);
    });
    // 同じファイルを連続で選べるよう値をリセット
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3 pb-safe">
      <div className="flex gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3.5 font-bold text-white shadow-sm hover:bg-brand-dark active:scale-[0.99]"
        >
          <span aria-hidden>＋</span> 写真を追加
        </button>
        <button
          type="button"
          onClick={onManualAdd}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-brand/30 bg-white px-5 py-3.5 font-bold text-brand hover:bg-brand/5 active:scale-[0.99]"
        >
          <span aria-hidden>✎</span> 手動
        </button>
      </div>
    </div>
  );
}
