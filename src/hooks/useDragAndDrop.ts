import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

interface UseDragAndDropProps {
  onDrop: (folderPath: string) => void;
  enabled?: boolean;
}

interface UseDragAndDropReturn {
  isDragging: boolean;
}

interface TauriDragDropPayload {
  paths: string[];
  position: { x: number; y: number };
}

export function useDragAndDrop({ onDrop, enabled = true }: UseDragAndDropProps): UseDragAndDropReturn {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // `cancelled` guards against the async setup racing with StrictMode's double-invoke:
    // if cleanup runs before a `listen()` call resolves, we unregister on the spot.
    let cancelled = false;
    let unlistenDragEnter: (() => void) | undefined;
    let unlistenDragLeave: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;

    const setupListeners = async () => {
      const enterFn = await listen('tauri://drag-enter', () => {
        setIsDragging(true);
      });
      if (cancelled) { enterFn(); return; }
      unlistenDragEnter = enterFn;

      const leaveFn = await listen('tauri://drag-leave', () => {
        setIsDragging(false);
      });
      if (cancelled) { leaveFn(); return; }
      unlistenDragLeave = leaveFn;

      const dropFn = await listen<TauriDragDropPayload>('tauri://drag-drop', (event) => {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          onDrop(paths[0]);
        }
      });
      if (cancelled) { dropFn(); return; }
      unlistenDrop = dropFn;
    };

    setupListeners().catch((err) => {
      console.error('Failed to register drag-drop listeners:', err);
    });

    return () => {
      cancelled = true;
      unlistenDragEnter?.();
      unlistenDragLeave?.();
      unlistenDrop?.();
    };
  }, [enabled, onDrop]);

  return {
    isDragging,
  };
}
