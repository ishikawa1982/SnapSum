import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../lib/store';

interface Props {
  open: boolean;
  onClose: () => void;
}

// OCR で拾えなかった金額をテキスト入力で追加するモーダル。
export function ManualAddModal({ open, onClose }: Props) {
  const addManualNumber = useAppStore((s) => s.addManualNumber);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText('');
      // モーダル表示直後にフォーカス
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const v = Number(text.replace(/[,，¥￥円\s]/g, ''));
    if (Number.isFinite(v) && v !== 0) {
      addManualNumber(v);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="手動で金額を追加"
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-safe sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-bold text-slate-800">
          手動で金額を追加
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          読み取れなかった金額を入力してください。追加した金額は選択済みになります。
        </p>

        <div className="flex items-center rounded-xl border-2 border-slate-200 px-3 focus-within:border-brand">
          <span className="text-xl font-bold text-slate-400">¥</span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="1280"
            className="w-full bg-transparent px-2 py-3 text-2xl font-bold tabular-nums outline-none"
          />
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-3 font-medium text-slate-600 hover:bg-slate-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex-1 rounded-xl bg-brand py-3 font-bold text-white hover:bg-brand-dark"
          >
            追加する
          </button>
        </div>
      </div>
    </div>
  );
}
