import { Filter, Sun, Moon, ZoomIn, ZoomOut, LayoutGrid, GalleryHorizontalEnd } from 'lucide-react';
import type { FilterMode, ThemeMode, ViewMode } from '@/types';
import { useTranslation } from '@/i18n';

interface ToolbarProps {
  thumbnailSize: number;
  minSize: number;
  maxSize: number;
  onThumbnailSizeChange: (size: number) => void;
  filterMode: FilterMode;
  onFilterModeChange: (mode: FilterMode) => void;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  viewMode: ViewMode;
  onEnterGallery: () => void;
  hasSelection: boolean;
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
  viewMode,
  onEnterGallery,
  hasSelection,
  counts,
}: ToolbarProps) {
  const t = useTranslation();

  const filterOptions: { mode: FilterMode; label: string; count: number }[] = [
    { mode: 'all', label: t.toolbar.all, count: counts.all },
    { mode: 'adopted', label: t.toolbar.adopted, count: counts.adopted },
    { mode: 'rejected', label: t.toolbar.rejected, count: counts.rejected },
  ];

  return (
    <div className="flex items-center justify-between h-10 px-4 bg-bg-tertiary border-b border-border-subtle">
      {/* Left side: Filter */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-text-muted" />
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
                    : 'text-text-secondary hover:bg-theme-hover'
                }
              `}
            >
              {label}
              <span className="ml-1.5 opacity-70">({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Center: Thumbnail size slider */}
      <div className="flex items-center gap-3">
        <ZoomOut size={14} className="text-text-muted" />
        <input
          type="range"
          min={minSize}
          max={maxSize}
          value={thumbnailSize}
          onChange={(e) => onThumbnailSizeChange(Number(e.target.value))}
          className="w-32 h-1 bg-border-color rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:bg-accent
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125"
        />
        <ZoomIn size={14} className="text-text-muted" />
        <span className="text-xs text-text-muted w-12 text-right">{thumbnailSize}px</span>
      </div>

      {/* Right side: View mode & Theme toggle */}
      <div className="flex items-center gap-2">
        {/* View mode toggle */}
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={() => {}}
            disabled={viewMode === 'grid'}
            className={`
              p-1.5 rounded-md transition-colors
              ${viewMode === 'grid'
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:bg-theme-hover'
              }
            `}
            title={t.toolbar.gridView}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={onEnterGallery}
            disabled={!hasSelection}
            className={`
              p-1.5 rounded-md transition-colors
              ${viewMode === 'gallery'
                ? 'bg-accent text-white'
                : hasSelection
                  ? 'text-text-secondary hover:bg-theme-hover'
                  : 'text-text-subtle cursor-not-allowed'
              }
            `}
            title={hasSelection ? t.toolbar.galleryView : t.toolbar.galleryViewHint}
          >
            <GalleryHorizontalEnd size={16} />
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-border-subtle" />

        {/* Theme toggle */}
        <button
          onClick={() => onThemeChange(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:bg-theme-hover rounded-md transition-colors"
          title={theme === 'dark' ? t.toolbar.light : t.toolbar.dark}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={14} />
              <span>{t.toolbar.light}</span>
            </>
          ) : (
            <>
              <Moon size={14} />
              <span>{t.toolbar.dark}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
