import { useState } from 'react';
import { X, FolderOutput, Loader2, Check, Copy, Scissors } from 'lucide-react';

export type ExportMode = 'copy' | 'move';

export interface ExportOptions {
  destinationPath: string;
  mode: ExportMode;
}

interface ExportDialogProps {
  adoptedCount: number;
  rejectedCount: number;
  onExport: (options: ExportOptions) => Promise<void>;
  onClose: () => void;
  onSelectFolder: () => Promise<string | null>;
}

export function ExportDialog({
  adoptedCount,
  rejectedCount,
  onExport,
  onClose,
  onSelectFolder,
}: ExportDialogProps) {
  const [destinationPath, setDestinationPath] = useState<string>('');
  const [exportMode, setExportMode] = useState<ExportMode>('copy');
  const [isExporting, setIsExporting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = async () => {
    const path = await onSelectFolder();
    if (path) {
      setDestinationPath(path);
      setError(null);
    }
  };

  const handleExport = async () => {
    if (!destinationPath) {
      setError('Please select a destination folder');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      await onExport({ destinationPath, mode: exportMode });
      setIsComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
      <div className="w-full max-w-lg bg-bg-secondary rounded-2xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">Export Adopted Photos</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Statistics */}
          <div className="flex gap-4">
            <div className="flex-1 p-4 bg-green-500/10 rounded-xl text-center">
              <p className="text-3xl font-bold text-green-400">{adoptedCount}</p>
              <p className="text-sm text-white/50">Adopted</p>
            </div>
            <div className="flex-1 p-4 bg-rejected/10 rounded-xl text-center">
              <p className="text-3xl font-bold text-rejected">{rejectedCount}</p>
              <p className="text-sm text-white/50">Rejected</p>
            </div>
          </div>

          {/* Destination selection */}
          <div>
            <label className="block text-sm text-white/70 mb-2">
              Destination Folder
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={destinationPath}
                readOnly
                placeholder="Select a folder..."
                className="flex-1 px-4 py-2 bg-bg-tertiary border border-white/10 rounded-lg text-sm"
              />
              <button
                onClick={handleSelectFolder}
                disabled={isExporting}
                className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
              >
                <FolderOutput size={18} />
              </button>
            </div>
          </div>

          {/* Export mode selection */}
          <div>
            <label className="block text-sm text-white/70 mb-2">
              Export Method
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setExportMode('copy')}
                disabled={isExporting}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors
                  ${exportMode === 'copy'
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-bg-tertiary border-white/10 text-white/70 hover:bg-white/10'
                  }
                `}
              >
                <Copy size={18} />
                <span className="text-sm font-medium">Copy</span>
              </button>
              <button
                onClick={() => setExportMode('move')}
                disabled={isExporting}
                className={`
                  flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-colors
                  ${exportMode === 'move'
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-bg-tertiary border-white/10 text-white/70 hover:bg-white/10'
                  }
                `}
              >
                <Scissors size={18} />
                <span className="text-sm font-medium">Move</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-white/50">
              {exportMode === 'copy'
                ? 'Original files will not be modified'
                : 'Original files will be deleted (Warning: cannot be undone)'
              }
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-rejected/20 border border-rejected/30 rounded-lg text-sm text-rejected">
              {error}
            </div>
          )}

          {/* Complete message */}
          {isComplete && (
            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-400 flex items-center gap-2">
              <Check size={18} />
              <span>Export completed!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-bg-tertiary hover:bg-white/10 rounded-lg transition-colors text-sm"
          >
            {isComplete ? 'Close' : 'Cancel'}
          </button>
          {!isComplete && (
            <button
              onClick={handleExport}
              disabled={isExporting || !destinationPath}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors text-sm font-medium"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <FolderOutput size={16} />
                  <span>Export</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
