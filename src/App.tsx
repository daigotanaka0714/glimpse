import { useState, useCallback, useMemo } from 'react';
import {
  Header,
  ThumbnailGrid,
  DetailView,
  StatusBar,
  EmptyState,
  ExportDialog,
} from '@/components';
import { useKeyboardNavigation, useGridConfig } from '@/hooks';
import type { ImageItem, LabelStatus } from '@/types';

// モックデータ（開発用 - 後でTauri APIに置き換え）
const generateMockImages = (count: number): ImageItem[] => {
  return Array.from({ length: count }, (_, i) => ({
    filename: `DSC_${String(i + 1).padStart(4, '0')}.NEF`,
    path: `/mock/path/DSC_${String(i + 1).padStart(4, '0')}.NEF`,
    size: 20 * 1024 * 1024 + Math.random() * 10 * 1024 * 1024,
    modifiedAt: '2024/12/15 14:32',
    thumbnailPath: `https://picsum.photos/seed/${i}/300/200`,
    thumbnailLoaded: true,
    label: null,
    index: i,
  }));
};

export default function App() {
  // 状態管理
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'detail'>('grid');
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState({
    completed: 0,
    total: 0,
  });

  const gridConfig = useGridConfig();

  // ラベル集計
  const { rejectedCount, adoptedCount } = useMemo(() => {
    const rejected = images.filter((img) => img.label === 'rejected').length;
    return {
      rejectedCount: rejected,
      adoptedCount: images.length - rejected,
    };
  }, [images]);

  // 選択中のアイテム
  const selectedItem = images[selectedIndex] || null;

  // アクション
  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleToggleLabel = useCallback(() => {
    if (selectedIndex < 0 || selectedIndex >= images.length) return;

    setImages((prev) =>
      prev.map((img, i) => {
        if (i !== selectedIndex) return img;
        const newLabel: LabelStatus =
          img.label === 'rejected' ? null : 'rejected';
        return { ...img, label: newLabel };
      })
    );
  }, [selectedIndex, images.length]);

  const handleEnterDetail = useCallback(() => {
    if (images.length > 0) {
      setViewMode('detail');
    }
  }, [images.length]);

  const handleExitDetail = useCallback(() => {
    setViewMode('grid');
  }, []);

  const handleOpenFolder = useCallback(async () => {
    // TODO: Tauri dialog APIを使用
    // 開発用モックデータ
    const mockPath = 'D:/Photos/2024-12-Stage';
    setFolderPath(mockPath);
    setImages(generateMockImages(500));
    setSelectedIndex(0);
    setThumbnailProgress({ completed: 500, total: 500 });
  }, []);

  const handleExport = useCallback(async (destinationPath: string) => {
    // TODO: Tauri APIでファイルコピー実装
    console.log('Exporting to:', destinationPath);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 模擬遅延
  }, []);

  const handleSelectExportFolder = useCallback(async (): Promise<string | null> => {
    // TODO: Tauri dialog APIを使用
    return 'D:/Photos/2024-12-Stage-Selected';
  }, []);

  // キーボードナビゲーション
  useKeyboardNavigation({
    totalItems: images.length,
    selectedIndex,
    gridConfig,
    viewMode,
    onSelect: handleSelect,
    onToggleLabel: handleToggleLabel,
    onEnterDetail: handleEnterDetail,
    onExitDetail: handleExitDetail,
    onOpenFolder: handleOpenFolder,
    onExport: () => setShowExportDialog(true),
  });

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      <Header
        folderPath={folderPath}
        totalFiles={images.length}
        rejectedCount={rejectedCount}
        thumbnailProgress={thumbnailProgress}
        onOpenFolder={handleOpenFolder}
        onExport={() => setShowExportDialog(true)}
      />

      {images.length === 0 ? (
        <EmptyState onOpenFolder={handleOpenFolder} />
      ) : (
        <ThumbnailGrid
          items={images}
          selectedIndex={selectedIndex}
          gridConfig={gridConfig}
          onSelect={handleSelect}
          onEnterDetail={handleEnterDetail}
        />
      )}

      <StatusBar
        selectedItem={selectedItem}
        selectedIndex={selectedIndex}
        totalItems={images.length}
      />

      {viewMode === 'detail' && selectedItem && (
        <DetailView
          item={selectedItem}
          totalItems={images.length}
          onClose={handleExitDetail}
          onPrevious={() =>
            selectedIndex > 0 && handleSelect(selectedIndex - 1)
          }
          onNext={() =>
            selectedIndex < images.length - 1 && handleSelect(selectedIndex + 1)
          }
          onToggleLabel={handleToggleLabel}
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
    </div>
  );
}
