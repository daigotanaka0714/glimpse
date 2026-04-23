import { useEffect, useCallback } from 'react';
import type { GridConfig } from '@/types';

export interface SelectEventModifiers {
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

interface UseKeyboardNavigationProps {
  totalItems: number;
  selectedIndex: number;
  compareIndex?: number;
  gridConfig: GridConfig;
  viewMode: 'grid' | 'detail' | 'compare' | 'gallery';
  onSelect: (index: number, event?: SelectEventModifiers) => void;
  onSelectCompare?: (index: number) => void;
  onToggleLabel: () => void;
  onToggleLabelCompare?: () => void;
  onEnterDetail: () => void;
  onExitDetail: () => void;
  onEnterCompare?: () => void;
  onExitCompare?: () => void;
  onEnterGallery?: () => void;
  onExitGallery?: () => void;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onOpenFolder: () => void;
  onExport: () => void;
  onOpenHelp?: () => void;
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
  onEnterGallery,
  onExitGallery,
  onClearSelection,
  onSelectAll,
  onOpenFolder,
  onExport,
  onOpenHelp,
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Help shortcut (works globally)
      if (e.key === '?' && onOpenHelp) {
        e.preventDefault();
        onOpenHelp();
        return;
      }

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
          case 'a':
            if (viewMode === 'grid' && onSelectAll) {
              e.preventDefault();
              onSelectAll();
              return;
            }
            break;
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

      // Gallery view mode
      if (viewMode === 'gallery') {
        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            onExitGallery?.();
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
      const navModifiers: SelectEventModifiers = { shiftKey: e.shiftKey };

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClearSelection?.();
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (selectedIndex > 0) {
            onSelect(selectedIndex - 1, navModifiers);
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (selectedIndex < totalItems - 1) {
            onSelect(selectedIndex + 1, navModifiers);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (selectedIndex >= columns) {
            onSelect(selectedIndex - columns, navModifiers);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (selectedIndex + columns < totalItems) {
            onSelect(selectedIndex + columns, navModifiers);
          } else if (selectedIndex < totalItems - 1) {
            onSelect(totalItems - 1, navModifiers);
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
          onSelect(0, navModifiers);
          break;

        case 'End':
          e.preventDefault();
          onSelect(totalItems - 1, navModifiers);
          break;

        case 'PageUp':
          e.preventDefault();
          {
            const pageSize = columns * 5;
            onSelect(Math.max(0, selectedIndex - pageSize), navModifiers);
          }
          break;

        case 'PageDown':
          e.preventDefault();
          {
            const pageSize = columns * 5;
            onSelect(Math.min(totalItems - 1, selectedIndex + pageSize), navModifiers);
          }
          break;

        case 'c':
        case 'C':
          e.preventDefault();
          onEnterCompare?.();
          break;

        case 'g':
        case 'G':
          e.preventDefault();
          onEnterGallery?.();
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
      onEnterGallery,
      onExitGallery,
      onClearSelection,
      onSelectAll,
      onOpenFolder,
      onExport,
      onOpenHelp,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
