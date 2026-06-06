import { useAppStore } from '../lib/store';
import { ImageCard } from './ImageCard';

interface Props {
  aiEnabled: boolean;
  onOpenSettings: () => void;
}

export function ImageList({ aiEnabled, onOpenSettings }: Props) {
  const images = useAppStore((s) => s.images);

  if (images.length === 0) {
    return <EmptyState aiEnabled={aiEnabled} onOpenSettings={onOpenSettings} />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {images.map((img, i) => (
        <ImageCard key={img.id} image={img} index={i} />
      ))}
    </div>
  );
}

function EmptyState({ aiEnabled, onOpenSettings }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand/10 text-4xl">
        📸
      </div>
      {aiEnabled ? (
        <div>
          <p className="text-lg font-semibold text-slate-700">
            レシートを撮るだけ
          </p>
          <p className="mt-1 text-sm text-slate-500">
            撮影すると{' '}
            <span className="font-semibold text-emerald-700">
              AI が合計金額を自動で読み取り
            </span>
            ます。
            <br />
            複数のレシートを撮れば、合計が積み上がります。
          </p>
        </div>
      ) : (
        <div>
          <p className="text-lg font-semibold text-slate-700">
            撮って、数字をタップ
          </p>
          <p className="mt-1 text-sm text-slate-500">
            レシートを撮影し、
            <span className="font-semibold text-brand">読みたい金額をタップ</span>
            すると、その数字だけを読み取って合計します。
          </p>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            ⚙️ AIで合計を自動検出する（APIキー設定）
          </button>
        </div>
      )}
      <p className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
        {aiEnabled
          ? '☁️ 写真はAIの読み取りのため送信されます'
          : '🔒 タップ読み取りは端末内で完結します'}
      </p>
    </div>
  );
}
