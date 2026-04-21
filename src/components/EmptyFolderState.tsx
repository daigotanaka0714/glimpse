import { FolderOpen, Folder, ImageOff } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { SubfolderInfo } from '@/utils/tauri';

interface EmptyFolderStateProps {
  folderPath: string;
  subfolders: SubfolderInfo[];
  onOpenSubfolder: (path: string) => void;
  onOpenAnother: () => void;
}

export function EmptyFolderState({
  folderPath,
  subfolders,
  onOpenSubfolder,
  onOpenAnother,
}: EmptyFolderStateProps) {
  const t = useTranslation();

  const displayName = folderPath.split('/').filter(Boolean).pop() ?? folderPath;
  const hasSubfolders = subfolders.length > 0;

  return (
    <div className="flex-1 flex items-center justify-center overflow-auto">
      <div className="text-center max-w-xl w-full px-6 py-10 animate-slide-up">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center">
          <ImageOff size={40} className="text-accent" />
        </div>

        <h2 className="text-xl font-semibold mb-2">{t.emptyFolder.title}</h2>
        <p className="text-text-muted text-sm mb-2 break-all" title={folderPath}>
          📁 {displayName}
        </p>
        <p className="text-text-muted mb-6 leading-relaxed text-sm">
          {t.emptyFolder.description}
        </p>

        {hasSubfolders ? (
          <>
            <p className="text-sm text-text-secondary mb-3 text-left">
              {t.emptyFolder.subfoldersFound}
            </p>
            <ul className="text-left space-y-1 mb-6 max-h-80 overflow-auto rounded-lg border border-border-subtle bg-bg-secondary">
              {subfolders.map((sf) => (
                <li key={sf.path}>
                  <button
                    onClick={() => onOpenSubfolder(sf.path)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 theme-hover-bg transition-colors text-left"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Folder size={16} className="text-text-secondary shrink-0" />
                      <span className="truncate" title={sf.name}>
                        {sf.name}
                      </span>
                    </span>
                    <span className="text-sm text-text-muted shrink-0 tabular-nums">
                      {sf.image_count} {t.emptyFolder.photosUnit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-text-muted mb-6">{t.emptyFolder.noSubfolders}</p>
        )}

        <button
          onClick={onOpenAnother}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover rounded-xl transition-colors font-medium text-white"
        >
          <FolderOpen size={18} />
          <span>{t.emptyFolder.openAnother}</span>
        </button>
      </div>
    </div>
  );
}
