import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import type { GridConfig } from '@/types';

describe('useKeyboardNavigation', () => {
  const mockGridConfig: GridConfig = {
    columns: 4,
    thumbnailSize: 180,
    gap: 8,
    rowGap: 12,
  };

  const mockHandlers = {
    onSelect: vi.fn(),
    onToggleLabel: vi.fn(),
    onEnterDetail: vi.fn(),
    onExitDetail: vi.fn(),
    onOpenFolder: vi.fn(),
    onExport: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const dispatchKeyDown = (key: string, options: Partial<KeyboardEventInit> = {}) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    window.dispatchEvent(event);
  };

  describe('Grid mode navigation', () => {
    it('should move left with ArrowLeft', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('ArrowLeft');

      expect(mockHandlers.onSelect).toHaveBeenCalledWith(4);
    });

    it('should not move left when at index 0', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 0,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('ArrowLeft');

      expect(mockHandlers.onSelect).not.toHaveBeenCalled();
    });

    it('should move right with ArrowRight', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('ArrowRight');

      expect(mockHandlers.onSelect).toHaveBeenCalledWith(6);
    });

    it('should not move right when at last index', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 19,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('ArrowRight');

      expect(mockHandlers.onSelect).not.toHaveBeenCalled();
    });

    it('should move up with ArrowUp', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 8, // Second row
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('ArrowUp');

      expect(mockHandlers.onSelect).toHaveBeenCalledWith(4); // Previous row
    });

    it('should move down with ArrowDown', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 4,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('ArrowDown');

      expect(mockHandlers.onSelect).toHaveBeenCalledWith(8);
    });

    it('should toggle label with 1 key', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('1');

      expect(mockHandlers.onToggleLabel).toHaveBeenCalled();
    });

    it('should enter detail mode with Enter', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('Enter');

      expect(mockHandlers.onEnterDetail).toHaveBeenCalled();
    });

    it('should enter detail mode with Space', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown(' ');

      expect(mockHandlers.onEnterDetail).toHaveBeenCalled();
    });

    it('should go to first item with Home', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 15,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('Home');

      expect(mockHandlers.onSelect).toHaveBeenCalledWith(0);
    });

    it('should go to last item with End', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('End');

      expect(mockHandlers.onSelect).toHaveBeenCalledWith(19);
    });
  });

  describe('Detail mode navigation', () => {
    it('should exit detail mode with Escape', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'detail',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('Escape');

      expect(mockHandlers.onExitDetail).toHaveBeenCalled();
    });

    it('should navigate with arrows in detail mode', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'detail',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('ArrowRight');
      expect(mockHandlers.onSelect).toHaveBeenCalledWith(6);

      dispatchKeyDown('ArrowLeft');
      expect(mockHandlers.onSelect).toHaveBeenCalledWith(4);
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should open folder with Ctrl+O', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('o', { ctrlKey: true });

      expect(mockHandlers.onOpenFolder).toHaveBeenCalled();
    });

    it('should export with Ctrl+E', () => {
      renderHook(() =>
        useKeyboardNavigation({
          totalItems: 20,
          selectedIndex: 5,
          gridConfig: mockGridConfig,
          viewMode: 'grid',
          ...mockHandlers,
        })
      );

      dispatchKeyDown('e', { ctrlKey: true });

      expect(mockHandlers.onExport).toHaveBeenCalled();
    });
  });
});
