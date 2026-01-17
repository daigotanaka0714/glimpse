import type { ImageItem } from '@/types';

interface StatusBarProps {
  selectedItem: ImageItem | null;
  selectedIndex: number;
  totalItems: number;
}

export function StatusBar({
  selectedItem,
  selectedIndex,
  totalItems,
}: StatusBarProps) {
  if (!selectedItem) {
    return (
      <footer className="h-10 px-4 bg-bg-secondary border-t border-white/10 flex items-center">
        <span className="text-sm text-white/50">
          ← → ↑ ↓: 移動 | 1: 不採用 | Enter: 詳細表示 | Ctrl+O: フォルダを開く
        </span>
      </footer>
    );
  }

  const isRejected = selectedItem.label === 'rejected';

  return (
    <footer className="h-10 px-4 bg-bg-secondary border-t border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-4 text-sm">
        <span className="font-mono text-white">{selectedItem.filename}</span>
        <span className="text-white/50">
          {(selectedItem.size / 1024 / 1024).toFixed(1)} MB
        </span>
        <span className="text-white/50">{selectedItem.modifiedAt}</span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span
          className={`px-2 py-0.5 rounded ${
            isRejected ? 'bg-rejected/20 text-rejected' : 'text-white/50'
          }`}
        >
          {isRejected ? '不採用' : '-'}
        </span>
        <span className="text-white/50">
          {selectedIndex + 1} / {totalItems}
        </span>
      </div>
    </footer>
  );
}
