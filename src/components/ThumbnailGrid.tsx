import { useEffect, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ThumbnailItem } from './ThumbnailItem';
import type { ImageItem, GridConfig } from '@/types';

interface ThumbnailGridProps {
  items: ImageItem[];
  selectedIndex: number;
  selectedIndices: Set<number>;
  gridConfig: GridConfig;
  containerRef: React.RefObject<HTMLDivElement>;
  onSelect: (index: number, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => void;
  onEnterDetail: () => void;
}

/**
 * High-performance thumbnail grid with virtualization
 *
 * Performance optimizations:
 * 1. CSS Grid with auto-fill handles responsive columns (no JS per-frame)
 * 2. Virtualization only renders visible rows
 * 3. Memoized row height calculation
 * 4. Minimal re-renders through careful dependency management
 */
export function ThumbnailGrid({
  items,
  selectedIndex,
  selectedIndices,
  gridConfig,
  containerRef,
  onSelect,
  onEnterDetail,
}: ThumbnailGridProps) {
  const { columns, thumbnailSize, gap, rowGap } = gridConfig;

  // Calculate row metrics
  const rowCount = useMemo(
    () => Math.ceil(items.length / columns),
    [items.length, columns]
  );

  const rowHeight = useMemo(
    () => thumbnailSize + rowGap,
    [thumbnailSize, rowGap]
  );

  // Stable row height getter for virtualizer
  const getRowHeight = useCallback(() => rowHeight, [rowHeight]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: getRowHeight,
    overscan: 2, // Reduced overscan for better performance
  });

  // Update virtualizer when size changes (debounced by useGridConfig)
  useEffect(() => {
    virtualizer.measure();
  }, [thumbnailSize, columns, virtualizer]);

  // Scroll to show selected item
  useEffect(() => {
    if (selectedIndex < 0 || items.length === 0) return;

    const selectedRow = Math.floor(selectedIndex / columns);
    virtualizer.scrollToIndex(selectedRow, {
      align: 'auto',
      behavior: 'auto',
    });
  }, [selectedIndex, columns, virtualizer, items.length]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto"
      style={{ contain: 'strict' }} // CSS containment for performance
    >
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowStartIndex = virtualRow.index * columns;
          const rowItems = items.slice(rowStartIndex, rowStartIndex + columns);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 w-full px-4"
              style={{
                top: `${virtualRow.start}px`,
                height: `${rowHeight}px`,
              }}
            >
              {/* CSS Grid handles responsive column sizing */}
              <div
                className="grid w-full"
                style={{
                  gridTemplateColumns: `repeat(${columns}, 1fr)`,
                  gap: `${gap}px`,
                }}
              >
                {rowItems.map((item, indexInRow) => {
                  const itemIndex = rowStartIndex + indexInRow;
                  const isSelected = itemIndex === selectedIndex;
                  const isMultiSelected = selectedIndices.has(itemIndex);

                  return (
                    <ThumbnailItem
                      key={item.filename}
                      item={item}
                      size={thumbnailSize}
                      isSelected={isSelected}
                      isMultiSelected={isMultiSelected}
                      onClick={(event) => onSelect(itemIndex, event)}
                      onDoubleClick={onEnterDetail}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
