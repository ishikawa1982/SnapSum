import { useEffect, useState } from 'react';
import {
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  MODEL_OPTIONS,
} from '../lib/settings';

interface Props {
  open: boolean;
  onClose: () => void;
}

// AI（Claude）連携の設定。APIキーは端末のブラウザ内だけに保存される。
export function SettingsModal({ open, onClose }: Props) {
  const [key, setKey] = useState('');
  const [model, setModelState] = useState(getModel());
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setKey(getApiKey());
      setModelState(getModel());
      setShow(false);
    }
  }, [open]);

  if (!open) return null;

  const save = () => {
    setApiKey(key.trim());
    setModel(model);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="AI設定"
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-safe sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-lg font-bold text-slate-800">AIで合計を読み取る</h2>
        <p className="mb-4 text-sm text-slate-500">
          Anthropic の API キーを入れると、撮影した写真を AI が読み取り、
          <span className="font-semibold text-slate-700">合計金額を自動で検出</span>します。
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Anthropic API キー
        </label>
        <div className="flex items-center rounded-xl border-2 border-slate-200 px-3 focus-within:border-brand">
          <input
            type={show ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent py-3 font-mono text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="px-2 text-xs text-slate-400"
          >
            {show ? '隠す' : '表示'}
          </button>
        </div>

        <label className="mb-1 mt-4 block text-sm font-medium text-slate-700">
          モデル
        </label>
        <select
          value={model}
          onChange={(e) => setModelState(e.target.value)}
          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-brand"
        >
          {MODEL_OPTIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ この方式では写真が Anthropic のサーバーに送信されます。キーは取得元の
          利用料がかかります。キーは端末内にのみ保存され、外部には共有されません。
          <br />
          API キーは{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            console.anthropic.com
          </a>{' '}
          で取得できます。
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setApiKey('');
              setKey('');
            }}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 hover:bg-slate-50"
          >
            キー削除
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-xl bg-brand py-3 font-bold text-white hover:bg-brand-dark"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
