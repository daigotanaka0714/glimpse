import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { ImageItem, LabelStatus } from '@/types';

// Convert file path to asset URL (cross-platform support)
export function toAssetUrl(filePath: string): string {
  return convertFileSrc(filePath);
}

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
  preview_path: string | null; // For RAW files, path to larger preview image
  success: boolean;
  error: string | null;
}

export interface ExportResult {
  total: number;
  copied: number;
  skipped: number;
  failed: number;
}

export interface ExifInfo {
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  focal_length: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  iso: string | null;
  exposure_compensation: string | null;
  date_taken: string | null;
  width: number | null;
  height: number | null;
  orientation: number | null;
}

// Open folder selection dialog
export async function selectFolder(): Promise<string | null> {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: 'Select Photo Folder',
  });
  return selected as string | null;
}

// Open folder and get image list
export async function openFolder(folderPath: string): Promise<OpenFolderResult> {
  return await invoke('open_folder', { folderPath });
}

// Set label
export async function setLabel(
  filename: string,
  label: LabelStatus
): Promise<void> {
  await invoke('set_label', {
    filename,
    label: label === 'rejected' ? 'rejected' : null,
  });
}

// Save selection position
export async function saveSelection(index: number): Promise<void> {
  await invoke('save_selection', { index });
}

// Export
export async function exportAdopted(
  sourceFolder: string,
  destinationFolder: string,
  mode: 'copy' | 'move' = 'copy'
): Promise<ExportResult> {
  return await invoke('export_adopted', { sourceFolder, destinationFolder, mode });
}

// Select export destination folder
export async function selectExportFolder(): Promise<string | null> {
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title: 'Select Export Destination Folder',
  });
  return selected as string | null;
}

// Get EXIF info
export async function getExif(imagePath: string): Promise<ExifInfo> {
  return await invoke('get_exif', { imagePath });
}

// Clear thumbnail cache
export async function clearCache(): Promise<void> {
  await invoke('clear_cache');
}

// Listen for thumbnail progress events
export async function onThumbnailProgress(
  callback: (progress: ThumbnailProgress) => void
): Promise<() => void> {
  const unlisten = await listen<ThumbnailProgress>('thumbnail-progress', (event) => {
    callback(event.payload);
  });
  return unlisten;
}

// Listen for thumbnail generation complete events
export async function onThumbnailsComplete(
  callback: (results: ThumbnailResult[]) => void
): Promise<() => void> {
  const unlisten = await listen<ThumbnailResult[]>('thumbnails-complete', (event) => {
    callback(event.payload);
  });
  return unlisten;
}

// Convert image info to ImageItem
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
