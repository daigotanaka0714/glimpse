import { useState, useEffect, useCallback } from 'react';
import type { GridConfig } from '@/types';

const MIN_THUMBNAIL_SIZE = 100;
const MAX_THUMBNAIL_SIZE = 300;
const DEFAULT_THUMBNAIL_SIZE = 180;
const GAP = 8;
const ROW_GAP = 12; // Vertical gap (slightly wider than horizontal)
const PADDING = 16;

interface UseGridConfigReturn {
  config: GridConfig;
  setBaseThumbnailSize: (size: number) => void;
  minSize: number;
  maxSize: number;
}

export function useGridConfig(): UseGridConfigReturn {
  const [baseThumbnailSize, setBaseThumbnailSize] = useState(DEFAULT_THUMBNAIL_SIZE);
  const [config, setConfig] = useState<GridConfig>({
    columns: 16,
    thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
    gap: GAP,
    rowGap: ROW_GAP,
  });

  const calculateGrid = useCallback(() => {
    const containerWidth = window.innerWidth - PADDING * 2;
    const columns = Math.floor(
      (containerWidth + GAP) / (baseThumbnailSize + GAP)
    );
    const actualColumns = Math.max(1, columns);

    // Adjust thumbnail size to fit available width
    const thumbnailSize = Math.floor(
      (containerWidth - GAP * (actualColumns - 1)) / actualColumns
    );

    setConfig({
      columns: actualColumns,
      thumbnailSize,
      gap: GAP,
      rowGap: ROW_GAP,
    });
  }, [baseThumbnailSize]);

  useEffect(() => {
    calculateGrid();

    const handleResize = () => {
      calculateGrid();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateGrid]);

  return {
    config,
    setBaseThumbnailSize,
    minSize: MIN_THUMBNAIL_SIZE,
    maxSize: MAX_THUMBNAIL_SIZE,
  };
}
