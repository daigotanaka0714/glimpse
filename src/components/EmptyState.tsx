interface EmptyStateProps {
  onOpenFolder: () => void;
}

export function EmptyState({ onOpenFolder }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z" />
      </svg>
      <h2 className="text-xl mb-2">No folder selected</h2>
      <p className="text-sm mb-4">
        Open a folder containing images to get started
      </p>
      <button className="btn btn-primary" onClick={onOpenFolder}>
        Open Folder (Ctrl+O)
      </button>
    </div>
  );
}
