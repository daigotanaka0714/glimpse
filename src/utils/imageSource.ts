import type { ImageFile } from "@/types";

// src-tauri/src/image_processor.rs の RAW_EXTENSIONS と同じ一覧（小文字で比較する）。
// 片方だけ増やすと、その形式が <img> に RAW のまま渡るので、揃えて変えること。
export const RAW_EXTENSIONS = [
  "nef", // Nikon
  "arw", // Sony
  "cr2", // Canon
  "cr3", // Canon
  "raf", // Fujifilm
  "orf", // Olympus
  "rw2", // Panasonic
  "pef", // Pentax
  "dng", // Adobe DNG
  "srw", // Samsung
] as const;

export function isRawFile(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return false;
  const ext = filename.slice(dot + 1).toLowerCase();
  return (RAW_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * 詳細・比較・ギャラリー表示の <img> に渡すファイルパスを決める。
 *
 * RAW 本体は決して返さない。Windows の WebView2（Chromium）は RAW を
 * デコードできず何も出ない。macOS の WebKit は OS の ImageIO で読めてしまう
 * ため、RAW を渡しても macOS では不具合が隠れる。
 *
 * - プレビューがあればプレビュー
 * - RAW でプレビューが無ければ、読み込み済みのサムネイル（ぼやけても何も出ないよりよい）
 * - サムネイルもまだなら null（呼び出し側はスピナーを出す）
 * - JPEG / PNG は元ファイル
 */
export function getDisplayImagePath(
  item: Pick<
    ImageFile,
    "filename" | "path" | "previewPath" | "thumbnailPath" | "thumbnailLoaded"
  >,
): string | null {
  if (item.previewPath) return item.previewPath;
  if (!isRawFile(item.filename)) return item.path;
  if (item.thumbnailLoaded && item.thumbnailPath) return item.thumbnailPath;
  return null;
}
