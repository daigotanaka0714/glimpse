import { type Dispatch, type SetStateAction, useEffect, useRef } from "react";
import type { ImageItem } from "@/types";
import {
  onThumbnailReady,
  onThumbnailsComplete,
  type ThumbnailResult,
} from "@/utils/tauri";

// 1枚ごとの結果を state に反映する間隔。数千件のイベントのたびに images 全体を
// 作り直すと重いので、この間に届いた分をまとめて1回で反映する。
export const THUMBNAIL_FLUSH_INTERVAL_MS = 150;

/** 生成結果を images に反映する。何も変わらなければ同じ配列を返す */
export function applyThumbnailResults(
  images: ImageItem[],
  results: ThumbnailResult[],
): ImageItem[] {
  const byFilename = new Map<string, ThumbnailResult>();
  for (const result of results) {
    if (result.success) byFilename.set(result.filename, result);
  }
  if (byFilename.size === 0) return images;

  let changed = false;
  const next = images.map((img) => {
    const result = byFilename.get(img.filename);
    if (!result) return img;
    // ensure_preview で先に取れたプレビューを、null で上書きしない
    const previewPath = result.preview_path || img.previewPath;
    if (img.thumbnailLoaded && img.previewPath === previewPath) return img;
    changed = true;
    return { ...img, thumbnailLoaded: true, previewPath };
  });
  return changed ? next : images;
}

/**
 * サムネイル・プレビューの生成結果を受け取り、images に反映する。
 *
 * `thumbnail-ready` は1枚ごとに飛ぶので、ref に溜めて一定間隔でまとめて反映する。
 * `thumbnails-complete` では溜まっている分を反映してから onComplete を呼ぶ。
 * onComplete が変わるとリスナーを張り直すので、安定した関数を渡すこと。
 */
export function useThumbnailResults(
  setImages: Dispatch<SetStateAction<ImageItem[]>>,
  onComplete: () => void,
) {
  const pendingRef = useRef<ThumbnailResult[]>([]);

  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const flush = () => {
      if (pendingRef.current.length === 0) return;
      const results = pendingRef.current;
      pendingRef.current = [];
      setImages((prev) => applyThumbnailResults(prev, results));
    };

    const timer = setInterval(flush, THUMBNAIL_FLUSH_INTERVAL_MS);

    const register = (unlisten: () => void) => {
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    };

    onThumbnailReady((result) => {
      pendingRef.current.push(result);
    }).then(register);

    onThumbnailsComplete((results) => {
      // 1枚ごとの通知が漏れていても、ここで全件がそろう
      pendingRef.current.push(...results);
      flush();
      onComplete();
    }).then(register);

    return () => {
      disposed = true;
      clearInterval(timer);
      for (const unlisten of unlisteners) unlisten();
    };
  }, [setImages, onComplete]);
}
