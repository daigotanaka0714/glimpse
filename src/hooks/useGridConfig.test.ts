import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import type { MutableRefObject } from 'react';
import { useGridConfig } from './useGridConfig';

const GAP = 8;
const ROW_GAP = 12;
const DEFAULT_THUMBNAIL_SIZE = 180;
const DEBOUNCE_MS = 200;

/** Create a detached div with a fixed clientWidth (jsdom always reports 0) */
function createContainer(width: number): HTMLDivElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', {
    configurable: true,
    value: width,
  });
  return container;
}

describe('useGridConfig', () => {
  const observeSpy = vi.fn();
  const unobserveSpy = vi.fn();
  const disconnectSpy = vi.fn();
  const constructSpy = vi.fn();
  let resizeCallback: ResizeObserverCallback | null;
  let originalResizeObserver: typeof ResizeObserver;

  class MockResizeObserver {
    observe = observeSpy;
    unobserve = unobserveSpy;
    disconnect = disconnectSpy;

    constructor(callback: ResizeObserverCallback) {
      constructSpy(callback);
      resizeCallback = callback;
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resizeCallback = null;
    originalResizeObserver = global.ResizeObserver;
    global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    global.ResizeObserver = originalResizeObserver;
    vi.useRealTimers();
  });

  /**
   * Render the hook and attach `container` to its ref in a layout effect,
   * so it is available before the hook's own (passive) effects run.
   */
  const renderUseGridConfig = (container?: HTMLDivElement) =>
    renderHook(() => {
      const grid = useGridConfig();
      const ref = grid.containerRef as MutableRefObject<HTMLDivElement | null>;
      useLayoutEffect(() => {
        if (container) {
          ref.current = container;
        }
      }, [ref, container]);
      return grid;
    });

  /** Fire a debounced ResizeObserver callback and let the debounce elapse */
  const triggerResize = (width: number) => {
    act(() => {
      resizeCallback?.(
        [{ contentRect: { width } } as ResizeObserverEntry],
        {} as ResizeObserver
      );
      vi.advanceTimersByTime(DEBOUNCE_MS);
    });
  };

  describe('initial state', () => {
    it('should return default config when no container is attached', () => {
      const { result } = renderUseGridConfig();

      expect(result.current.config).toEqual({
        columns: 6,
        thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
        gap: GAP,
        rowGap: ROW_GAP,
      });
    });

    it('should expose thumbnail size bounds', () => {
      const { result } = renderUseGridConfig();

      expect(result.current.minSize).toBe(100);
      expect(result.current.maxSize).toBe(300);
    });

    it('should keep default config when container width is 0', () => {
      const { result } = renderUseGridConfig(createContainer(0));

      expect(result.current.config.columns).toBe(6);
      expect(result.current.config.thumbnailSize).toBe(DEFAULT_THUMBNAIL_SIZE);
    });
  });

  describe('grid calculation', () => {
    it('should calculate columns and thumbnail size from container width', () => {
      const { result } = renderUseGridConfig(createContainer(800));

      // floor((800 + 8) / (180 + 8)) = 4 columns
      expect(result.current.config.columns).toBe(4);
      // floor((800 - 8 * 3) / 4) = 194
      expect(result.current.config.thumbnailSize).toBe(194);
      expect(result.current.config.gap).toBe(GAP);
      expect(result.current.config.rowGap).toBe(ROW_GAP);
    });

    it('should calculate more columns for a wider container', () => {
      const { result } = renderUseGridConfig(createContainer(1200));

      // floor((1200 + 8) / 188) = 6 columns
      expect(result.current.config.columns).toBe(6);
      // floor((1200 - 8 * 5) / 6) = 193
      expect(result.current.config.thumbnailSize).toBe(193);
    });

    it('should keep at least 1 column for a very narrow container', () => {
      const { result } = renderUseGridConfig(createContainer(50));

      expect(result.current.config.columns).toBe(1);
      expect(result.current.config.thumbnailSize).toBe(50);
    });
  });

  describe('setBaseThumbnailSize', () => {
    it('should recalculate with a smaller base size', () => {
      const { result } = renderUseGridConfig(createContainer(800));

      act(() => {
        result.current.setBaseThumbnailSize(100);
      });

      // floor((800 + 8) / (100 + 8)) = 7 columns
      expect(result.current.config.columns).toBe(7);
      // floor((800 - 8 * 6) / 7) = 107
      expect(result.current.config.thumbnailSize).toBe(107);
    });

    it('should recalculate with a larger base size', () => {
      const { result } = renderUseGridConfig(createContainer(800));

      act(() => {
        result.current.setBaseThumbnailSize(300);
      });

      // floor((800 + 8) / (300 + 8)) = 2 columns
      expect(result.current.config.columns).toBe(2);
      // floor((800 - 8) / 2) = 396
      expect(result.current.config.thumbnailSize).toBe(396);
    });
  });

  describe('ResizeObserver', () => {
    it('should observe the container and disconnect on unmount', () => {
      const container = createContainer(800);
      const { unmount } = renderUseGridConfig(container);

      expect(observeSpy).toHaveBeenCalledWith(container);

      unmount();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should not create an observer when no container is attached', () => {
      renderUseGridConfig();

      expect(constructSpy).not.toHaveBeenCalled();
      expect(observeSpy).not.toHaveBeenCalled();
    });

    it('should recalculate on resize', () => {
      const { result } = renderUseGridConfig(createContainer(800));

      triggerResize(1200);

      expect(result.current.config.columns).toBe(6);
      expect(result.current.config.thumbnailSize).toBe(193);
    });

    it('should debounce resize callbacks', () => {
      const { result } = renderUseGridConfig(createContainer(800));

      act(() => {
        resizeCallback?.(
          [{ contentRect: { width: 1200 } } as ResizeObserverEntry],
          {} as ResizeObserver
        );
        vi.advanceTimersByTime(DEBOUNCE_MS - 1);
      });

      // Still the pre-resize value
      expect(result.current.config.columns).toBe(4);

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.config.columns).toBe(6);
    });

    it('should only apply the last width when resized repeatedly', () => {
      const { result } = renderUseGridConfig(createContainer(800));

      act(() => {
        [1200, 50, 400].forEach((width) => {
          resizeCallback?.(
            [{ contentRect: { width } } as ResizeObserverEntry],
            {} as ResizeObserver
          );
          vi.advanceTimersByTime(DEBOUNCE_MS - 1);
        });
        vi.advanceTimersByTime(1);
      });

      // floor((400 + 8) / 188) = 2 columns, floor((400 - 8) / 2) = 196
      expect(result.current.config.columns).toBe(2);
      expect(result.current.config.thumbnailSize).toBe(196);
    });

    it('should keep the same config object when the result is unchanged', () => {
      const { result } = renderUseGridConfig(createContainer(800));
      const previousConfig = result.current.config;

      triggerResize(800);

      expect(result.current.config).toBe(previousConfig);
    });

    it('should ignore a resize to zero width', () => {
      const { result } = renderUseGridConfig(createContainer(800));

      triggerResize(0);

      expect(result.current.config.columns).toBe(4);
      expect(result.current.config.thumbnailSize).toBe(194);
    });
  });
});
