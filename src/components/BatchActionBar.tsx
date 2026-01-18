import { X, XCircle, CheckCircle, Layers } from 'lucide-react';

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
  if (selectedCount <= 1) return null;

  return (
    <div className="animate-slide-up">
      {/* Glass effect action bar */}
      <div className="flex items-center justify-between h-12 px-4 bg-gradient-to-r from-bg-secondary/95 via-bg-tertiary/95 to-bg-secondary/95 backdrop-blur-md border-b border-white/10 shadow-lg">
        {/* Left side: Selection info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 border border-accent/30 rounded-full">
            <Layers size={14} className="text-accent" />
            <span className="text-sm font-medium text-accent">
              {selectedCount} selected
            </span>
          </div>

          <button
            onClick={onClearSelection}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-white/60 hover:text-white/90 hover:bg-white/5 rounded-md transition-all"
            title="Clear selection"
          >
            <X size={14} />
            <span>Clear</span>
          </button>
        </div>

        {/* Center: Batch actions */}
        <div className="flex items-center gap-2">
          {/* Mark selected images as rejected */}
          <button
            onClick={onMarkRejected}
            className="group flex items-center gap-2 px-4 py-2 bg-rejected/10 hover:bg-rejected/20 border border-rejected/30 hover:border-rejected/50 text-rejected rounded-lg transition-all duration-200"
            title="Mark selected images as rejected"
          >
            <XCircle size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Mark Rejected</span>
          </button>

          {/* Remove rejected label from selected images */}
          <button
            onClick={onRemoveRejected}
            className="group flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-400 rounded-lg transition-all duration-200"
            title="Remove rejected label from selected images"
          >
            <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium">Mark Adopted</span>
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-white/10 mx-2" />

          {/* Apply to all filtered images */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">
              {filterMode === 'all' ? 'All' : filterMode === 'adopted' ? 'Adopted' : 'Rejected'}
              {' '}{filteredCount}:
            </span>
            <button
              onClick={onMarkAllRejected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-rejected hover:bg-rejected/10 border border-white/10 hover:border-rejected/30 rounded-md transition-all"
              title={`Mark ${filterMode === 'all' ? 'all' : filterMode === 'adopted' ? 'adopted images' : 'rejected images'} as rejected`}
            >
              <XCircle size={12} />
              <span>Batch Reject</span>
            </button>
            <button
              onClick={onRemoveAllRejected}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/60 hover:text-green-400 hover:bg-green-500/10 border border-white/10 hover:border-green-500/30 rounded-md transition-all"
              title={`Remove rejected label from ${filterMode === 'all' ? 'all' : filterMode === 'adopted' ? 'adopted images' : 'rejected images'}`}
            >
              <CheckCircle size={12} />
              <span>Batch Clear</span>
            </button>
          </div>
        </div>

        {/* Right side: Keyboard hints */}
        <div className="flex items-center gap-2 text-xs text-white/30">
          <span>Esc: Clear selection</span>
          <span className="text-white/20">|</span>
          <span>1: Toggle reject</span>
        </div>
      </div>
    </div>
  );
}
