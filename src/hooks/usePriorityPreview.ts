import { useEffect, useRef } from "react";
import type { ImageItem } from "@/types";
import { isRawFile } from "@/utils/imageSource";
import { ensurePreview } from "@/utils/tauri";

/**
 * 表示中の RAW のプレビューを、一括生成の順番を待たずに作らせる。
 *
 * 一括生成はフォルダの先頭から順に進むので、3,000枚なら後ろの方は数分待つ。
 * その間はサムネイルで代用しているため、見ている1枚だけ先に作る。
 * 同じファイルは（失敗しても）一度しか頼まない。
 */
export function usePriorityPreview(
  displayedItems: ReadonlyArray<ImageItem | null | undefined>,
  onPreviewReady: (imagePath: string, previewPath: string) => void,
) {
  const requestedRef = useRef(new Set<string>());

  useEffect(() => {
    for (const item of displayedItems) {
      if (!item || item.previewPath || !isRawFile(item.filename)) continue;
      if (requestedRef.current.has(item.path)) continue;
      requestedRef.current.add(item.path);

      const imagePath = item.path;
      ensurePreview(imagePath)
        .then((previewPath) => onPreviewReady(imagePath, previewPath))
        .catch((error) => {
          console.error(`Failed to prepare preview for ${imagePath}:`, error);
        });
    }
  }, [displayedItems, onPreviewReady]);
}
