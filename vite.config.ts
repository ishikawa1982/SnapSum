/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages のプロジェクトサイトはサブパス（/<repo>/）配信になるため、
// ビルド時に BASE_PATH を渡してサブパスへ対応する。ローカル開発では '/'。
const base = process.env.BASE_PATH || '/';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string };

// https://vitejs.dev/config/
export default defineConfig({
  base,
  // 画面に表示するバージョン情報をビルド時に埋め込む
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // Service Worker のキャッシュによる「古い画面が出る・白画面になる」問題を避けるため、
      // 反復開発中は PWA を自己破棄モードにして SW を無効化する。
      // （既存端末に残った古い SW も、このビルドを読み込むと自動で登録解除・キャッシュ削除される）
      // オフライン対応が必要になったら selfDestroying を外して再度有効化する。
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SnapSum',
        short_name: 'SnapSum',
        description: '撮る、足す。写真に写った数字をタップして合計するアプリ',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
