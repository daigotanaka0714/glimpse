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

    let unlistenDragEnter: (() => void) | undefined;
    let unlistenDragLeave: (() => void) | undefined;
    let unlistenDrop: (() => void) | undefined;

    const setupListeners = async () => {
      // Listen for drag enter
      unlistenDragEnter = await listen('tauri://drag-enter', () => {
        setIsDragging(true);
      });

      // Listen for drag leave
      unlistenDragLeave = await listen('tauri://drag-leave', () => {
        setIsDragging(false);
      });

      // Listen for file drop
      unlistenDrop = await listen<TauriDragDropPayload>('tauri://drag-drop', (event) => {
        setIsDragging(false);
        const paths = event.payload.paths;
        if (paths && paths.length > 0) {
          // Use the first dropped path (assuming it's a folder)
          onDrop(paths[0]);
        }
      });
    };

    setupListeners();

    return () => {
      unlistenDragEnter?.();
      unlistenDragLeave?.();
      unlistenDrop?.();
    };
  }, [enabled, onDrop]);

  return {
    isDragging,
  };
}
