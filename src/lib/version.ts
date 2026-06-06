export const APP_VERSION = __APP_VERSION__;

// ビルド時刻を「MM/DD HH:mm」形式（日本時間）で短く表示する
export const BUILD_LABEL = (() => {
  try {
    const d = new Date(__BUILD_TIME__);
    const f = new Intl.DateTimeFormat('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Tokyo',
      hour12: false,
    });
    return f.format(d);
  } catch {
    return '';
  }
})();

// 画面に出す短いバージョン表記（例: v0.2.0 (06/07 01:23)）
export const VERSION_TEXT = `v${APP_VERSION}${
  BUILD_LABEL ? ` (${BUILD_LABEL})` : ''
}`;
