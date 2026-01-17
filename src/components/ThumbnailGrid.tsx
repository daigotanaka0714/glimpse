import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ThumbnailItem } from './ThumbnailItem';
import type { ImageItem, GridConfig } from '@/types';

interface ThumbnailGridProps {
  items: ImageItem[];
  selectedIndex: number;
  selectedIndices: Set<number>;
  gridConfig: GridConfig;
  onSelect: (index: number, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => void;
  onEnterDetail: () => void;
}

export function ThumbnailGrid({
  items,
  selectedIndex,
  selectedIndices,
  gridConfig,
  onSelect,
  onEnterDetail,
}: ThumbnailGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { columns, thumbnailSize, gap, rowGap } = gridConfig;

  const rowCount = Math.ceil(items.length / columns);
  const rowHeight = thumbnailSize + rowGap;

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });

  // 選択アイテムが表示されるようにスクロール
  useEffect(() => {
    const selectedRow = Math.floor(selectedIndex / columns);
    virtualizer.scrollToIndex(selectedRow, {
      align: 'auto',
      behavior: 'auto',
    });
  }, [selectedIndex, columns, virtualizer]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-white/50">
          <p className="text-lg mb-2">写真がありません</p>
          <p className="text-sm">「フォルダを開く」から写真フォルダを選択してください</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto p-4">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowStartIndex = virtualRow.index * columns;
          const rowItems = items.slice(rowStartIndex, rowStartIndex + columns);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${rowHeight}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="flex"
                style={{ gap: `${gap}px` }}
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
