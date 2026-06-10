const PARAM = 's';

// Build a shareable URL from selected number values using URL hash.
// Hash fragments are preserved by PWA navigation and service worker caching.
export function buildShareUrl(values: number[]): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = PARAM + '=' + encodeURIComponent(values.join(','));
  return url.toString();
}

// Decode shared number values from URL hash. Returns null if no valid data.
export function decodeShareHash(hash: string): number[] | null {
  if (!hash || hash === '#') return null;
  const params = new URLSearchParams(hash.slice(1));
  const raw = params.get(PARAM);
  if (!raw) return null;
  const values = raw
    .split(',')
    .map(Number)
    .filter((n) => Number.isFinite(n) && n !== 0);
  return values.length > 0 ? values : null;
}
