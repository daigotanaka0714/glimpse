import { useState, useEffect, useCallback, useRef } from "react";
import type { ImageFile, Session, ViewMode } from "./types";
import {
  ThumbnailGrid,
  DetailView,
  Header,
  StatusBar,
  EmptyState,
} from "./components";
import {
  openFolderDialog,
  saveExportDialog,
  openFolder,
  generateThumbnails,
  setLabel,
  getAllLabels,
  updateSelectedIndex,
  exportApprovedFiles,
} from "./hooks/useApi";

const THUMBNAIL_SIZE = 180;
const THUMBNAIL_BATCH_SIZE = 50;

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [rejectedFiles, setRejectedFiles] = useState<Set<string>>(new Set());
  const [thumbnailPaths, setThumbnailPaths] = useState<Map<string, string>>(
    new Map()
  );
  const [generatingThumbnails, setGeneratingThumbnails] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState(0);
  const [columnsCount, setColumnsCount] = useState(8);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate grid columns based on container width
  useEffect(() => {
    const updateColumns = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const cols = Math.floor((width - 32) / (THUMBNAIL_SIZE + 8));
        setColumnsCount(Math.max(1, cols));
      }
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  // Generate thumbnails in batches
  const generateThumbnailsBatched = useCallback(
    async (sessionId: string, imageList: ImageFile[]) => {
      setGeneratingThumbnails(true);
      setThumbnailProgress(0);

      for (let i = 0; i < imageList.length; i += THUMBNAIL_BATCH_SIZE) {
        const batch = imageList.slice(i, i + THUMBNAIL_BATCH_SIZE);

        try {
          const results = await generateThumbnails({
            session_id: sessionId,
            images: batch,
            size: THUMBNAIL_SIZE * 2, // 2x for retina
          });

          setThumbnailPaths((prev) => {
            const next = new Map(prev);
            for (const result of results) {
              if (result.success) {
                next.set(result.filename, result.thumbnail_path);
              }
            }
            return next;
          });

          setThumbnailProgress(Math.min(i + THUMBNAIL_BATCH_SIZE, imageList.length));
        } catch (error) {
          console.error("Error generating thumbnails:", error);
        }
      }

      setGeneratingThumbnails(false);
    },
    []
  );

  // Handle folder open
  const handleOpenFolder = useCallback(async () => {
    const folderPath = await openFolderDialog();
    if (!folderPath) return;

    try {
      const result = await openFolder(folderPath);
      setSession(result.session);
      setImages(result.images);
      setSelectedIndex(result.session.last_selected_index);
      setThumbnailPaths(new Map());
      setRejectedFiles(new Set());

      // Load existing labels
      const labels = await getAllLabels(result.session.id);
      const rejected = new Set<string>();
      for (const label of labels) {
        if (label.label === "rejected") {
          rejected.add(label.filename);
        }
      }
      setRejectedFiles(rejected);

      // Start thumbnail generation
      generateThumbnailsBatched(result.session.id, result.images);
    } catch (error) {
      console.error("Error opening folder:", error);
    }
  }, [generateThumbnailsBatched]);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!session) return;

    const destFolder = await saveExportDialog();
    if (!destFolder) return;

    try {
      const result = await exportApprovedFiles(
        session.id,
        session.folder_path,
        destFolder
      );

      alert(
        `Export complete!\n\nCopied: ${result.copied} files\nTotal approved: ${result.total_approved}\nErrors: ${result.errors.length}`
      );
    } catch (error) {
      console.error("Error exporting:", error);
      alert(`Export failed: ${error}`);
    }
  }, [session]);

  // Handle selection change
  const handleSelect = useCallback(
    async (index: number) => {
      setSelectedIndex(index);
      if (session) {
        await updateSelectedIndex(session.id, index);
      }
    },
    [session]
  );

  // Handle toggle rejected
  const handleToggleRejected = useCallback(async () => {
    if (!session || images.length === 0) return;

    const image = images[selectedIndex];
    const isRejected = rejectedFiles.has(image.filename);
    const newLabel = isRejected ? null : "rejected";

    try {
      await setLabel(session.id, image.filename, newLabel);
      setRejectedFiles((prev) => {
        const next = new Set(prev);
        if (isRejected) {
          next.delete(image.filename);
        } else {
          next.add(image.filename);
        }
        return next;
      });
    } catch (error) {
      console.error("Error setting label:", error);
    }
  }, [session, images, selectedIndex, rejectedFiles]);

  // Handle open detail view
  const handleOpenDetail = useCallback((index: number) => {
    setSelectedIndex(index);
    setViewMode("detail");
  }, []);

  // Handle close detail view
  const handleCloseDetail = useCallback(() => {
    setViewMode("grid");
  }, []);

  // Handle navigation in detail view
  const handlePreviousImage = useCallback(() => {
    if (selectedIndex > 0) {
      handleSelect(selectedIndex - 1);
    }
  }, [selectedIndex, handleSelect]);

  const handleNextImage = useCallback(() => {
    if (selectedIndex < images.length - 1) {
      handleSelect(selectedIndex + 1);
    }
  }, [selectedIndex, images.length, handleSelect]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+O: Open folder
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        handleOpenFolder();
      }
      // Ctrl+E: Export
      if (e.ctrlKey && e.key === "e") {
        e.preventDefault();
        handleExport();
      }
      // 1: Toggle rejected (in grid mode)
      if (e.key === "1" && viewMode === "grid") {
        handleToggleRejected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenFolder, handleExport, handleToggleRejected, viewMode]);

  const currentImage = images[selectedIndex];
  const isCurrentRejected = currentImage
    ? rejectedFiles.has(currentImage.filename)
    : false;

  return (
    <div className="h-full flex flex-col" ref={containerRef}>
      <Header
        folderPath={session?.folder_path ?? null}
        onOpenFolder={handleOpenFolder}
        onExport={handleExport}
        hasImages={images.length > 0}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {images.length === 0 ? (
          <EmptyState onOpenFolder={handleOpenFolder} />
        ) : (
          <ThumbnailGrid
            images={images}
            selectedIndex={selectedIndex}
            rejectedFiles={rejectedFiles}
            thumbnailPaths={thumbnailPaths}
            thumbnailSize={THUMBNAIL_SIZE}
            columnsCount={columnsCount}
            onSelect={handleSelect}
            onOpenDetail={handleOpenDetail}
          />
        )}
      </main>

      <StatusBar
        total={images.length}
        rejected={rejectedFiles.size}
        selectedIndex={selectedIndex}
        generatingThumbnails={generatingThumbnails}
        thumbnailProgress={thumbnailProgress}
      />

      {viewMode === "detail" && currentImage && (
        <DetailView
          image={currentImage}
          index={selectedIndex}
          total={images.length}
          isRejected={isCurrentRejected}
          onClose={handleCloseDetail}
          onPrevious={handlePreviousImage}
          onNext={handleNextImage}
          onToggleRejected={handleToggleRejected}
        />
      )}
    </div>
  );
}

export default App;
