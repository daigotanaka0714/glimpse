import { useEffect, useCallback } from 'react';
import type { GridConfig } from '@/types';

interface UseKeyboardNavigationProps {
  totalItems: number;
  selectedIndex: number;
  compareIndex?: number;
  gridConfig: GridConfig;
  viewMode: 'grid' | 'detail' | 'compare';
  onSelect: (index: number) => void;
  onSelectCompare?: (index: number) => void;
  onToggleLabel: () => void;
  onToggleLabelCompare?: () => void;
  onEnterDetail: () => void;
  onExitDetail: () => void;
  onEnterCompare?: () => void;
  onExitCompare?: () => void;
  onClearSelection?: () => void;
  onOpenFolder: () => void;
  onExport: () => void;
}

export function useKeyboardNavigation({
  totalItems,
  selectedIndex,
  compareIndex = 0,
  gridConfig,
  viewMode,
  onSelect,
  onSelectCompare,
  onToggleLabel,
  onToggleLabelCompare,
  onEnterDetail,
  onExitDetail,
  onEnterCompare,
  onExitCompare,
  onClearSelection,
  onOpenFolder,
  onExport,
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ctrl/Cmd + key combinations
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            onOpenFolder();
            return;
          case 'e':
            e.preventDefault();
            onExport();
            return;
        }
      }

      // Detail view mode
      if (viewMode === 'detail') {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            onExitDetail();
            return;
          case 'ArrowLeft':
            e.preventDefault();
            if (selectedIndex > 0) {
              onSelect(selectedIndex - 1);
            }
            return;
          case 'ArrowRight':
            e.preventDefault();
            if (selectedIndex < totalItems - 1) {
              onSelect(selectedIndex + 1);
            }
            return;
          case '1':
            e.preventDefault();
            onToggleLabel();
            return;
        }
        return;
      }

      // Compare mode
      if (viewMode === 'compare') {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            onExitCompare?.();
            return;
          case 'ArrowLeft':
            e.preventDefault();
            if (e.shiftKey) {
              // Shift + Left arrow: move right image to previous
              if (compareIndex > 0 && onSelectCompare) {
                onSelectCompare(compareIndex - 1);
              }
            } else {
              // Left arrow: move left image to previous
              if (selectedIndex > 0) {
                onSelect(selectedIndex - 1);
              }
            }
            return;
          case 'ArrowRight':
            e.preventDefault();
            if (e.shiftKey) {
              // Shift + Right arrow: move right image to next
              if (compareIndex < totalItems - 1 && onSelectCompare) {
                onSelectCompare(compareIndex + 1);
              }
            } else {
              // Right arrow: move left image to next
              if (selectedIndex < totalItems - 1) {
                onSelect(selectedIndex + 1);
              }
            }
            return;
          case '1':
            e.preventDefault();
            onToggleLabel();
            return;
          case '2':
            e.preventDefault();
            onToggleLabelCompare?.();
            return;
        }
        return;
      }

      // Grid view mode
      const { columns } = gridConfig;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClearSelection?.();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (selectedIndex > 0) {
            onSelect(selectedIndex - 1);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (selectedIndex < totalItems - 1) {
            onSelect(selectedIndex + 1);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (selectedIndex >= columns) {
            onSelect(selectedIndex - columns);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (selectedIndex + columns < totalItems) {
            onSelect(selectedIndex + columns);
          } else if (selectedIndex < totalItems - 1) {
            onSelect(totalItems - 1);
          }
          break;

        case '1':
          e.preventDefault();
          onToggleLabel();
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          onEnterDetail();
          break;

        case 'Home':
          e.preventDefault();
          onSelect(0);
          break;

        case 'End':
          e.preventDefault();
          onSelect(totalItems - 1);
          break;

        case 'PageUp':
          e.preventDefault();
          {
            const pageSize = columns * 5;
            onSelect(Math.max(0, selectedIndex - pageSize));
          }
          break;

        case 'PageDown':
          e.preventDefault();
          {
            const pageSize = columns * 5;
            onSelect(Math.min(totalItems - 1, selectedIndex + pageSize));
          }
          break;

        case 'c':
        case 'C':
          e.preventDefault();
          onEnterCompare?.();
          break;
      }
    },
    [
      totalItems,
      selectedIndex,
      compareIndex,
      gridConfig,
      viewMode,
      onSelect,
      onSelectCompare,
      onToggleLabel,
      onToggleLabelCompare,
      onEnterDetail,
      onExitDetail,
      onEnterCompare,
      onExitCompare,
      onClearSelection,
      onOpenFolder,
      onExport,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
