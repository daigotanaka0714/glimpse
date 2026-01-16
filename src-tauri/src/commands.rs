use crate::database::{Database, Label, Session};
use crate::image_processor::{
    self, get_cache_dir, get_database_path, scan_folder, ImageFile, ThumbnailResult,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub db: Mutex<Option<Database>>,
}

impl AppState {
    pub fn new() -> Self {
        let db_path = get_database_path();
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let db = Database::new(&db_path).ok();
        AppState { db: Mutex::new(db) }
    }

    fn with_db<F, R>(&self, f: F) -> Result<R, String>
    where
        F: FnOnce(&Database) -> Result<R, rusqlite::Error>,
    {
        let guard = self.db.lock().map_err(|e| e.to_string())?;
        let db = guard.as_ref().ok_or("Database not initialized")?;
        f(db).map_err(|e| e.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenFolderResult {
    pub session: Session,
    pub images: Vec<ImageFile>,
}

#[tauri::command]
pub async fn open_folder(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<OpenFolderResult, String> {
    let images = scan_folder(&folder_path).map_err(|e| e.to_string())?;
    let total_files = images.len() as i32;

    let session = state.with_db(|db| db.get_or_create_session(&folder_path, total_files))?;

    Ok(OpenFolderResult { session, images })
}

#[tauri::command]
pub async fn get_images(folder_path: String) -> Result<Vec<ImageFile>, String> {
    scan_folder(&folder_path).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateThumbnailsRequest {
    pub session_id: String,
    pub images: Vec<ImageFile>,
    pub size: Option<u32>,
}

#[tauri::command]
pub async fn generate_thumbnails(
    request: GenerateThumbnailsRequest,
) -> Result<Vec<ThumbnailResult>, String> {
    let cache_dir = get_cache_dir(&request.session_id);
    fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let size = request.size.unwrap_or(200);
    let results = image_processor::generate_thumbnails_batch(&request.images, &cache_dir, size);

    Ok(results)
}

#[tauri::command]
pub async fn get_thumbnail_path(session_id: String, filename: String) -> Result<String, String> {
    let cache_dir = get_cache_dir(&session_id);
    let stem = Path::new(&filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&filename);
    let thumbnail_path = cache_dir.join(format!("{}.jpg", stem));

    if thumbnail_path.exists() {
        Ok(thumbnail_path.to_string_lossy().to_string())
    } else {
        Err("Thumbnail not found".to_string())
    }
}

#[tauri::command]
pub async fn set_label(
    session_id: String,
    filename: String,
    label: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.with_db(|db| db.set_label(&session_id, &filename, label.as_deref()))
}

#[tauri::command]
pub async fn get_label(
    session_id: String,
    filename: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state.with_db(|db| db.get_label(&session_id, &filename))
}

#[tauri::command]
pub async fn get_all_labels(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Label>, String> {
    state.with_db(|db| db.get_all_labels(&session_id))
}

#[tauri::command]
pub async fn update_selected_index(
    session_id: String,
    index: i32,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.with_db(|db| db.update_last_selected_index(&session_id, index))
}

#[tauri::command]
pub async fn get_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Option<Session>, String> {
    state.with_db(|db| db.get_session(&session_id))
}

#[tauri::command]
pub async fn load_full_image(path: String) -> Result<String, String> {
    let bytes = image_processor::load_full_image(&path).map_err(|e| e.to_string())?;
    let base64 = base64_encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", base64))
}

fn base64_encode(data: &[u8]) -> String {
    use std::io::Write;
    let mut encoded = Vec::new();
    {
        let mut encoder = Base64Encoder::new(&mut encoded);
        encoder.write_all(data).unwrap();
    }
    String::from_utf8(encoded).unwrap()
}

struct Base64Encoder<W: std::io::Write> {
    writer: W,
}

impl<W: std::io::Write> Base64Encoder<W> {
    fn new(writer: W) -> Self {
        Base64Encoder { writer }
    }
}

impl<W: std::io::Write> std::io::Write for Base64Encoder<W> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

        for chunk in buf.chunks(3) {
            let b0 = chunk[0] as usize;
            let b1 = chunk.get(1).copied().unwrap_or(0) as usize;
            let b2 = chunk.get(2).copied().unwrap_or(0) as usize;

            let c0 = CHARS[b0 >> 2];
            let c1 = CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
            let c2 = if chunk.len() > 1 {
                CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)]
            } else {
                b'='
            };
            let c3 = if chunk.len() > 2 {
                CHARS[b2 & 0x3f]
            } else {
                b'='
            };

            self.writer.write_all(&[c0, c1, c2, c3])?;
        }

        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.writer.flush()
    }
}

#[tauri::command]
pub async fn export_approved_files(
    session_id: String,
    source_folder: String,
    dest_folder: String,
    state: State<'_, AppState>,
) -> Result<ExportResult, String> {
    let rejected = state.with_db(|db| db.get_rejected_filenames(&session_id))?;
    let images = scan_folder(&source_folder).map_err(|e| e.to_string())?;

    let rejected_set: std::collections::HashSet<_> = rejected.into_iter().collect();

    fs::create_dir_all(&dest_folder).map_err(|e| e.to_string())?;

    let mut copied = 0;
    let mut errors = Vec::new();

    for image in images {
        if !rejected_set.contains(&image.filename) {
            let src = Path::new(&image.path);
            let dst = Path::new(&dest_folder).join(&image.filename);

            match fs::copy(src, &dst) {
                Ok(_) => copied += 1,
                Err(e) => errors.push(format!("{}: {}", image.filename, e)),
            }
        }
    }

    Ok(ExportResult {
        total_approved: images.len() - rejected_set.len(),
        copied,
        errors,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub total_approved: usize,
    pub copied: usize,
    pub errors: Vec<String>,
}
