// 画像ファイル情報
export interface ImageFile {
  filename: string;
  path: string;
  size: number;
  modifiedAt: string;
  thumbnailPath?: string;
  thumbnailLoaded: boolean;
}

// ラベル状態
export type LabelStatus = 'rejected' | null;

// 画像とラベルを含む完全な情報
export interface ImageItem extends ImageFile {
  label: LabelStatus;
  index: number;
}

// セッション情報
export interface Session {
  id: string;
  folderPath: string;
  lastOpened: string;
  lastSelectedIndex: number;
  totalFiles: number;
}

// アプリケーション状態
export interface AppState {
  // 現在のセッション
  session: Session | null;
  // 画像リスト
  images: ImageItem[];
  // 選択中のインデックス
  selectedIndex: number;
  // 表示モード
  viewMode: 'grid' | 'detail';
  // ローディング状態
  loading: boolean;
  // サムネイル生成進捗
  thumbnailProgress: {
    completed: number;
    total: number;
  };
}

// Tauriからのイベント
export interface ThumbnailGeneratedEvent {
  filename: string;
  thumbnailPath: string;
}

export interface ThumbnailProgressEvent {
  completed: number;
  total: number;
}

// グリッド設定
export interface GridConfig {
  columns: number;
  thumbnailSize: number;
  gap: number;
  rowGap: number;
}

// フィルター設定
export type FilterMode = 'all' | 'adopted' | 'rejected';

// テーマ設定
export type ThemeMode = 'dark' | 'light';

// 選択状態
export interface SelectionState {
  selectedIndices: Set<number>;
  lastSelectedIndex: number;
  isMultiSelectMode: boolean;
}
