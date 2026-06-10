import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { ImageList } from './components/ImageList';
import { TotalBar } from './components/TotalBar';
import { ActionBar } from './components/ActionBar';
import { ManualAddModal } from './components/ManualAddModal';
import { useAppStore } from './lib/store';
import { decodeShareHash } from './lib/sharing';

export default function App() {
  const [manualOpen, setManualOpen] = useState(false);
  const loadSharedList = useAppStore((s) => s.loadSharedList);

  useEffect(() => {
    const shared = decodeShareHash(window.location.hash);
    if (shared) {
      loadSharedList(shared);
      // Remove hash from URL so refresh doesn't re-load the shared state
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, [loadSharedList]);

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-slate-100">
      <Header />

      {/* メイン領域: 取り込んだ画像を縦に並べてスクロール */}
      <main className="flex-1 overflow-y-auto">
        <ImageList />
      </main>

      {/* 合計バー（常時固定） */}
      <TotalBar />

      {/* アクション */}
      <ActionBar onManualAdd={() => setManualOpen(true)} />

      <ManualAddModal open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}
