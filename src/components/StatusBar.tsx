interface StatusBarProps {
  total: number;
  rejected: number;
  selectedIndex: number;
  generatingThumbnails: boolean;
  thumbnailProgress: number;
}

export function StatusBar({
  total,
  rejected,
  selectedIndex,
  generatingThumbnails,
  thumbnailProgress,
}: StatusBarProps) {
  const approved = total - rejected;

  return (
    <div className="status-bar">
      <div className="flex items-center gap-4">
        {generatingThumbnails ? (
          <span className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Generating thumbnails... {thumbnailProgress}/{total}
          </span>
        ) : total > 0 ? (
          <>
            <span>Total: {total}</span>
            <span className="text-green-400">Approved: {approved}</span>
            <span className="text-red-400">Rejected: {rejected}</span>
            <span>Selected: {selectedIndex + 1}/{total}</span>
          </>
        ) : (
          <span>No images loaded</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs">
          ← → ↑ ↓ Navigate | 1 Toggle Reject | Enter/Space Detail | Esc Close
        </span>
      </div>
    </div>
  );
}
