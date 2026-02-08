import { useState, useEffect, useRef, useCallback } from 'react';
import type { GridConfig } from '@/types';

const MIN_THUMBNAIL_SIZE = 100;
const MAX_THUMBNAIL_SIZE = 300;
const DEFAULT_THUMBNAIL_SIZE = 180;
const GAP = 8;
const ROW_GAP = 12;

interface UseGridConfigReturn {
  config: GridConfig;
  containerRef: React.RefObject<HTMLDivElement>;
  setBaseThumbnailSize: (size: number) => void;
  minSize: number;
  maxSize: number;
}

/**
 * Debounce function - delays execution until pause in calls
 */
function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * High-performance grid configuration hook
 *
 * Key optimizations:
 * 1. Uses ResizeObserver instead of window resize (more efficient)
 * 2. Debounces resize callbacks (200ms) to prevent excessive updates
 * 3. Only calculates column count - CSS Grid handles actual sizing
 * 4. Memoizes calculations to prevent unnecessary re-renders
 */
export function useGridConfig(): UseGridConfigReturn {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [baseThumbnailSize, setBaseThumbnailSize] = useState(DEFAULT_THUMBNAIL_SIZE);
  const [config, setConfig] = useState<GridConfig>({
    columns: 6,
    thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
    gap: GAP,
    rowGap: ROW_GAP,
  });

  // Calculate grid configuration based on container width
  const calculateGrid = useCallback((containerWidth: number) => {
    if (containerWidth <= 0) return;

    // Calculate how many columns fit
    const columns = Math.max(
      1,
      Math.floor((containerWidth + GAP) / (baseThumbnailSize + GAP))
    );

    // Calculate actual thumbnail size to fill width evenly
    // This is used for virtualizer row height calculation
    const thumbnailSize = Math.floor(
      (containerWidth - GAP * (columns - 1)) / columns
    );

    setConfig((prev) => {
      // Only update if values actually changed
      if (prev.columns === columns && prev.thumbnailSize === thumbnailSize) {
        return prev;
      }
      return {
        columns,
        thumbnailSize,
        gap: GAP,
        rowGap: ROW_GAP,
      };
    });
  }, [baseThumbnailSize]);

  // Set up ResizeObserver with debounce
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial calculation
    calculateGrid(container.clientWidth);

    // Debounced resize handler - 200ms delay prevents excessive updates
    const debouncedCalculate = debounce((entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (entry) {
        calculateGrid(entry.contentRect.width);
      }
    }, 200);

    const resizeObserver = new ResizeObserver(debouncedCalculate);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateGrid]);

  // Recalculate when base thumbnail size changes (from slider)
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      calculateGrid(container.clientWidth);
    }
  }, [baseThumbnailSize, calculateGrid]);

  return {
    config,
    containerRef,
    setBaseThumbnailSize,
    minSize: MIN_THUMBNAIL_SIZE,
    maxSize: MAX_THUMBNAIL_SIZE,
  };
}
