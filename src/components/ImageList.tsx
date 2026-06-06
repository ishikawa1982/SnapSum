import { useAppStore } from '../lib/store';
import { ImageCard } from './ImageCard';

export function ImageList() {
  const images = useAppStore((s) => s.images);

  if (images.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {images.map((img, i) => (
        <ImageCard key={img.id} image={img} index={i} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/10 text-4xl">
        📸
      </div>
      <div>
        <p className="text-lg font-semibold text-slate-700">
          写真を撮って、数字をタップ
        </p>
        <p className="mt-1 text-sm text-slate-500">
          レシートや値札を撮影すると、写った数字を読み取ります。
          <br />
          タップした数字の合計がすぐに出ます。
        </p>
      </div>
      <p className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
        🔒 画像は端末の外に送信されません
      </p>
    </div>
  );
}
