import type { ImageItem } from '@/types';

interface StatusBarProps {
  selectedItem: ImageItem | null;
  selectedIndex: number;
  totalItems: number;
  selectedCount?: number;
}

export function StatusBar({
  selectedItem,
  selectedIndex,
  totalItems,
  selectedCount = 0,
}: StatusBarProps) {
  if (!selectedItem) {
    return (
      <footer className="h-10 px-4 bg-bg-secondary border-t border-border-color flex items-center">
        <span className="text-sm text-text-secondary">
          ← → ↑ ↓: 移動 | 1: 不採用 | Enter: 詳細表示 | Ctrl+O: フォルダを開く | Ctrl/⌘+クリック: 複数選択
        </span>
      </footer>
    );
  }

  const isRejected = selectedItem.label === 'rejected';

  return (
    <footer className="h-10 px-4 bg-bg-secondary border-t border-border-color flex items-center justify-between">
      <div className="flex items-center gap-4 text-sm">
        <span className="font-mono text-text-primary">{selectedItem.filename}</span>
        <span className="text-text-secondary">
          {(selectedItem.size / 1024 / 1024).toFixed(1)} MB
        </span>
        <span className="text-text-secondary">{selectedItem.modifiedAt}</span>
      </div>

      <div className="flex items-center gap-4 text-sm">
        {selectedCount > 1 && (
          <span className="px-2 py-0.5 rounded bg-accent/20 text-accent">
            {selectedCount}件選択中
          </span>
        )}
        <span
          className={`px-2 py-0.5 rounded ${
            isRejected ? 'bg-rejected/20 text-rejected' : 'text-text-secondary'
          }`}
        >
          {isRejected ? '不採用' : '-'}
        </span>
        <span className="text-text-secondary">
          {selectedIndex + 1} / {totalItems}
        </span>
      </div>
    </footer>
  );
}
