// Image file information
export interface ImageFile {
  filename: string;
  path: string;
  size: number;
  modifiedAt: string;
  thumbnailPath?: string;
  thumbnailLoaded: boolean;
  previewPath?: string; // For RAW files, a larger preview image path
}

// Label status
export type LabelStatus = 'rejected' | null;

// Complete information including image and label
export interface ImageItem extends ImageFile {
  label: LabelStatus;
  index: number;
}

// Session information
export interface Session {
  id: string;
  folderPath: string;
  lastOpened: string;
  lastSelectedIndex: number;
  totalFiles: number;
}

// View mode
export type ViewMode = 'grid' | 'detail' | 'compare' | 'gallery';

// Application state
export interface AppState {
  // Current session
  session: Session | null;
  // Image list
  images: ImageItem[];
  // Selected index
  selectedIndex: number;
  // View mode
  viewMode: ViewMode;
  // Loading state
  loading: boolean;
  // Thumbnail generation progress
  thumbnailProgress: {
    completed: number;
    total: number;
  };
}

// Tauri events
export interface ThumbnailGeneratedEvent {
  filename: string;
  thumbnailPath: string;
  previewPath?: string; // For RAW files
}

export interface ThumbnailProgressEvent {
  completed: number;
  total: number;
}

// Grid configuration
export interface GridConfig {
  columns: number;
  thumbnailSize: number;
  gap: number;
  rowGap: number;
}

// Filter settings
export type FilterMode = 'all' | 'adopted' | 'rejected';

// Theme settings
export type ThemeMode = 'dark' | 'light';

// Selection state
export interface SelectionState {
  selectedIndices: Set<number>;
  lastSelectedIndex: number;
  isMultiSelectMode: boolean;
}
