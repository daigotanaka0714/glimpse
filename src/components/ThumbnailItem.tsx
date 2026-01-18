import { memo } from 'react';
import { X } from 'lucide-react';
import type { ImageItem } from '@/types';
import { toAssetUrl } from '@/utils/tauri';

interface ThumbnailItemProps {
  item: ImageItem;
  size: number;
  isSelected: boolean;
  isMultiSelected?: boolean;
  onClick: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
}

export const ThumbnailItem = memo(function ThumbnailItem({
  item,
  size,
  isSelected,
  isMultiSelected = false,
  onClick,
  onDoubleClick,
}: ThumbnailItemProps) {
  const isRejected = item.label === 'rejected';
  const showSelectionRing = isSelected || isMultiSelected;

  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        relative cursor-pointer transition-all duration-150 group
        ${showSelectionRing ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-primary' : ''}
      `}
      style={{ width: size, height: size }}
    >
      {/* サムネイル画像 */}
      {item.thumbnailLoaded && item.thumbnailPath ? (
        <img
          src={toAssetUrl(item.thumbnailPath)}
          alt={item.filename}
          className={`
            w-full h-full object-contain rounded-lg bg-bg-secondary
            ${isRejected ? 'opacity-40' : ''}
          `}
          loading="lazy"
          onError={() => {
            console.error('Thumbnail load error:', {
              originalPath: item.thumbnailPath,
              assetUrl: item.thumbnailPath ? toAssetUrl(item.thumbnailPath) : 'undefined',
              filename: item.filename,
            });
          }}
        />
      ) : (
        <div className="w-full h-full rounded-lg thumbnail-loading" />
      )}

      {/* 不採用オーバーレイ */}
      {isRejected && (
        <div className="absolute inset-0 flex items-center justify-center bg-rejected/20 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-rejected/80 flex items-center justify-center">
            <X size={28} className="text-white" strokeWidth={3} />
          </div>
        </div>
      )}

      {/* ホバー時のファイル名表示 */}
      <div
        className={`
          absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent
          rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity
        `}
      >
        <p className="text-xs text-white truncate font-mono">{item.filename}</p>
      </div>

      {/* 選択インジケーター */}
      {showSelectionRing && (
        <div className={`absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center shadow-lg ${
          isMultiSelected ? 'bg-accent' : 'bg-accent/70'
        }`}>
          {isMultiSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
});
