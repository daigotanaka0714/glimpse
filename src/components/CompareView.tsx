import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImageItem } from '@/types';
import { toAssetUrl } from '@/utils/tauri';

interface CompareViewProps {
  leftItem: ImageItem;
  rightItem: ImageItem;
  totalItems: number;
  onClose: () => void;
  onSelectLeft: (index: number) => void;
  onSelectRight: (index: number) => void;
  onToggleLabelLeft: () => void;
  onToggleLabelRight: () => void;
}

export function CompareView({
  leftItem,
  rightItem,
  totalItems,
  onClose,
  onSelectLeft,
  onSelectRight,
  onToggleLabelLeft,
  onToggleLabelRight,
}: CompareViewProps) {
  const [leftLoaded, setLeftLoaded] = useState(false);
  const [rightLoaded, setRightLoaded] = useState(false);

  // Reset when image changes
  useEffect(() => {
    setLeftLoaded(false);
  }, [leftItem.path]);

  useEffect(() => {
    setRightLoaded(false);
  }, [rightItem.path]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
      >
        <X size={24} />
      </button>

      {/* Compare area */}
      <div className="flex-1 flex">
        {/* Left image */}
        <ComparePanel
          item={leftItem}
          side="left"
          isLoaded={leftLoaded}
          onLoad={() => setLeftLoaded(true)}
          onPrevious={leftItem.index > 0 ? () => onSelectLeft(leftItem.index - 1) : undefined}
          onNext={leftItem.index < totalItems - 1 ? () => onSelectLeft(leftItem.index + 1) : undefined}
          onToggleLabel={onToggleLabelLeft}
        />

        {/* Center divider */}
        <div className="w-1 bg-white/20" />

        {/* Right image */}
        <ComparePanel
          item={rightItem}
          side="right"
          isLoaded={rightLoaded}
          onLoad={() => setRightLoaded(true)}
          onPrevious={rightItem.index > 0 ? () => onSelectRight(rightItem.index - 1) : undefined}
          onNext={rightItem.index < totalItems - 1 ? () => onSelectRight(rightItem.index + 1) : undefined}
          onToggleLabel={onToggleLabelRight}
        />
      </div>

      {/* Footer */}
      <div className="h-12 px-6 bg-bg-secondary border-t border-white/10 flex items-center justify-center">
        <span className="text-sm text-white/50">
          ← → to navigate left image | Shift + ← → to navigate right image | 1 to reject left | 2 to reject right | ESC to close
        </span>
      </div>
    </div>
  );
}

interface ComparePanelProps {
  item: ImageItem;
  side: 'left' | 'right';
  isLoaded: boolean;
  onLoad: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onToggleLabel: () => void;
}

function ComparePanel({
  item,
  side,
  isLoaded,
  onLoad,
  onPrevious,
  onNext,
  onToggleLabel,
}: ComparePanelProps) {
  const isRejected = item.label === 'rejected';

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Image area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4">
        {/* Navigation button - left */}
        {onPrevious && (
          <button
            onClick={onPrevious}
            className="absolute left-2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Image */}
        <div className="relative max-w-full max-h-full">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
          <img
            src={toAssetUrl(item.path)}
            alt={item.filename}
            className={`
              max-w-full max-h-[calc(100vh-160px)] object-contain
              ${isLoaded ? 'opacity-100' : 'opacity-0'}
              ${isRejected ? 'opacity-50' : ''}
              transition-opacity duration-200
            `}
            onLoad={onLoad}
          />
          {/* Rejected mark */}
          {isRejected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-24 h-24 rounded-full bg-rejected/50 flex items-center justify-center">
                <X size={60} className="text-white" strokeWidth={3} />
              </div>
            </div>
          )}
        </div>

        {/* Navigation button - right */}
        {onNext && (
          <button
            onClick={onNext}
            className="absolute right-2 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Info bar */}
      <div className="h-14 px-4 bg-bg-tertiary border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs truncate">{item.filename}</span>
          <span className="text-white/50 text-xs flex-shrink-0">
            {(item.size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>
        <button
          onClick={onToggleLabel}
          className={`
            px-3 py-1.5 rounded-lg font-medium text-xs transition-colors flex-shrink-0
            ${isRejected
              ? 'bg-rejected text-white'
              : 'bg-bg-secondary hover:bg-white/10 text-white/70'
            }
          `}
        >
          <span className="mr-1">{side === 'left' ? '1' : '2'}</span>
          Reject{isRejected ? ' ✓' : ''}
        </button>
      </div>
    </div>
  );
}
