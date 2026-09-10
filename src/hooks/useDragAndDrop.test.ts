import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDragAndDrop } from './useDragAndDrop';

// Mock the Tauri event API (overrides the global mock in src/test/setup.ts)
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

import { listen } from '@tauri-apps/api/event';

type EventHandler = (event: { payload: unknown }) => void;

const DRAG_ENTER = 'tauri://drag-enter';
const DRAG_LEAVE = 'tauri://drag-leave';
const DRAG_DROP = 'tauri://drag-drop';

describe('useDragAndDrop', () => {
  const mockListen = listen as unknown as Mock;

  // Handlers and unlisten fns captured from each listen() call, keyed by event name
  let handlers: Map<string, EventHandler>;
  let unlisteners: Map<string, Mock>;
  let onDrop: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = new Map();
    unlisteners = new Map();
    onDrop = vi.fn();

    mockListen.mockImplementation((event: string, handler: EventHandler) => {
      handlers.set(event, handler);
      const unlisten = vi.fn();
      unlisteners.set(event, unlisten);
      return Promise.resolve(unlisten);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Lets the pending listen() promises inside the effect resolve
  const flush = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  const emit = async (event: string, payload?: unknown) => {
    const handler = handlers.get(event);
    if (!handler) {
      throw new Error(`No handler registered for ${event}`);
    }
    await act(async () => {
      handler({ payload });
    });
  };

  const renderUseDragAndDrop = (overrides = {}) =>
    renderHook(() => useDragAndDrop({ onDrop, ...overrides }));

  describe('listener registration', () => {
    it('should register all three drag events when enabled', async () => {
      renderUseDragAndDrop();
      await flush();

      expect(mockListen).toHaveBeenCalledTimes(3);
      expect(mockListen).toHaveBeenCalledWith(DRAG_ENTER, expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith(DRAG_LEAVE, expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith(DRAG_DROP, expect.any(Function));
    });

    it('should not register anything when disabled', async () => {
      renderUseDragAndDrop({ enabled: false });
      await flush();

      expect(mockListen).not.toHaveBeenCalled();
    });

    it('should register listeners once enabled becomes true', async () => {
      const { rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) => useDragAndDrop({ onDrop, enabled }),
        { initialProps: { enabled: false } }
      );
      await flush();
      expect(mockListen).not.toHaveBeenCalled();

      rerender({ enabled: true });
      await flush();

      expect(mockListen).toHaveBeenCalledTimes(3);
    });
  });

  describe('isDragging state', () => {
    it('should be false initially', async () => {
      const { result } = renderUseDragAndDrop();
      await flush();

      expect(result.current.isDragging).toBe(false);
    });

    it('should become true on drag-enter', async () => {
      const { result } = renderUseDragAndDrop();
      await flush();

      await emit(DRAG_ENTER);

      expect(result.current.isDragging).toBe(true);
    });

    it('should become false again on drag-leave', async () => {
      const { result } = renderUseDragAndDrop();
      await flush();

      await emit(DRAG_ENTER);
      expect(result.current.isDragging).toBe(true);

      await emit(DRAG_LEAVE);
      expect(result.current.isDragging).toBe(false);
    });

    it('should become false on drag-drop', async () => {
      const { result } = renderUseDragAndDrop();
      await flush();

      await emit(DRAG_ENTER);
      expect(result.current.isDragging).toBe(true);

      await emit(DRAG_DROP, { paths: ['/path/to/folder'], position: { x: 0, y: 0 } });
      expect(result.current.isDragging).toBe(false);
    });
  });

  describe('onDrop callback', () => {
    it('should be called with the first dropped path', async () => {
      renderUseDragAndDrop();
      await flush();

      await emit(DRAG_DROP, {
        paths: ['/path/to/folder', '/path/to/other'],
        position: { x: 10, y: 20 },
      });

      expect(onDrop).toHaveBeenCalledTimes(1);
      expect(onDrop).toHaveBeenCalledWith('/path/to/folder');
    });

    it('should not be called when paths is empty', async () => {
      renderUseDragAndDrop();
      await flush();

      await emit(DRAG_DROP, { paths: [], position: { x: 0, y: 0 } });

      expect(onDrop).not.toHaveBeenCalled();
    });

    it('should not be called when paths is missing', async () => {
      const { result } = renderUseDragAndDrop();
      await flush();

      await emit(DRAG_ENTER);
      await emit(DRAG_DROP, { position: { x: 0, y: 0 } });

      expect(onDrop).not.toHaveBeenCalled();
      // isDragging is still reset even without a usable payload
      expect(result.current.isDragging).toBe(false);
    });

    it('should use the latest callback after it changes', async () => {
      const nextOnDrop = vi.fn();
      const { rerender } = renderHook(
        ({ handler }: { handler: Mock }) => useDragAndDrop({ onDrop: handler }),
        { initialProps: { handler: onDrop } }
      );
      await flush();

      rerender({ handler: nextOnDrop });
      await flush();

      await emit(DRAG_DROP, { paths: ['/new/folder'], position: { x: 0, y: 0 } });

      expect(onDrop).not.toHaveBeenCalled();
      expect(nextOnDrop).toHaveBeenCalledWith('/new/folder');
    });
  });

  describe('cleanup', () => {
    it('should unregister all listeners on unmount', async () => {
      const { unmount } = renderUseDragAndDrop();
      await flush();

      unmount();

      expect(unlisteners.get(DRAG_ENTER)).toHaveBeenCalledTimes(1);
      expect(unlisteners.get(DRAG_LEAVE)).toHaveBeenCalledTimes(1);
      expect(unlisteners.get(DRAG_DROP)).toHaveBeenCalledTimes(1);
    });

    it('should unregister previous listeners when the effect re-runs', async () => {
      const { rerender } = renderHook(
        ({ handler }: { handler: Mock }) => useDragAndDrop({ onDrop: handler }),
        { initialProps: { handler: onDrop } }
      );
      await flush();
      const firstDropUnlisten = unlisteners.get(DRAG_DROP);

      rerender({ handler: vi.fn() });
      await flush();

      expect(firstDropUnlisten).toHaveBeenCalledTimes(1);
      // A fresh set of listeners replaced the old ones
      expect(mockListen).toHaveBeenCalledTimes(6);
    });

    it('should unregister a listener that resolves after unmount', async () => {
      const lateUnlisten = vi.fn();
      let resolveListen: ((unlisten: () => void) => void) | undefined;
      mockListen.mockImplementationOnce(
        () =>
          new Promise<() => void>((resolve) => {
            resolveListen = resolve;
          })
      );

      const { unmount } = renderUseDragAndDrop();
      unmount();

      await act(async () => {
        resolveListen?.(lateUnlisten);
      });

      expect(lateUnlisten).toHaveBeenCalledTimes(1);
      // Setup aborted, so the remaining two listeners were never registered
      expect(mockListen).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should log an error when listener registration fails', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('registration failed');
      mockListen.mockRejectedValueOnce(error);

      renderUseDragAndDrop();
      await flush();

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to register drag-drop listeners:',
        error
      );
    });

    it('should not throw when unmounting after a failed registration', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockListen.mockRejectedValue(new Error('registration failed'));

      const { unmount } = renderUseDragAndDrop();
      await flush();

      expect(() => unmount()).not.toThrow();
    });
  });
});
