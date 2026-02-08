import { FolderOpen, Download, Loader2, RefreshCw, Settings, HelpCircle, ImageIcon, Check, X } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface HeaderProps {
  folderPath: string | null;
  totalFiles: number;
  rejectedCount: number;
  thumbnailProgress: {
    completed: number;
    total: number;
  };
  onOpenFolder: () => void;
  onExport: () => void;
  onReload?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
}

export function Header({
  folderPath,
  totalFiles,
  rejectedCount,
  thumbnailProgress,
  onOpenFolder,
  onExport,
  onReload,
  onOpenSettings,
  onOpenHelp,
}: HeaderProps) {
  const t = useTranslation();
  const isGeneratingThumbnails =
    thumbnailProgress.total > 0 &&
    thumbnailProgress.completed < thumbnailProgress.total;

  const adoptedCount = totalFiles - rejectedCount;

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-bg-secondary border-b border-border-subtle gap-2">
      {/* Left side: Open folder - shrink-0 prevents compression */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenFolder}
          className="flex items-center gap-2 px-3 py-2 bg-bg-tertiary hover:bg-theme-hover rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
          title={t.header.openFolder}
        >
          <FolderOpen size={18} className="shrink-0" />
          <span className="hidden sm:inline">{t.header.openFolder}</span>
        </button>

        {folderPath && onReload && (
          <button
            onClick={onReload}
            disabled={isGeneratingThumbnails}
            className="p-2 bg-bg-tertiary hover:bg-theme-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            title={t.header.reload}
          >
            <RefreshCw size={16} className={isGeneratingThumbnails ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {/* Center: Path + Progress + Stats - this section can shrink */}
      <div className="flex items-center gap-3 min-w-0 flex-1 justify-center overflow-hidden">
        {/* Folder path - truncates */}
        {folderPath && (
          <span
            className="text-xs text-text-muted truncate max-w-[200px] lg:max-w-[400px] hidden md:block"
            title={folderPath}
          >
            {folderPath}
          </span>
        )}

        {/* Thumbnail generation progress */}
        {isGeneratingThumbnails && (
          <div className="flex items-center gap-1.5 text-xs text-text-secondary whitespace-nowrap shrink-0">
            <Loader2 size={14} className="animate-spin shrink-0" />
            <span className="tabular-nums">
              {thumbnailProgress.completed}/{thumbnailProgress.total}
            </span>
          </div>
        )}

        {/* Stats - compact display */}
        {totalFiles > 0 && (
          <div className="flex items-center gap-1 text-xs shrink-0">
            {/* Total */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded bg-bg-tertiary whitespace-nowrap"
              title={`${t.header.total}: ${totalFiles} ${t.header.photos}`}
            >
              <ImageIcon size={12} className="text-text-muted shrink-0" />
              <span className="tabular-nums font-medium">{totalFiles}</span>
            </div>

            {/* Adopted */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded bg-green-500/10 text-green-600 dark:text-green-400 whitespace-nowrap"
              title={`${t.header.adopted}: ${adoptedCount}`}
            >
              <Check size={12} className="shrink-0" />
              <span className="tabular-nums font-medium">{adoptedCount}</span>
            </div>

            {/* Rejected */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded bg-rejected/10 text-rejected whitespace-nowrap"
              title={`${t.header.rejected}: ${rejectedCount}`}
            >
              <X size={12} className="shrink-0" />
              <span className="tabular-nums font-medium">{rejectedCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Right side: Help, Settings & Export - shrink-0 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {onOpenHelp && (
          <button
            onClick={onOpenHelp}
            className="p-2 bg-bg-tertiary hover:bg-theme-hover rounded-lg transition-colors"
            title={`${t.header.help} (?)`}
          >
            <HelpCircle size={18} />
          </button>
        )}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 bg-bg-tertiary hover:bg-theme-hover rounded-lg transition-colors"
            title={t.header.settings}
          >
            <Settings size={18} />
          </button>
        )}
        <button
          onClick={onExport}
          disabled={totalFiles === 0}
          className="flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium text-white whitespace-nowrap"
          title={t.header.export}
        >
          <Download size={18} className="shrink-0" />
          <span className="hidden sm:inline">{t.header.export}</span>
        </button>
      </div>
    </header>
  );
}
