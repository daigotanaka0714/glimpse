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

/// Open a folder and retrieve the list of images
#[tauri::command]
pub async fn open_folder(
    app: AppHandle,
    state: State<'_, AppState>,
    folder_path: String,
) -> std::result::Result<OpenFolderResult, String> {
    let path = Path::new(&folder_path);

    // Scan the folder
    let images = scan_folder(path).map_err(|e| e.to_string())?;

    // Generate session ID
    let session_id = generate_session_id(&folder_path);

    // Save to database
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

    // Save current session ID
    {
        let mut current = state.current_session_id.lock().unwrap();
        *current = Some(session_id.clone());
    }

    // Get label information
    let labels = {
        let db = state.db.lock().unwrap();
        db.get_labels(&session_id).map_err(|e| e.to_string())?
    };

    // Get last selected position
    let last_selected = {
        let db = state.db.lock().unwrap();
        db.get_session(&session_id)
            .map_err(|e| e.to_string())?
            .map(|s| s.last_selected_index)
            .unwrap_or(0)
    };

    // Get cache directory
    let cache_dir = get_cache_dir(&session_id).map_err(|e| e.to_string())?;

    // Generate thumbnails in background
    let images_clone = images.clone();
    let app_for_progress = app.clone();
    let app_for_complete = app.clone();
    let cache_dir_clone = cache_dir.clone();

    tokio::spawn(async move {
        let results = generate_thumbnails_parallel(
            &images_clone,
            &cache_dir_clone,
            move |completed, total| {
                let _ = app_for_progress
                    .emit("thumbnail-progress", ProgressPayload { completed, total });
            },
        );

        // Completion notification
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

/// Set a label
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

/// Save selection position
#[tauri::command]
pub fn save_selection(state: State<'_, AppState>, index: i32) -> std::result::Result<(), String> {
    let session_id = {
        let current = state.current_session_id.lock().unwrap();
        current.clone().ok_or("No session active")?
    };

    let db = state.db.lock().unwrap();
    db.update_last_selected(&session_id, index)
        .map_err(|e| e.to_string())
}

/// Export adopted files
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

    // Get rejected labels
    let rejected_files: std::collections::HashSet<String> = {
        let db = state.db.lock().unwrap();
        db.get_labels(&session_id)
            .map_err(|e| e.to_string())?
            .into_iter()
            .filter(|l| l.label.as_deref() == Some("rejected"))
            .map(|l| l.filename)
            .collect()
    };

    // Scan files in folder
    let images = scan_folder(Path::new(&source_folder)).map_err(|e| e.to_string())?;

    // Create destination folder
    std::fs::create_dir_all(&destination_folder).map_err(|e| e.to_string())?;

    let is_move = mode == "move";
    let mut copied = 0;
    let mut failed = 0;

    for image in &images {
        // Export only if not rejected
        if !rejected_files.contains(&image.filename) {
            let src = Path::new(&image.path);
            let dst = Path::new(&destination_folder).join(&image.filename);

            let result = if is_move {
                // Move mode: copy first, then delete original
                std::fs::copy(src, &dst).and_then(|_| std::fs::remove_file(src))
            } else {
                // Copy mode
                std::fs::copy(src, &dst).map(|_| ())
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

/// Get EXIF information
#[tauri::command]
pub fn get_exif(image_path: String) -> std::result::Result<ExifInfo, String> {
    extract_exif(std::path::Path::new(&image_path)).map_err(|e| e.to_string())
}

/// Clear thumbnail cache
#[tauri::command]
pub fn clear_cache(state: State<'_, AppState>) -> std::result::Result<(), String> {
    let session_id = {
        let current = state.current_session_id.lock().unwrap();
        current.clone().ok_or("No session active")?
    };

    let cache_dir = get_cache_dir(&session_id).map_err(|e| e.to_string())?;

    // Delete files in cache directory
    if cache_dir.exists() {
        std::fs::remove_dir_all(&cache_dir).map_err(|e| e.to_string())?;
        // Recreate directory
        std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Get system information
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

/// Set thread count
#[tauri::command]
pub fn set_thread_count(thread_count: Option<usize>) -> std::result::Result<(), String> {
    let config = AppConfig {
        thumbnail_threads: thread_count,
    };
    config::update_config(config)
}

/// Storage information
#[derive(serde::Serialize)]
pub struct StorageInfo {
    pub cache_size_bytes: u64,
    pub cache_size_display: String,
    pub label_count: i64,
    pub session_count: i64,
}

/// Calculate directory size recursively
fn get_dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }

    let mut size = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                size += entry.metadata().map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                size += get_dir_size(&path);
            }
        }
    }
    size
}

/// Format bytes to human-readable string
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Get storage information
#[tauri::command]
pub fn get_storage_info(state: State<'_, AppState>) -> std::result::Result<StorageInfo, String> {
    let db = state.db.lock().unwrap();

    // Get cache directory path
    let data_dir = dirs::data_dir().ok_or_else(|| "Cannot find data directory".to_string())?;
    let cache_base_dir = data_dir.join("Glimpse").join("cache");

    // Calculate cache size
    let cache_size_bytes = get_dir_size(&cache_base_dir);

    // Get counts from database
    let label_count = db.get_label_count().map_err(|e| e.to_string())?;
    let session_count = db.get_session_count().map_err(|e| e.to_string())?;

    Ok(StorageInfo {
        cache_size_bytes,
        cache_size_display: format_bytes(cache_size_bytes),
        label_count,
        session_count,
    })
}

/// Clear all thumbnail cache
#[tauri::command]
pub fn clear_all_cache(state: State<'_, AppState>) -> std::result::Result<u64, String> {
    let db = state.db.lock().unwrap();

    // Get cache directory path
    let data_dir = dirs::data_dir().ok_or_else(|| "Cannot find data directory".to_string())?;
    let cache_base_dir = data_dir.join("Glimpse").join("cache");

    // Calculate size before deletion
    let size = get_dir_size(&cache_base_dir);

    // Delete cache directory
    if cache_base_dir.exists() {
        std::fs::remove_dir_all(&cache_base_dir).map_err(|e| e.to_string())?;
    }

    // Clear thumbnail_cache table
    db.clear_all_sessions().map_err(|e| e.to_string())?;

    Ok(size)
}

/// Clear all label data
#[tauri::command]
pub fn clear_all_labels(state: State<'_, AppState>) -> std::result::Result<i64, String> {
    let db = state.db.lock().unwrap();
    db.clear_all_labels().map_err(|e| e.to_string())
}
