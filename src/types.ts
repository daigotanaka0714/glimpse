export interface ImageFile {
  filename: string;
  path: string;
  modified: string;
  size: number;
  is_raw: boolean;
}

export interface Session {
  id: string;
  folder_path: string;
  last_opened: string | null;
  last_selected_index: number;
  total_files: number;
  created_at: string;
}

export interface Label {
  session_id: string;
  filename: string;
  label: string | null;
  updated_at: string;
}

export interface ThumbnailResult {
  filename: string;
  thumbnail_path: string;
  success: boolean;
  error: string | null;
}

export interface OpenFolderResult {
  session: Session;
  images: ImageFile[];
}

export interface ExportResult {
  total_approved: number;
  copied: number;
  errors: string[];
}

export interface GenerateThumbnailsRequest {
  session_id: string;
  images: ImageFile[];
  size?: number;
}

export type ViewMode = 'grid' | 'detail';
