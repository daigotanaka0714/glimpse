import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  type ThumbnailResult,
} from '@/utils/tauri';

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
  const [isLoading, setIsLoading] = useState(false);

  const gridConfig = useGridConfig();

  // セッション情報を保持
  const sessionRef = useRef<{ id: string; cacheDir: string } | null>(null);

  // サムネイル進捗イベントのリスナー設定
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenProgress = await onThumbnailProgress((progress) => {
        setThumbnailProgress(progress);
      });

      unlistenComplete = await onThumbnailsComplete((results: ThumbnailResult[]) => {
        // サムネイル生成完了後、thumbnailLoadedをtrueに更新
        setImages((prev) =>
          prev.map((img) => {
            const result = results.find((r) => r.filename === img.filename);
            if (result && result.success) {
              return { ...img, thumbnailLoaded: true };
            }
            return img;
          })
        );
      });
    };

    setupListeners();

    return () => {
      unlistenProgress?.();
      unlistenComplete?.();
    };
  }, []);

  // 選択変更時にバックエンドに保存
  useEffect(() => {
    if (sessionRef.current && images.length > 0) {
      saveSelection(selectedIndex).catch(console.error);
    }
  }, [selectedIndex, images.length]);

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

  const handleToggleLabel = useCallback(async () => {
    if (selectedIndex < 0 || selectedIndex >= images.length) return;

    const currentImage = images[selectedIndex];
    const newLabel: LabelStatus = currentImage.label === 'rejected' ? null : 'rejected';

    // UI即時更新
    setImages((prev) =>
      prev.map((img, i) => {
        if (i !== selectedIndex) return img;
        return { ...img, label: newLabel };
      })
    );

    // バックエンドに保存
    try {
      await setLabelApi(currentImage.filename, newLabel);
    } catch (error) {
      console.error('Failed to set label:', error);
      // エラー時はUIを戻す
      setImages((prev) =>
        prev.map((img, i) => {
          if (i !== selectedIndex) return img;
          return { ...img, label: currentImage.label };
        })
      );
    }
  }, [selectedIndex, images]);

  const handleEnterDetail = useCallback(() => {
    if (images.length > 0) {
      setViewMode('detail');
    }
  }, [images.length]);

  const handleExitDetail = useCallback(() => {
    setViewMode('grid');
  }, []);

  const handleOpenFolder = useCallback(async () => {
    try {
      // フォルダ選択ダイアログを開く
      const path = await selectFolder();
      if (!path) return;

      setIsLoading(true);
      setFolderPath(path);

      // バックエンドでフォルダを開く
      const result = await openFolder(path);

      // セッション情報を保存
      sessionRef.current = {
        id: result.session_id,
        cacheDir: result.cache_dir,
      };

      // ラベル情報をマップに変換
      const labelsMap = new Map<string, LabelStatus>();
      result.labels.forEach((l) => {
        if (l.label === 'rejected') {
          labelsMap.set(l.filename, 'rejected');
        }
      });

      // 画像情報をImageItemに変換
      const imageItems = result.images.map((info, index) =>
        toImageItem(info, index, labelsMap, result.cache_dir)
      );

      setImages(imageItems);
      setSelectedIndex(result.last_selected_index);
      setThumbnailProgress({ completed: 0, total: result.images.length });
    } catch (error) {
      console.error('Failed to open folder:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleExport = useCallback(async (destinationPath: string) => {
    if (!folderPath) return;

    const result = await exportAdopted(folderPath, destinationPath);
    console.log('Export result:', result);
  }, [folderPath]);

  const handleSelectExportFolder = useCallback(async (): Promise<string | null> => {
    return await selectExportFolder();
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

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-white/50">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p>読み込み中...</p>
          </div>
        </div>
      ) : images.length === 0 ? (
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
