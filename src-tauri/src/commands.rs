use crate::config::{self, AppConfig};
use crate::database::{Database, Label, Session};
use crate::error::Result;
use crate::image_processor::{
    extract_exif, generate_session_id, generate_thumbnails_parallel, get_cache_dir, normalize_path,
    scan_folder, ExifInfo, ImageInfo,
};
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

pub struct AppState {
    pub db: Mutex<Database>,
    pub current_session_id: Mutex<Option<String>>,
}

impl AppState {
    pub fn new() -> Result<Self> {
        Ok(Self {
            db: Mutex::new(Database::new()?),
            current_session_id: Mutex::new(None),
        })
    }
}

#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    completed: usize,
    total: usize,
}

/// フォルダを開いて画像一覧を取得
#[tauri::command]
pub async fn open_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    folder_path: String,
) -> std::result::Result<OpenFolderResult, String> {
    let path = Path::new(&folder_path);

    // フォルダをスキャン
    let images = scan_folder(path).map_err(|e| e.to_string())?;

    // セッションIDを生成
    let session_id = generate_session_id(&folder_path);

    // データベースに保存
    {
        let db = state.db.lock().unwrap();

        let session = Session {
            id: session_id.clone(),
            folder_path: folder_path.clone(),
            last_opened: Some(chrono::Local::now().to_rfc3339()),
            last_selected_index: 0,
            total_files: images.len() as i32,
        };

        db.upsert_session(&session).map_err(|e| e.to_string())?;
    }

    // 現在のセッションIDを保存
    {
        let mut current = state.current_session_id.lock().unwrap();
        *current = Some(session_id.clone());
    }

    // ラベル情報を取得
    let labels = {
        let db = state.db.lock().unwrap();
        db.get_labels(&session_id).map_err(|e| e.to_string())?
    };

    // 前回の選択位置を取得
    let last_selected = {
        let db = state.db.lock().unwrap();
        db.get_session(&session_id)
            .map_err(|e| e.to_string())?
            .map(|s| s.last_selected_index)
            .unwrap_or(0)
    };

    // キャッシュディレクトリを取得
    let cache_dir = get_cache_dir(&session_id).map_err(|e| e.to_string())?;

    // バックグラウンドでサムネイル生成
    let images_clone = images.clone();
    let app_for_progress = app.clone();
    let app_for_complete = app.clone();
    let cache_dir_clone = cache_dir.clone();

    tokio::spawn(async move {
        let results = generate_thumbnails_parallel(&images_clone, &cache_dir_clone, move |completed, total| {
            let _ = app_for_progress.emit("thumbnail-progress", ProgressPayload { completed, total });
        });

        // 完了通知
        let _ = app_for_complete.emit("thumbnails-complete", results);
    });

    Ok(OpenFolderResult {
        session_id,
        images,
        labels,
        last_selected_index: last_selected,
        cache_dir: normalize_path(&cache_dir),
    })
}

#[derive(serde::Serialize)]
pub struct OpenFolderResult {
    session_id: String,
    images: Vec<ImageInfo>,
    labels: Vec<Label>,
    last_selected_index: i32,
    cache_dir: String,
}

/// ラベルを設定
#[tauri::command]
pub fn set_label(
    state: State<'_, AppState>,
    filename: String,
    label: Option<String>,
) -> std::result::Result<(), String> {
    let session_id = {
        let current = state.current_session_id.lock().unwrap();
        current.clone().ok_or("No session active")?
    };

    let db = state.db.lock().unwrap();
    db.set_label(&session_id, &filename, label.as_deref())
        .map_err(|e| e.to_string())
}

/// 選択位置を保存
#[tauri::command]
pub fn save_selection(
    state: State<'_, AppState>,
    index: i32,
) -> std::result::Result<(), String> {
    let session_id = {
        let current = state.current_session_id.lock().unwrap();
        current.clone().ok_or("No session active")?
    };

    let db = state.db.lock().unwrap();
    db.update_last_selected(&session_id, index)
        .map_err(|e| e.to_string())
}

/// 採用ファイルをエクスポート
#[tauri::command]
pub async fn export_adopted(
    state: State<'_, AppState>,
    source_folder: String,
    destination_folder: String,
    mode: String,
) -> std::result::Result<ExportResult, String> {
    let session_id = {
        let current = state.current_session_id.lock().unwrap();
        current.clone().ok_or("No session active")?
    };

    // 不採用ラベルを取得
    let rejected_files: std::collections::HashSet<String> = {
        let db = state.db.lock().unwrap();
        db.get_labels(&session_id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter(|l| l.label.as_deref() == Some("rejected"))
            .map(|l| l.filename)
            .collect()
    };

    // フォルダ内のファイルをスキャン
    let images = scan_folder(Path::new(&source_folder)).map_err(|e| e.to_string())?;

    // 出力先フォルダを作成
    std::fs::create_dir_all(&destination_folder).map_err(|e| e.to_string())?;

    let is_move = mode == "move";
    let mut copied = 0;
    let mut failed = 0;

    for image in &images {
        // 不採用でない場合のみエクスポート
        if !rejected_files.contains(&image.filename) {
            let src = Path::new(&image.path);
            let dst = Path::new(&destination_folder).join(&image.filename);

            let result = if is_move {
                // 移動モード: まずコピーしてから元ファイルを削除
                std::fs::copy(&src, &dst).and_then(|_| std::fs::remove_file(&src))
            } else {
                // コピーモード
                std::fs::copy(&src, &dst).map(|_| ())
            };

            match result {
                Ok(_) => copied += 1,
                Err(_) => failed += 1,
            }
        }
    }

    Ok(ExportResult {
        total: images.len(),
        copied,
        skipped: rejected_files.len(),
        failed,
    })
}

#[derive(serde::Serialize)]
pub struct ExportResult {
    total: usize,
    copied: usize,
    skipped: usize,
    failed: usize,
}

/// EXIF情報を取得
#[tauri::command]
pub fn get_exif(image_path: String) -> std::result::Result<ExifInfo, String> {
    extract_exif(std::path::Path::new(&image_path)).map_err(|e| e.to_string())
}

/// サムネイルキャッシュをクリア
#[tauri::command]
pub fn clear_cache(state: State<'_, AppState>) -> std::result::Result<(), String> {
    let session_id = {
        let current = state.current_session_id.lock().unwrap();
        current.clone().ok_or("No session active")?
    };

    let cache_dir = get_cache_dir(&session_id).map_err(|e| e.to_string())?;

    // キャッシュディレクトリ内のファイルを削除
    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string())?;
        // ディレクトリを再作成
        std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// システム情報を取得
#[derive(serde::Serialize)]
pub struct SystemInfo {
    pub cpu_count: usize,
    pub current_threads: usize,
    pub recommended_threads: usize,
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    let cpu_count = config::get_cpu_count();
    let recommended = ((cpu_count as f64 * 0.8).round() as usize).max(2);

    SystemInfo {
        cpu_count,
        current_threads: config::get_thumbnail_thread_count(),
        recommended_threads: recommended,
    }
}

/// スレッド数を設定
#[tauri::command]
pub fn set_thread_count(thread_count: Option<usize>) -> std::result::Result<(), String> {
    let config = AppConfig {
        thumbnail_threads: thread_count,
    };
    config::update_config(config)
}
