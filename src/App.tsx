import { useState } from 'react';
import { Header } from './components/Header';
import { ImageList } from './components/ImageList';
import { TotalBar } from './components/TotalBar';
import { ActionBar } from './components/ActionBar';
import { ManualAddModal } from './components/ManualAddModal';
import { SettingsModal } from './components/SettingsModal';
import { hasApiKey } from './lib/settings';

export default function App() {
  const [manualOpen, setManualOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 設定モーダルを閉じたときに AI 有効状態を取り直す
  const [aiEnabled, setAiEnabled] = useState(hasApiKey());

  return (
    <div className="mx-auto flex h-full max-w-md flex-col bg-slate-100">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        aiEnabled={aiEnabled}
      />

      <main className="flex-1 overflow-y-auto">
        <ImageList aiEnabled={aiEnabled} onOpenSettings={() => setSettingsOpen(true)} />
      </main>

      <TotalBar />

      <ActionBar onManualAdd={() => setManualOpen(true)} />

      <ManualAddModal open={manualOpen} onClose={() => setManualOpen(false)} />
      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setAiEnabled(hasApiKey());
        }}
      />
    </div>
  );
}
