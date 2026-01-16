interface HeaderProps {
  folderPath: string | null;
  onOpenFolder: () => void;
  onExport: () => void;
  hasImages: boolean;
}

export function Header({ folderPath, onOpenFolder, onExport, hasImages }: HeaderProps) {
  return (
    <header className="header">
      <h1 className="text-lg font-semibold">Glimpse</h1>

      <div className="flex-1 flex items-center gap-2">
        {folderPath && (
          <span className="text-sm text-gray-400 truncate max-w-md">
            {folderPath}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button className="btn btn-secondary" onClick={onOpenFolder}>
          <span className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
            </svg>
            Open (Ctrl+O)
          </span>
        </button>

        {hasImages && (
          <button className="btn btn-primary" onClick={onExport}>
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z" />
              </svg>
              Export (Ctrl+E)
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
