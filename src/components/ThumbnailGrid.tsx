import { useRef, useCallback, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageFile } from "../types";

interface ThumbnailGridProps {
  images: ImageFile[];
  selectedIndex: number;
  rejectedFiles: Set<string>;
  thumbnailPaths: Map<string, string>;
  thumbnailSize: number;
  columnsCount: number;
  onSelect: (index: number) => void;
  onOpenDetail: (index: number) => void;
}

export function ThumbnailGrid({
  images,
  selectedIndex,
  rejectedFiles,
  thumbnailPaths,
  thumbnailSize,
  columnsCount,
  onSelect,
  onOpenDetail,
}: ThumbnailGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(images.length / columnsCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => thumbnailSize + 8, // thumbnail + gap
    overscan: 3,
  });

  // Scroll selected item into view
  useEffect(() => {
    const rowIndex = Math.floor(selectedIndex / columnsCount);
    rowVirtualizer.scrollToIndex(rowIndex, { align: "auto" });
  }, [selectedIndex, columnsCount, rowVirtualizer]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newIndex = selectedIndex;

      switch (e.key) {
        case "ArrowLeft":
          newIndex = Math.max(0, selectedIndex - 1);
          break;
        case "ArrowRight":
          newIndex = Math.min(images.length - 1, selectedIndex + 1);
          break;
        case "ArrowUp":
          newIndex = Math.max(0, selectedIndex - columnsCount);
          break;
        case "ArrowDown":
          newIndex = Math.min(images.length - 1, selectedIndex + columnsCount);
          break;
        case "Home":
          newIndex = 0;
          break;
        case "End":
          newIndex = images.length - 1;
          break;
        case "PageUp":
          newIndex = Math.max(0, selectedIndex - columnsCount * 5);
          break;
        case "PageDown":
          newIndex = Math.min(images.length - 1, selectedIndex + columnsCount * 5);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onOpenDetail(selectedIndex);
          return;
        default:
          return;
      }

      if (newIndex !== selectedIndex) {
        e.preventDefault();
        onSelect(newIndex);
      }
    },
    [selectedIndex, images.length, columnsCount, onSelect, onOpenDetail]
  );

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-auto p-2 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnsCount;
          const rowImages = images.slice(startIndex, startIndex + columnsCount);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columnsCount}, ${thumbnailSize}px)`,
                gap: "8px",
                justifyContent: "center",
              }}
            >
              {rowImages.map((image, colIndex) => {
                const index = startIndex + colIndex;
                const isSelected = index === selectedIndex;
                const isRejected = rejectedFiles.has(image.filename);
                const thumbnailPath = thumbnailPaths.get(image.filename);

                return (
                  <ThumbnailItem
                    key={image.filename}
                    image={image}
                    thumbnailPath={thumbnailPath}
                    isSelected={isSelected}
                    isRejected={isRejected}
                    size={thumbnailSize}
                    onClick={() => onSelect(index)}
                    onDoubleClick={() => onOpenDetail(index)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ThumbnailItemProps {
  image: ImageFile;
  thumbnailPath: string | undefined;
  isSelected: boolean;
  isRejected: boolean;
  size: number;
  onClick: () => void;
  onDoubleClick: () => void;
}

function ThumbnailItem({
  image,
  thumbnailPath,
  isSelected,
  isRejected,
  size,
  onClick,
  onDoubleClick,
}: ThumbnailItemProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const imageSrc = thumbnailPath ? convertFileSrc(thumbnailPath) : null;

  return (
    <div
      className={`thumbnail-item ${isSelected ? "selected" : ""} ${isRejected ? "rejected" : ""}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {imageSrc && !error ? (
        <>
          <img
            src={imageSrc}
            alt={image.filename}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
          {!loaded && <div className="thumbnail-placeholder" />}
        </>
      ) : (
        <div className="thumbnail-placeholder" />
      )}
      {isRejected && (
        <div className="rejected-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </div>
      )}
    </div>
  );
}
