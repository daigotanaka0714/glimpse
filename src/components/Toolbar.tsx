import { Filter, Sun, Moon, ZoomIn, ZoomOut } from 'lucide-react';
import type { FilterMode, ThemeMode } from '@/types';

interface ToolbarProps {
  thumbnailSize: number;
  minSize: number;
  maxSize: number;
  onThumbnailSizeChange: (size: number) => void;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  counts: {
    all: number;
    adopted: number;
    rejected: number;
  };
}

export function Toolbar({
  thumbnailSize,
  minSize,
  maxSize,
  onThumbnailSizeChange,
  filterMode,
  onFilterModeChange,
  theme,
  onThemeChange,
  counts,
}: ToolbarProps) {
  const filterOptions: { mode: FilterMode; label: string; count: number }[] = [
    { mode: 'all', label: 'すべて', count: counts.all },
    { mode: 'adopted', label: '採用', count: counts.adopted },
    { mode: 'rejected', label: '不採用', count: counts.rejected },
  ];

  return (
    <div className="flex items-center justify-between h-10 px-4 bg-bg-tertiary border-b border-white/5">
      {/* 左側: フィルター */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-white/50" />
        <div className="flex items-center gap-1">
          {filterOptions.map(({ mode, label, count }) => (
            <button
              key={mode}
              onClick={() => onFilterModeChange(mode)}
              className={`
                px-3 py-1 text-xs font-medium rounded-md transition-colors
                ${
                  filterMode === mode
                    ? 'bg-accent text-white'
                    : 'text-white/70 hover:bg-white/10'
                }
              `}
            >
              {label}
              <span className="ml-1.5 opacity-70">({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 中央: サムネイルサイズスライダー */}
      <div className="flex items-center gap-3">
        <ZoomOut size={14} className="text-white/50" />
        <input
          type="range"
          min={minSize}
          max={maxSize}
          value={thumbnailSize}
          onChange={(e) => onThumbnailSizeChange(Number(e.target.value))}
          className="w-32 h-1 bg-white/20 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125"
        />
        <ZoomIn size={14} className="text-white/50" />
        <span className="text-xs text-white/50 w-12 text-right">{thumbnailSize}px</span>
      </div>

      {/* 右側: テーマ切り替え */}
      <button
        onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
        className="flex items-center gap-2 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 rounded-md transition-colors"
        title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
        aria-label="テーマ切り替え"
      >
        {theme === 'dark' ? (
          <>
            <Sun size={14} />
            <span>ライト</span>
          </>
        ) : (
          <>
            <Moon size={14} />
            <span>ダーク</span>
          </>
        )}
      </button>
    </div>
  );
}
