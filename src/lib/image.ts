export interface PreparedImage {
  blob: Blob; // リサイズ済みの画像データ（AI へ送る・再利用する用）
  src: string; // 表示＆切り出し元になる object URL（カラー）
  width: number; // リサイズ後の幅（タップ座標の基準）
  height: number; // リサイズ後の高さ
}

// 取り込み画像は長辺 2,000px 程度にリサイズする（表示・切り出しの基準）。
// 数字の読み取りは「タップした周辺だけ」を切り出して行うため、ここでは全体 OCR はしない。
const MAX_LONG_EDGE = 2000;

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const { width: ow, height: oh } = bitmap;

  const longEdge = Math.max(ow, oh);
  const scale = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / longEdge : 1;
  const width = Math.round(ow * scale);
  const height = Math.round(oh * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas 2D コンテキストを取得できませんでした');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('画像の変換に失敗しました'))),
      'image/jpeg',
      0.92,
    );
  });
  const src = URL.createObjectURL(blob);

  return { blob, src, width, height };
}
