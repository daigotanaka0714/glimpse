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
      {/* 左側: フォルダを開く */}
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenFolder}
          className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
        >
          <FolderOpen size={18} />
          <span>フォルダを開く</span>
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
                title="サムネイルを再生成"
              >
                <RefreshCw size={14} />
                <span>再読込</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* 中央: 進捗 */}
      <div className="flex items-center gap-6">
        {isGeneratingThumbnails && (
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Loader2 size={16} className="animate-spin" />
            <span>
              サムネイル生成中... {thumbnailProgress.completed} /{' '}
              {thumbnailProgress.total}
            </span>
          </div>
        )}

        {totalFiles > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/70">
              合計: <span className="text-white font-medium">{totalFiles}</span>
              枚
            </span>
            <span className="text-green-400">
              採用: <span className="font-medium">{adoptedCount}</span>枚
            </span>
            <span className="text-rejected">
              不採用: <span className="font-medium">{rejectedCount}</span>枚
            </span>
          </div>
        )}
      </div>

      {/* 右側: 設定 & エクスポート */}
      <div className="flex items-center gap-2">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors"
            title="設定"
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
          <span>エクスポート</span>
        </button>
      </div>
    </header>
  );
}
