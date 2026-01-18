import { FolderOpen, Download, Loader2, RefreshCw, Settings } from 'lucide-react';

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
}: HeaderProps) {
  const isGeneratingThumbnails =
    thumbnailProgress.total > 0 &&
    thumbnailProgress.completed < thumbnailProgress.total;

  const adoptedCount = totalFiles - rejectedCount;

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-bg-secondary border-b border-white/10">
      {/* Left side: Open folder */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenFolder}
          className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
        >
          <FolderOpen size={18} />
          <span>Open Folder</span>
        </button>

        {folderPath && (
          <>
            <span className="text-sm text-white/50 truncate max-w-md">
              {folderPath}
            </span>
            {onReload && (
              <button
                onClick={onReload}
                disabled={isGeneratingThumbnails}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-xs"
                title="Regenerate thumbnails"
              >
                <RefreshCw size={14} />
                <span>Reload</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Center: Progress */}
      <div className="flex items-center gap-6">
        {isGeneratingThumbnails && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Loader2 size={16} className="animate-spin" />
            <span>
              Generating thumbnails... {thumbnailProgress.completed} /{' '}
              {thumbnailProgress.total}
            </span>
          </div>
        )}

        {totalFiles > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/70">
              Total: <span className="text-white font-medium">{totalFiles}</span>
              {' '}photos
            </span>
            <span className="text-green-400">
              Adopted: <span className="font-medium">{adoptedCount}</span>
            </span>
            <span className="text-rejected">
              Rejected: <span className="font-medium">{rejectedCount}</span>
            </span>
          </div>
        )}
      </div>

      {/* Right side: Settings & Export */}
      <div className="flex items-center gap-2">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings size={18} />
          </button>
        )}
        <button
          onClick={onExport}
          disabled={totalFiles === 0}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium"
        >
          <Download size={18} />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
}
