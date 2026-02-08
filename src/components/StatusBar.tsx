import type { ImageItem } from '@/types';
import { useTranslation } from '@/i18n';
import { getModifierKey } from '@/utils/platform';

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
  const t = useTranslation();
  const modKey = getModifierKey();

  if (!selectedItem) {
    return (
      <footer className="h-10 px-4 bg-bg-secondary border-t border-border-color flex items-center">
        <span className="text-sm text-text-secondary">
          ← → ↑ ↓: {t.statusBar.navigation} | 1: {t.statusBar.reject} | Enter: {t.statusBar.detailView} | {modKey}+O: {t.statusBar.openFolder} | {modKey}/Click: {t.statusBar.multiSelect}
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
            {selectedCount}{t.statusBar.selected}
          </span>
        )}
        <span
          className={`px-2 py-0.5 rounded ${
            isRejected ? 'bg-rejected/20 text-rejected' : 'text-text-secondary'
          }`}
        >
          {isRejected ? t.statusBar.rejected : '-'}
        </span>
        <span className="text-text-secondary">
          {selectedIndex + 1} / {totalItems}
        </span>
      </div>
    </footer>
  );
}
