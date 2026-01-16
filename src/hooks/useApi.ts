import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  ImageFile,
  Session,
  Label,
  ThumbnailResult,
  OpenFolderResult,
  ExportResult,
  GenerateThumbnailsRequest,
} from "../types";

export async function openFolderDialog(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Image Folder",
  });
  return selected as string | null;
}

export async function saveExportDialog(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select Export Destination",
  });
  return selected as string | null;
}

export async function openFolder(folderPath: string): Promise<OpenFolderResult> {
  return invoke<OpenFolderResult>("open_folder", { folderPath });
}

export async function getImages(folderPath: string): Promise<ImageFile[]> {
  return invoke<ImageFile[]>("get_images", { folderPath });
}

export async function generateThumbnails(
  request: GenerateThumbnailsRequest
): Promise<ThumbnailResult[]> {
  return invoke<ThumbnailResult[]>("generate_thumbnails", { request });
}

export async function getThumbnailPath(
  sessionId: string,
  filename: string
): Promise<string> {
  return invoke<string>("get_thumbnail_path", { sessionId, filename });
}

export async function setLabel(
  sessionId: string,
  filename: string,
  label: string | null
): Promise<void> {
  return invoke<void>("set_label", { sessionId, filename, label });
}

export async function getLabel(
  sessionId: string,
  filename: string
): Promise<string | null> {
  return invoke<string | null>("get_label", { sessionId, filename });
}

export async function getAllLabels(sessionId: string): Promise<Label[]> {
  return invoke<Label[]>("get_all_labels", { sessionId });
}

export async function updateSelectedIndex(
  sessionId: string,
  index: number
): Promise<void> {
  return invoke<void>("update_selected_index", { sessionId, index });
}

export async function getSession(sessionId: string): Promise<Session | null> {
  return invoke<Session | null>("get_session", { sessionId });
}

export async function loadFullImage(path: string): Promise<string> {
  return invoke<string>("load_full_image", { path });
}

export async function exportApprovedFiles(
  sessionId: string,
  sourceFolder: string,
  destFolder: string
): Promise<ExportResult> {
  return invoke<ExportResult>("export_approved_files", {
    sessionId,
    sourceFolder,
    destFolder,
  });
}
