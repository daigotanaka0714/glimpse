import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Header,
  Toolbar,
  ThumbnailGrid,
  DetailView,
  CompareView,
  StatusBar,
  EmptyState,
  ExportDialog,
  BatchActionBar,
  SettingsDialog,
} from '@/components';
import { useKeyboardNavigation, useGridConfig, useDragAndDrop } from '@/hooks';
import type { ImageItem, LabelStatus, FilterMode, ThemeMode } from '@/types';
import {
  selectFolder,
  openFolder,
  setLabel as setLabelApi,
  saveSelection,
  exportAdopted,
  selectExportFolder,
  onThumbnailProgress,
  onThumbnailsComplete,
  toImageItem,
  clearCache,
  type ThumbnailResult,
} from '@/utils/tauri';
import { playCompletionSound } from '@/utils/notification';

export default function App() {
  // State management
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'detail' | 'compare'>('grid');
  const [compareIndex, setCompareIndex] = useState(1); // Second image index for compare mode
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Phase 2 new features
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [baseThumbnailSize, setBaseThumbnailSize] = useState(180);

  const { config: gridConfig, setBaseThumbnailSize: updateGridSize, minSize, maxSize } = useGridConfig();

  // Store session info
  const sessionRef = useRef<{ id: string; cacheDir: string } | null>(null);

  // Apply theme
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Update grid when thumbnail size changes
  const handleThumbnailSizeChange = useCallback((size: number) => {
    setBaseThumbnailSize(size);
    updateGridSize(size);
  }, [updateGridSize]);

  // Open folder handler (without dialog - for drag & drop)
  const handleOpenFolderByPath = useCallback(async (path: string) => {
    try {
      setIsLoading(true);
      setFolderPath(path);

      // Open folder via backend
      const result = await openFolder(path);

      // Save session info
      sessionRef.current = {
        id: result.session_id,
        cacheDir: result.cache_dir,
      };

      // Convert label info to map
      const labelsMap = new Map<string, LabelStatus>();
      result.labels.forEach((l) => {
        if (l.label === 'rejected') {
          labelsMap.set(l.filename, 'rejected');
        }
      });

      // Convert image info to ImageItem
      const imageItems = result.images.map((info, index) =>
        toImageItem(info, index, labelsMap, result.cache_dir)
      );

      setImages(imageItems);
      setSelectedIndex(result.last_selected_index);
      setSelectedIndices(new Set());
      setThumbnailProgress({ completed: 0, total: result.images.length });
    } catch (error) {
      console.error('Failed to open folder:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Drag & drop
  const { isDragging } = useDragAndDrop({
    onDrop: handleOpenFolderByPath,
    enabled: true,
  });

  // Set up thumbnail progress event listeners
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenProgress = await onThumbnailProgress((progress) => {
        setThumbnailProgress(progress);
      });

      unlistenComplete = await onThumbnailsComplete((results: ThumbnailResult[]) => {
        // Update thumbnailLoaded to true after thumbnail generation completes
        setImages((prev) =>
          prev.map((img) => {
            const result = results.find((r) => r.filename === img.filename);
            if (result && result.success) {
              return { ...img, thumbnailLoaded: true };
            }
            return img;
          })
        );

        // Play completion notification sound
        playCompletionSound();
      });
    };

    setupListeners();

    return () => {
      unlistenProgress?.();
      unlistenComplete?.();
    };
  }, []);

  // Save to backend when selection changes
  useEffect(() => {
    if (sessionRef.current && images.length > 0) {
      saveSelection(selectedIndex).catch(console.error);
    }
  }, [selectedIndex, images.length]);

  // Filtered image list
  const filteredImages = useMemo(() => {
    switch (filterMode) {
      case 'adopted':
        return images.filter((img) => img.label !== 'rejected');
      case 'rejected':
        return images.filter((img) => img.label === 'rejected');
      default:
        return images;
    }
  }, [images, filterMode]);

  // Label counts
  const { rejectedCount, adoptedCount } = useMemo(() => {
    const rejected = images.filter((img) => img.label === 'rejected').length;
    return {
      rejectedCount: rejected,
      adoptedCount: images.length - rejected,
    };
  }, [images]);

  // Selected item (from filtered index)
  const selectedItem = filteredImages[selectedIndex] || null;

  // Actions
  const handleSelect = useCallback((index: number, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
    const isMultiSelect = event?.ctrlKey || event?.metaKey;
    const isRangeSelect = event?.shiftKey;

    if (isMultiSelect) {
      // Ctrl/Cmd + click: toggle selection
      setSelectedIndices((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(index)) {
          newSet.delete(index);
        } else {
          newSet.add(index);
        }
        return newSet;
      });
      setSelectedIndex(index);
    } else if (isRangeSelect && selectedIndices.size > 0) {
      // Shift + click: range selection
      const start = Math.min(selectedIndex, index);
      const end = Math.max(selectedIndex, index);
      const newSet = new Set<number>();
      for (let i = start; i <= end; i++) {
        newSet.add(i);
      }
      setSelectedIndices(newSet);
      setSelectedIndex(index);
    } else {
      // Normal click: single selection
      setSelectedIndex(index);
      setSelectedIndices(new Set([index]));
    }
  }, [selectedIndex, selectedIndices]);

  const handleToggleLabel = useCallback(async () => {
    // When multiple items selected, apply label to all selected images
    const indicesToToggle = selectedIndices.size > 0
      ? Array.from(selectedIndices)
      : [selectedIndex];

    if (indicesToToggle.length === 0 || indicesToToggle.some(i => i < 0 || i >= filteredImages.length)) return;

    // Use the first selected image's label state as reference
    const firstImage = filteredImages[indicesToToggle[0]];
    const newLabel: LabelStatus = firstImage.label === 'rejected' ? null : 'rejected';

    // Immediate UI update
    setImages((prev) =>
      prev.map((img) => {
        const filteredIndex = filteredImages.findIndex(fi => fi.filename === img.filename);
        if (indicesToToggle.includes(filteredIndex)) {
          return { ...img, label: newLabel };
        }
        return img;
      })
    );

    // Save to backend
    try {
      for (const idx of indicesToToggle) {
        const img = filteredImages[idx];
        await setLabelApi(img.filename, newLabel);
      }
    } catch (error) {
      console.error('Failed to set label:', error);
      // Should revert to original state on error, but simplified here
    }
  }, [selectedIndex, selectedIndices, filteredImages]);

  // Batch mark as rejected
  const handleBatchMarkRejected = useCallback(async () => {
    if (selectedIndices.size === 0) return;

    const indicesToMark = Array.from(selectedIndices);

    // Immediate UI update
    setImages((prev) =>
      prev.map((img) => {
        const filteredIndex = filteredImages.findIndex(fi => fi.filename === img.filename);
        if (indicesToMark.includes(filteredIndex)) {
          return { ...img, label: 'rejected' };
        }
        return img;
      })
    );

    // Save to backend
    try {
      for (const idx of indicesToMark) {
        const img = filteredImages[idx];
        if (img) {
          await setLabelApi(img.filename, 'rejected');
        }
      }
    } catch (error) {
      console.error('Failed to set labels:', error);
    }
  }, [selectedIndices, filteredImages]);

  // Batch remove rejected label
  const handleBatchRemoveRejected = useCallback(async () => {
    if (selectedIndices.size === 0) return;

    const indicesToMark = Array.from(selectedIndices);

    // Immediate UI update
    setImages((prev) =>
      prev.map((img) => {
        const filteredIndex = filteredImages.findIndex(fi => fi.filename === img.filename);
        if (indicesToMark.includes(filteredIndex)) {
          return { ...img, label: null };
        }
        return img;
      })
    );

    // Save to backend
    try {
      for (const idx of indicesToMark) {
        const img = filteredImages[idx];
        if (img) {
          await setLabelApi(img.filename, null);
        }
      }
    } catch (error) {
      console.error('Failed to remove labels:', error);
    }
  }, [selectedIndices, filteredImages]);

  // Mark all filtered images as rejected
  const handleBatchMarkAllRejected = useCallback(async () => {
    if (filteredImages.length === 0) return;

    // Immediate UI update
    const filteredFilenames = new Set(filteredImages.map(fi => fi.filename));
    setImages((prev) =>
      prev.map((img) => {
        if (filteredFilenames.has(img.filename)) {
          return { ...img, label: 'rejected' };
        }
        return img;
      })
    );

    // Save to backend
    try {
      for (const img of filteredImages) {
        await setLabelApi(img.filename, 'rejected');
      }
    } catch (error) {
      console.error('Failed to set labels:', error);
    }
  }, [filteredImages]);

  // Remove rejected label from all filtered images
  const handleBatchRemoveAllRejected = useCallback(async () => {
    if (filteredImages.length === 0) return;

    // Immediate UI update
    const filteredFilenames = new Set(filteredImages.map(fi => fi.filename));
    setImages((prev) =>
      prev.map((img) => {
        if (filteredFilenames.has(img.filename)) {
          return { ...img, label: null };
        }
        return img;
      })
    );

    // Save to backend
    try {
      for (const img of filteredImages) {
        await setLabelApi(img.filename, null);
      }
    } catch (error) {
      console.error('Failed to remove labels:', error);
    }
  }, [filteredImages]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const handleEnterDetail = useCallback(() => {
    if (filteredImages.length > 0) {
      setViewMode('detail');
    }
  }, [filteredImages.length]);

  const handleExitDetail = useCallback(() => {
    setViewMode('grid');
  }, []);

  // Compare mode
  const handleEnterCompare = useCallback(() => {
    if (filteredImages.length >= 2) {
      // If multiple items are selected, compare those two
      if (selectedIndices.size >= 2) {
        const indices = Array.from(selectedIndices).sort((a, b) => a - b);
        setSelectedIndex(indices[0]);
        setCompareIndex(indices[1]);
      } else {
        // If single selection, compare with next image
        const nextIndex = selectedIndex < filteredImages.length - 1 ? selectedIndex + 1 : 0;
        setCompareIndex(nextIndex);
      }
      setViewMode('compare');
    }
  }, [filteredImages.length, selectedIndex, selectedIndices]);

  const handleExitCompare = useCallback(() => {
    setViewMode('grid');
  }, []);

  const handleToggleLabelCompareLeft = useCallback(async () => {
    const img = filteredImages[selectedIndex];
    if (!img) return;

    const newLabel: LabelStatus = img.label === 'rejected' ? null : 'rejected';

    setImages((prev) =>
      prev.map((i) => i.filename === img.filename ? { ...i, label: newLabel } : i)
    );

    try {
      await setLabelApi(img.filename, newLabel);
    } catch (error) {
      console.error('Failed to set label:', error);
    }
  }, [filteredImages, selectedIndex]);

  const handleToggleLabelCompareRight = useCallback(async () => {
    const img = filteredImages[compareIndex];
    if (!img) return;

    const newLabel: LabelStatus = img.label === 'rejected' ? null : 'rejected';

    setImages((prev) =>
      prev.map((i) => i.filename === img.filename ? { ...i, label: newLabel } : i)
    );

    try {
      await setLabelApi(img.filename, newLabel);
    } catch (error) {
      console.error('Failed to set label:', error);
    }
  }, [filteredImages, compareIndex]);

  const handleOpenFolder = useCallback(async () => {
    try {
      // Open folder selection dialog
      const path = await selectFolder();
      if (!path) return;

      await handleOpenFolderByPath(path);
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  }, [handleOpenFolderByPath]);

  // Clear thumbnail cache and reload
  const handleReload = useCallback(async () => {
    if (!folderPath) return;

    try {
      // Clear cache
      await clearCache();

      // Reset thumbnail load state
      setImages((prev) =>
        prev.map((img) => ({ ...img, thumbnailLoaded: false }))
      );

      // Reload folder (triggers thumbnail regeneration)
      await handleOpenFolderByPath(folderPath);
    } catch (error) {
      console.error('Failed to reload:', error);
    }
  }, [folderPath, handleOpenFolderByPath]);

  const handleExport = useCallback(async (options: { destinationPath: string; mode: 'copy' | 'move' }) => {
    if (!folderPath) return;

    await exportAdopted(folderPath, options.destinationPath, options.mode);
  }, [folderPath]);

  const handleSelectExportFolder = useCallback(async (): Promise<string | null> => {
    return await selectExportFolder();
  }, []);

  // Keyboard navigation
  useKeyboardNavigation({
    totalItems: filteredImages.length,
    selectedIndex,
    compareIndex,
    gridConfig,
    viewMode,
    onSelect: handleSelect,
    onSelectCompare: setCompareIndex,
    onToggleLabel: handleToggleLabel,
    onToggleLabelCompare: handleToggleLabelCompareRight,
    onEnterDetail: handleEnterDetail,
    onExitDetail: handleExitDetail,
    onEnterCompare: handleEnterCompare,
    onExitCompare: handleExitCompare,
    onClearSelection: handleClearSelection,
    onOpenFolder: handleOpenFolder,
    onExport: () => setShowExportDialog(true),
  });

  return (
    <div className={`h-screen flex flex-col bg-bg-primary text-text-primary transition-colors`}>
      <Header
        folderPath={folderPath}
        totalFiles={images.length}
        rejectedCount={rejectedCount}
        thumbnailProgress={thumbnailProgress}
        onOpenFolder={handleOpenFolder}
        onExport={() => setShowExportDialog(true)}
        onReload={handleReload}
        onOpenSettings={() => setShowSettingsDialog(true)}
      />

      {images.length > 0 && (
        <Toolbar
          thumbnailSize={baseThumbnailSize}
          minSize={minSize}
          maxSize={maxSize}
          onThumbnailSizeChange={handleThumbnailSizeChange}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          theme={theme}
          onThemeChange={setTheme}
          counts={{
            all: images.length,
            adopted: adoptedCount,
            rejected: rejectedCount,
          }}
        />
      )}

      {/* Batch action bar for multiple selection */}
      <BatchActionBar
        selectedCount={selectedIndices.size}
        filteredCount={filteredImages.length}
        filterMode={filterMode}
        onMarkRejected={handleBatchMarkRejected}
        onRemoveRejected={handleBatchRemoveRejected}
        onMarkAllRejected={handleBatchMarkAllRejected}
        onRemoveAllRejected={handleBatchRemoveAllRejected}
        onClearSelection={handleClearSelection}
      />

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-text-secondary">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p>Loading...</p>
          </div>
        </div>
      ) : images.length === 0 ? (
        <EmptyState onOpenFolder={handleOpenFolder} />
      ) : filteredImages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-text-secondary">
            <p className="text-lg mb-2">No matching photos</p>
            <p className="text-sm">Please change the filter</p>
          </div>
        </div>
      ) : (
        <ThumbnailGrid
          items={filteredImages}
          selectedIndex={selectedIndex}
          selectedIndices={selectedIndices}
          gridConfig={gridConfig}
          onSelect={handleSelect}
          onEnterDetail={handleEnterDetail}
        />
      )}

      <StatusBar
        selectedItem={selectedItem}
        selectedIndex={selectedIndex}
        totalItems={filteredImages.length}
        selectedCount={selectedIndices.size}
      />

      {viewMode === 'detail' && selectedItem && (
        <DetailView
          item={selectedItem}
          totalItems={filteredImages.length}
          onClose={handleExitDetail}
          onPrevious={() =>
            selectedIndex > 0 && handleSelect(selectedIndex - 1)
          }
          onNext={() =>
            selectedIndex < filteredImages.length - 1 && handleSelect(selectedIndex + 1)
          }
          onToggleLabel={handleToggleLabel}
        />
      )}

      {viewMode === 'compare' && filteredImages[selectedIndex] && filteredImages[compareIndex] && (
        <CompareView
          leftItem={filteredImages[selectedIndex]}
          rightItem={filteredImages[compareIndex]}
          totalItems={filteredImages.length}
          onClose={handleExitCompare}
          onSelectLeft={(index) => setSelectedIndex(index)}
          onSelectRight={(index) => setCompareIndex(index)}
          onToggleLabelLeft={handleToggleLabelCompareLeft}
          onToggleLabelRight={handleToggleLabelCompareRight}
        />
      )}

      {showExportDialog && (
        <ExportDialog
          adoptedCount={adoptedCount}
          rejectedCount={rejectedCount}
          onExport={handleExport}
          onClose={() => setShowExportDialog(false)}
          onSelectFolder={handleSelectExportFolder}
        />
      )}

      {showSettingsDialog && (
        <SettingsDialog onClose={() => setShowSettingsDialog(false)} />
      )}

      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-accent/20 border-4 border-dashed border-accent pointer-events-none">
          <div className="text-center">
            <div className="text-6xl mb-4">📁</div>
            <p className="text-xl font-medium text-text-primary">Drop folder to open</p>
          </div>
        </div>
      )}
    </div>
  );
}
