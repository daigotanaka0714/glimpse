import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { ImageItem, LabelStatus } from '@/types';

export interface ImageInfo {
  filename: string;
  path: string;
  size: number;
  modified_at: string;
}

export interface Label {
  filename: string;
  label: string | null;
}

export interface OpenFolderResult {
  session_id: string;
  images: ImageInfo[];
  labels: Label[];
  last_selected_index: number;
  cache_dir: string;
}

export interface ThumbnailProgress {
  completed: number;
  total: number;
}

export interface ThumbnailResult {
  filename: string;
  thumbnail_path: string;
  success: boolean;
  error: string | null;
}

export interface ExportResult {
  total: number;
  copied: number;
  skipped: number;
  failed: number;
}

// フォルダ選択ダイアログを開く
export async function selectFolder(): Promise<string | null> {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: '写真フォルダを選択',
  });
  return selected as string | null;
}

// フォルダを開いて画像一覧を取得
export async function openFolder(folderPath: string): Promise<OpenFolderResult> {
  return await invoke('open_folder', { folderPath });
}

// ラベルを設定
export async function setLabel(
  filename: string,
  label: LabelStatus
): Promise<void> {
  await invoke('set_label', {
    filename,
    label: label === 'rejected' ? 'rejected' : null,
  });
}

// 選択位置を保存
export async function saveSelection(index: number): Promise<void> {
  await invoke('save_selection', { index });
}

// エクスポート
export async function exportAdopted(
  sourceFolder: string,
  destinationFolder: string
): Promise<ExportResult> {
  return await invoke('export_adopted', { sourceFolder, destinationFolder });
}

// エクスポート先フォルダ選択
export async function selectExportFolder(): Promise<string | null> {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: 'エクスポート先フォルダを選択',
  });
  return selected as string | null;
}

// サムネイル進捗イベントをリッスン
export async function onThumbnailProgress(
  callback: (progress: ThumbnailProgress) => void
): Promise<() => void> {
  const unlisten = await listen<ThumbnailProgress>('thumbnail-progress', (event) => {
    callback(event.payload);
  });
  return unlisten;
}

// サムネイル生成完了イベントをリッスン
export async function onThumbnailsComplete(
  callback: (results: ThumbnailResult[]) => void
): Promise<() => void> {
  const unlisten = await listen<ThumbnailResult[]>('thumbnails-complete', (event) => {
    callback(event.payload);
  });
  return unlisten;
}

// 画像情報をImageItemに変換
export function toImageItem(
  info: ImageInfo,
  index: number,
  labels: Map<string, LabelStatus>,
  cacheDir: string
): ImageItem {
  const thumbnailFilename = info.filename.replace(/\.[^.]+$/, '.jpg');
  const thumbnailPath = `${cacheDir}/${thumbnailFilename}`;

  return {
    filename: info.filename,
    path: info.path,
    size: info.size,
    modifiedAt: info.modified_at,
    thumbnailPath,
    thumbnailLoaded: false,
    label: labels.get(info.filename) || null,
    index,
  };
}
