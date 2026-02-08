import { X, XCircle, CheckCircle, Layers } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface BatchActionBarProps {
  selectedCount: number;
  filteredCount: number;
  filterMode: 'all' | 'adopted' | 'rejected';
  onMarkRejected: () => void;
  onRemoveRejected: () => void;
  onMarkAllRejected: () => void;
  onRemoveAllRejected: () => void;
  onClearSelection: () => void;
}

export function BatchActionBar({
  selectedCount,
  filteredCount,
  filterMode,
  onMarkRejected,
  onRemoveRejected,
  onMarkAllRejected,
  onRemoveAllRejected,
  onClearSelection,
}: BatchActionBarProps) {
  const t = useTranslation();

  if (selectedCount <= 1) return null;

  const filterModeLabel = filterMode === 'all'
    ? t.batchActions.all
    : filterMode === 'adopted'
    ? t.batchActions.adopted
    : t.batchActions.rejected;

  return (
    <div className="animate-slide-up">
      {/* Glass effect action bar */}
      <div className="flex items-center justify-between h-12 px-4 bg-bg-secondary/95 backdrop-blur-md border-b border-border-subtle shadow-lg">
        {/* Left side: Selection info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 border border-accent/30 rounded-full">
            <Layers size={14} className="text-accent" />
            <span className="text-sm font-medium text-accent">
              {selectedCount} {t.batchActions.selected}
            </span>
          </div>

          <button
            onClick={onClearSelection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-theme-hover rounded-md transition-all"
            title={t.batchActions.clearSelection}
          >
            <X size={14} />
            <span>{t.batchActions.clear}</span>
          </button>
        </div>

        {/* Center: Batch actions */}
        <div className="flex items-center gap-2">
          {/* Mark selected images as rejected */}
          <button
            onClick={onMarkRejected}
            className="group flex items-center gap-2 px-4 py-2 bg-rejected/10 hover:bg-rejected/20 border border-rejected/30 hover:border-rejected/50 text-rejected rounded-lg transition-all duration-200"
            title={t.batchActions.markRejected}
          >
            <XCircle size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">{t.batchActions.markRejected}</span>
          </button>

          {/* Remove rejected label from selected images */}
          <button
            onClick={onRemoveRejected}
            className="group flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-600 rounded-lg transition-all duration-200"
            title={t.batchActions.markAdopted}
          >
            <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">{t.batchActions.markAdopted}</span>
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-border-subtle mx-2" />

          {/* Apply to all filtered images */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-subtle">
              {filterModeLabel} {filteredCount}:
            </span>
            <button
              onClick={onMarkAllRejected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-rejected hover:bg-rejected/10 border border-border-subtle hover:border-rejected/30 rounded-md transition-all"
              title={t.batchActions.batchReject}
            >
              <XCircle size={12} />
              <span>{t.batchActions.batchReject}</span>
            </button>
            <button
              onClick={onRemoveAllRejected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-green-600 hover:bg-green-500/10 border border-border-subtle hover:border-green-500/30 rounded-md transition-all"
              title={t.batchActions.batchClear}
            >
              <CheckCircle size={12} />
              <span>{t.batchActions.batchClear}</span>
            </button>
          </div>
        </div>

        {/* Right side: Keyboard hints */}
        <div className="flex items-center gap-2 text-xs text-text-subtle">
          <span>Esc: {t.batchActions.clearSelection}</span>
          <span className="text-border-color">|</span>
          <span>1: {t.batchActions.toggleReject}</span>
        </div>
      </div>
    </div>
  );
}
