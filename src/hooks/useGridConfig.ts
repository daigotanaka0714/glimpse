import { useState, useEffect, useCallback } from 'react';
import type { GridConfig } from '@/types';

const DEFAULT_THUMBNAIL_SIZE = 180;
const GAP = 8;
const PADDING = 16;

export function useGridConfig(): GridConfig {
  const [config, setConfig] = useState<GridConfig>({
    columns: 16,
    thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
    gap: GAP,
  });

  const calculateGrid = useCallback(() => {
    const containerWidth = window.innerWidth - PADDING * 2;
    const columns = Math.floor(
      (containerWidth + GAP) / (DEFAULT_THUMBNAIL_SIZE + GAP)
    );
    const actualColumns = Math.max(1, columns);

    // 利用可能な幅に合わせてサムネイルサイズを調整
    const thumbnailSize = Math.floor(
      (containerWidth - GAP * (actualColumns - 1)) / actualColumns
    );

    setConfig({
      columns: actualColumns,
      thumbnailSize,
      gap: GAP,
    });
  }, []);

  useEffect(() => {
    calculateGrid();

    const handleResize = () => {
      calculateGrid();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateGrid]);

  return config;
}
