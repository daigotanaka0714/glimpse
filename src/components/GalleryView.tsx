import { useEffect, useState, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, XCircle, CheckCircle, Layers } from 'lucide-react';
import type { ImageItem } from '@/types';
import { toAssetUrl } from '@/utils/tauri';
import { useTranslation } from '@/i18n';
import { isMac } from '@/utils/platform';

interface GalleryViewProps {
  items: ImageItem[];
  selectedIndex: number;
  onClose: () => void;
  onSelect: (index: number) => void;
  onToggleLabel: () => void;
  onBatchToggleLabel: (indices: number[], label: 'rejected' | null) => void;
}

export function GalleryView({
  items,
  selectedIndex,
  onClose,
  onSelect,
  onToggleLabel,
  onBatchToggleLabel,
}: GalleryViewProps) {
  const t = useTranslation();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [selectedThumbnails, setSelectedThumbnails] = useState<Set<number>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const thumbnailStripRef = useRef<HTMLDivElement>(null);
  const selectedThumbnailRef = useRef<HTMLButtonElement>(null);

  const currentItem = items[selectedIndex];
  const isRejected = currentItem?.label === 'rejected';
  const hasMultiSelection = selectedThumbnails.size > 1;

  // Reset when image changes
  useEffect(() => {
    setImageLoaded(false);
  }, [currentItem?.path]);

  // Scroll selected thumbnail into view
  useEffect(() => {
    if (selectedThumbnailRef.current && thumbnailStripRef.current) {
      const container = thumbnailStripRef.current;
      const thumbnail = selectedThumbnailRef.current;

      const containerRect = container.getBoundingClientRect();
      const thumbnailRect = thumbnail.getBoundingClientRect();

      // Check if thumbnail is outside visible area
      if (thumbnailRect.left < containerRect.left || thumbnailRect.right > containerRect.right) {
        thumbnail.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [selectedIndex]);

  const handlePrevious = useCallback(() => {
    if (selectedIndex > 0) {
      onSelect(selectedIndex - 1);
      setSelectedThumbnails(new Set());
    }
  }, [selectedIndex, onSelect]);

  const handleNext = useCallback(() => {
    if (selectedIndex < items.length - 1) {
      onSelect(selectedIndex + 1);
      setSelectedThumbnails(new Set());
    }
  }, [selectedIndex, items.length, onSelect]);

  const handleThumbnailClick = useCallback((index: number, e: React.MouseEvent) => {
    const isModifierKey = isMac() ? e.metaKey : e.ctrlKey;
    const isShiftKey = e.shiftKey;

    if (isShiftKey && lastClickedIndex !== null) {
      // Range selection
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newSelection = new Set<number>();
      for (let i = start; i <= end; i++) {
        newSelection.add(i);
      }
      setSelectedThumbnails(newSelection);
    } else if (isModifierKey) {
      // Toggle selection
      setSelectedThumbnails(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(index)) {
          newSelection.delete(index);
        } else {
          newSelection.add(index);
        }
        return newSelection;
      });
      setLastClickedIndex(index);
    } else {
      // Single click - select and show in main view
      onSelect(index);
      setSelectedThumbnails(new Set());
      setLastClickedIndex(index);
    }
  }, [lastClickedIndex, onSelect]);

  const handleBatchMarkRejected = useCallback(() => {
    const indices = Array.from(selectedThumbnails);
    onBatchToggleLabel(indices, 'rejected');
    setSelectedThumbnails(new Set());
  }, [selectedThumbnails, onBatchToggleLabel]);

  const handleBatchMarkAdopted = useCallback(() => {
    const indices = Array.from(selectedThumbnails);
    onBatchToggleLabel(indices, null);
    setSelectedThumbnails(new Set());
  }, [selectedThumbnails, onBatchToggleLabel]);

  const handleClearSelection = useCallback(() => {
    setSelectedThumbnails(new Set());
  }, []);

  // Keyboard handler for batch operations in gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasMultiSelection) {
        e.preventDefault();
        setSelectedThumbnails(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMultiSelection]);

  if (!currentItem) {
    return null;
  }

  const modKey = isMac() ? '⌘' : 'Ctrl';

  return (
    <div className="fixed inset-0 z-50 bg-bg-primary flex flex-col animate-fade-in">
      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Navigation button - left */}
        {selectedIndex > 0 && (
          <button
            onClick={handlePrevious}
            className="absolute left-4 z-10 p-3 rounded-full bg-theme-hover hover:bg-theme-active transition-colors"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        {/* Main image */}
        <div className="relative w-full h-full flex items-center justify-center p-8">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-border-color border-t-accent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={toAssetUrl(currentItem.path)}
            alt={currentItem.filename}
            className={`
              w-auto h-auto max-w-full max-h-full object-contain
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
              ${isRejected ? 'opacity-50' : ''}
              transition-opacity duration-200
            `}
            onLoad={() => setImageLoaded(true)}
          />
          {/* Rejected mark */}
          {isRejected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 h-32 rounded-full bg-rejected/50 flex items-center justify-center">
                <X size={80} className="text-white" strokeWidth={3} />
              </div>
            </div>
          )}
        </div>

        {/* Navigation button - right */}
        {selectedIndex < items.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 z-10 p-3 rounded-full bg-theme-hover hover:bg-theme-active transition-colors"
          >
            <ChevronRight size={32} />
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-theme-hover hover:bg-theme-active transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Batch action bar (when multiple thumbnails selected) */}
      {hasMultiSelection && (
        <div className="h-12 px-4 bg-bg-secondary/95 backdrop-blur-md border-t border-border-subtle flex items-center justify-between animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/20 border border-accent/30 rounded-full">
              <Layers size={14} className="text-accent" />
              <span className="text-sm font-medium text-accent">
                {selectedThumbnails.size} {t.galleryView.selected}
              </span>
            </div>
            <button
              onClick={handleClearSelection}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary hover:bg-theme-hover rounded-md transition-all"
            >
              <X size={14} />
              <span>{t.galleryView.clear}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchMarkRejected}
              className="group flex items-center gap-2 px-4 py-2 bg-rejected/10 hover:bg-rejected/20 border border-rejected/30 hover:border-rejected/50 text-rejected rounded-lg transition-all"
            >
              <XCircle size={16} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">{t.galleryView.markRejected}</span>
            </button>
            <button
              onClick={handleBatchMarkAdopted}
              className="group flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 hover:border-green-500/50 text-green-600 rounded-lg transition-all"
            >
              <CheckCircle size={16} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">{t.galleryView.markAdopted}</span>
            </button>
          </div>
        </div>
      )}

      {/* Thumbnail strip */}
      <div className="h-28 bg-bg-tertiary border-t border-border-subtle px-4">
        <div
          ref={thumbnailStripRef}
          className="h-full flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-border-color scrollbar-track-transparent py-2"
        >
          {items.map((item, index) => {
            const isCurrentImage = index === selectedIndex;
            const isInMultiSelection = selectedThumbnails.has(index);
            const isThumbnailRejected = item.label === 'rejected';

            return (
              <button
                key={item.filename}
                ref={isCurrentImage ? selectedThumbnailRef : null}
                onClick={(e) => handleThumbnailClick(index, e)}
                className={`
                  relative flex-shrink-0 w-18 h-18 rounded-lg overflow-hidden transition-all
                  ${isCurrentImage
                    ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-tertiary scale-110'
                    : isInMultiSelection
                      ? 'ring-2 ring-accent/70 ring-offset-1 ring-offset-bg-tertiary'
                      : 'hover:ring-1 hover:ring-border-color'
                  }
                  ${isThumbnailRejected && !isInMultiSelection ? 'opacity-50' : ''}
                `}
                style={{ width: '72px', height: '72px' }}
              >
                {item.thumbnailLoaded && item.thumbnailPath ? (
                  <img
                    src={toAssetUrl(item.thumbnailPath)}
                    alt={item.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full rounded thumbnail-loading" />
                )}
                {/* Multi-selection indicator */}
                {isInMultiSelection && (
                  <div className="absolute top-1 left-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                    <CheckCircle size={12} className="text-white" />
                  </div>
                )}
                {/* Rejected indicator */}
                {isThumbnailRejected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-rejected/30">
                    <X size={20} className="text-white" strokeWidth={3} />
                  </div>
                )}
                {/* Index indicator */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-center py-0.5">
                  <span className="text-[10px] text-white/70">{index + 1}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer info bar */}
      <div className="h-14 px-6 bg-bg-secondary border-t border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-mono text-sm">{currentItem.filename}</span>
          <span className="text-text-muted text-sm">
            {(currentItem.size / 1024 / 1024).toFixed(1)} MB
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-text-muted">
            {selectedIndex + 1} / {items.length}
          </span>

          <button
            onClick={onToggleLabel}
            className={`
              px-4 py-2 rounded-lg font-medium text-sm transition-colors
              ${isRejected
                ? 'bg-rejected text-white'
                : 'bg-bg-tertiary hover:bg-theme-hover text-text-secondary'
              }
            `}
          >
            <span className="mr-2">1</span>
            {isRejected ? t.galleryView.rejected : t.galleryView.reject}
            {isRejected && ' ✓'}
          </button>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="h-10 px-6 bg-bg-tertiary border-t border-border-subtle flex items-center justify-center">
        <span className="text-sm text-text-muted">
          ← → {t.galleryView.navigate} | 1 {t.galleryView.reject} | {modKey}+{t.galleryView.clickMultiSelect} | Shift+{t.galleryView.clickRangeSelect} | ESC {t.galleryView.close}
        </span>
      </div>
    </div>
  );
}
