// AI（Claude）連携の設定。API キーは端末のブラウザ内（localStorage）にのみ保存し、
// リポジトリやサーバーには一切送らない。写真は読み取り時に Anthropic へ直接送信される。

const KEY_APIKEY = 'snapsum.anthropicApiKey';
const KEY_MODEL = 'snapsum.model';

// 既定モデル。精度重視で最上位の Opus を既定にしつつ、設定で変更可能にする。
export const DEFAULT_MODEL = 'claude-opus-4-8';

export const MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8（最高精度）' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6（バランス・低コスト）' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5（最速・最安）' },
];

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_APIKEY) ?? '';
  } catch {
    return '';
  }
}

export function setApiKey(value: string): void {
  try {
    if (value) localStorage.setItem(KEY_APIKEY, value);
    else localStorage.removeItem(KEY_APIKEY);
  } catch {
    // localStorage が使えない環境では何もしない
  }
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export function getModel(): string {
  try {
    return localStorage.getItem(KEY_MODEL) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

export function setModel(value: string): void {
  try {
    localStorage.setItem(KEY_MODEL, value || DEFAULT_MODEL);
  } catch {
    // noop
  }
}
