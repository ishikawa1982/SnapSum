export interface PreparedImage {
  blob: Blob; // OCR に渡す（リサイズ済み）画像
  src: string; // プレビュー表示用 object URL
  width: number; // リサイズ後の幅（= OCR 座標系の基準）
  height: number; // リサイズ後の高さ
}

// 非機能要件: 取り込み画像は長辺 1,500〜2,000px 程度にリサイズしてから OCR にかける。
// リサイズ後の画像を OCR・表示の両方で使うことで、bbox 座標系と表示画像を一致させる。
const MAX_LONG_EDGE = 1800;

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

  const blob = await canvasToBlob(canvas);
  const src = URL.createObjectURL(blob);

  return { blob, src, width, height };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('画像の変換に失敗しました'));
      },
      'image/jpeg',
      0.92,
    );
  });
}
