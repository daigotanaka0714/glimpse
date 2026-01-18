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
  // 状態管理
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'detail' | 'compare'>('grid');
  const [compareIndex, setCompareIndex] = useState(1); // 比較モード用の2枚目インデックス
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Phase 2 新機能
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [baseThumbnailSize, setBaseThumbnailSize] = useState(180);

  const { config: gridConfig, setBaseThumbnailSize: updateGridSize, minSize, maxSize } = useGridConfig();

  // セッション情報を保持
  const sessionRef = useRef<{ id: string; cacheDir: string } | null>(null);

  // テーマの適用
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // サムネイルサイズ変更時にグリッドを更新
  const handleThumbnailSizeChange = useCallback((size: number) => {
    setBaseThumbnailSize(size);
    updateGridSize(size);
  }, [updateGridSize]);

  // フォルダを開く処理（ダイアログなし版 - ドラッグ&ドロップ用）
  const handleOpenFolderByPath = useCallback(async (path: string) => {
    try {
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
      setSelectedIndices(new Set());
      setThumbnailProgress({ completed: 0, total: result.images.length });
    } catch (error) {
      console.error('Failed to open folder:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ドラッグ&ドロップ
  const { isDragging } = useDragAndDrop({
    onDrop: handleOpenFolderByPath,
    enabled: true,
  });

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

        // 完了通知音を再生
        playCompletionSound();
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

  // フィルタリングされた画像リスト
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

  // ラベル集計
  const { rejectedCount, adoptedCount } = useMemo(() => {
    const rejected = images.filter((img) => img.label === 'rejected').length;
    return {
      rejectedCount: rejected,
      adoptedCount: images.length - rejected,
    };
  }, [images]);

  // 選択中のアイテム（フィルタ後のインデックスから取得）
  const selectedItem = filteredImages[selectedIndex] || null;

  // アクション
  const handleSelect = useCallback((index: number, event?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }) => {
    const isMultiSelect = event?.ctrlKey || event?.metaKey;
    const isRangeSelect = event?.shiftKey;

    if (isMultiSelect) {
      // Ctrl/Cmd + クリック: トグル選択
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
      // Shift + クリック: 範囲選択
      const start = Math.min(selectedIndex, index);
      const end = Math.max(selectedIndex, index);
      const newSet = new Set<number>();
      for (let i = start; i <= end; i++) {
        newSet.add(i);
      }
      setSelectedIndices(newSet);
      setSelectedIndex(index);
    } else {
      // 通常クリック: 単一選択
      setSelectedIndex(index);
      setSelectedIndices(new Set([index]));
    }
  }, [selectedIndex, selectedIndices]);

  const handleToggleLabel = useCallback(async () => {
    // 複数選択時は選択されているすべての画像にラベルを適用
    const indicesToToggle = selectedIndices.size > 0
      ? Array.from(selectedIndices)
      : [selectedIndex];

    if (indicesToToggle.length === 0 || indicesToToggle.some(i => i < 0 || i >= filteredImages.length)) return;

    // 最初の選択画像のラベル状態を基準にする
    const firstImage = filteredImages[indicesToToggle[0]];
    const newLabel: LabelStatus = firstImage.label === 'rejected' ? null : 'rejected';

    // UI即時更新
    setImages((prev) =>
      prev.map((img) => {
        const filteredIndex = filteredImages.findIndex(fi => fi.filename === img.filename);
        if (indicesToToggle.includes(filteredIndex)) {
          return { ...img, label: newLabel };
        }
        return img;
      })
    );

    // バックエンドに保存
    try {
      for (const idx of indicesToToggle) {
        const img = filteredImages[idx];
        await setLabelApi(img.filename, newLabel);
      }
    } catch (error) {
      console.error('Failed to set label:', error);
      // エラー時は元の状態に戻す必要があるが、簡易的に無視
    }
  }, [selectedIndex, selectedIndices, filteredImages]);

  // 一括で不採用ラベルを設定
  const handleBatchMarkRejected = useCallback(async () => {
    if (selectedIndices.size === 0) return;

    const indicesToMark = Array.from(selectedIndices);

    // UI即時更新
    setImages((prev) =>
      prev.map((img) => {
        const filteredIndex = filteredImages.findIndex(fi => fi.filename === img.filename);
        if (indicesToMark.includes(filteredIndex)) {
          return { ...img, label: 'rejected' };
        }
        return img;
      })
    );

    // バックエンドに保存
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

  // 一括で不採用ラベルを解除
  const handleBatchRemoveRejected = useCallback(async () => {
    if (selectedIndices.size === 0) return;

    const indicesToMark = Array.from(selectedIndices);

    // UI即時更新
    setImages((prev) =>
      prev.map((img) => {
        const filteredIndex = filteredImages.findIndex(fi => fi.filename === img.filename);
        if (indicesToMark.includes(filteredIndex)) {
          return { ...img, label: null };
        }
        return img;
      })
    );

    // バックエンドに保存
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

  // フィルター中の全画像に不採用ラベルを設定
  const handleBatchMarkAllRejected = useCallback(async () => {
    if (filteredImages.length === 0) return;

    // UI即時更新
    const filteredFilenames = new Set(filteredImages.map(fi => fi.filename));
    setImages((prev) =>
      prev.map((img) => {
        if (filteredFilenames.has(img.filename)) {
          return { ...img, label: 'rejected' };
        }
        return img;
      })
    );

    // バックエンドに保存
    try {
      for (const img of filteredImages) {
        await setLabelApi(img.filename, 'rejected');
      }
    } catch (error) {
      console.error('Failed to set labels:', error);
    }
  }, [filteredImages]);

  // フィルター中の全画像から不採用ラベルを解除
  const handleBatchRemoveAllRejected = useCallback(async () => {
    if (filteredImages.length === 0) return;

    // UI即時更新
    const filteredFilenames = new Set(filteredImages.map(fi => fi.filename));
    setImages((prev) =>
      prev.map((img) => {
        if (filteredFilenames.has(img.filename)) {
          return { ...img, label: null };
        }
        return img;
      })
    );

    // バックエンドに保存
    try {
      for (const img of filteredImages) {
        await setLabelApi(img.filename, null);
      }
    } catch (error) {
      console.error('Failed to remove labels:', error);
    }
  }, [filteredImages]);

  // 選択をクリア
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

  // 比較モード
  const handleEnterCompare = useCallback(() => {
    if (filteredImages.length >= 2) {
      // 複数選択されている場合はその2枚を比較
      if (selectedIndices.size >= 2) {
        const indices = Array.from(selectedIndices).sort((a, b) => a - b);
        setSelectedIndex(indices[0]);
        setCompareIndex(indices[1]);
      } else {
        // 単一選択の場合は次の画像と比較
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
      // フォルダ選択ダイアログを開く
      const path = await selectFolder();
      if (!path) return;

      await handleOpenFolderByPath(path);
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  }, [handleOpenFolderByPath]);

  // サムネイルキャッシュをクリアして再読込
  const handleReload = useCallback(async () => {
    if (!folderPath) return;

    try {
      // キャッシュをクリア
      await clearCache();

      // サムネイルのロード状態をリセット
      setImages((prev) =>
        prev.map((img) => ({ ...img, thumbnailLoaded: false }))
      );

      // フォルダを再読み込み（サムネイル再生成がトリガーされる）
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

  // キーボードナビゲーション
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

      {/* 複数選択時のバッチアクションバー */}
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
            <p>読み込み中...</p>
          </div>
        </div>
      ) : images.length === 0 ? (
        <EmptyState onOpenFolder={handleOpenFolder} />
      ) : filteredImages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-text-secondary">
            <p className="text-lg mb-2">該当する写真がありません</p>
            <p className="text-sm">フィルターを変更してください</p>
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

      {/* ドラッグ&ドロップオーバーレイ */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-accent/20 border-4 border-dashed border-accent pointer-events-none">
          <div className="text-center">
            <div className="text-6xl mb-4">📁</div>
            <p className="text-xl font-medium text-text-primary">フォルダをドロップして開く</p>
          </div>
        </div>
      )}
    </div>
  );
}
