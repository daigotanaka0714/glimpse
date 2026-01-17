use crate::error::{GlimpseError, Result};
use image::{DynamicImage, ImageFormat};
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use std::sync::mpsc;

const THUMBNAIL_SIZE: u32 = 300;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ImageInfo {
    pub filename: String,
    pub path: String,
    pub size: u64,
    pub modified_at: String,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ThumbnailResult {
    pub filename: String,
    pub thumbnail_path: String,
    pub success: bool,
    pub error: Option<String>,
}

/// フォルダ内の画像ファイルをスキャン
pub fn scan_folder(folder_path: &Path) -> Result<Vec<ImageInfo>> {
    let extensions = ["nef", "NEF", "jpg", "JPG", "jpeg", "JPEG", "png", "PNG"];
    let mut images = Vec::new();

    for entry in std::fs::read_dir(folder_path)? {
        let entry = entry?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        if !extensions.contains(&extension) {
            continue;
        }

        let metadata = entry.metadata()?;
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                Some(datetime.format("%Y/%m/%d %H:%M").to_string())
            })
            .unwrap_or_else(|| "-".to_string());

        images.push(ImageInfo {
            filename: path.file_name().unwrap().to_string_lossy().to_string(),
            path: path.to_string_lossy().to_string(),
            size: metadata.len(),
            modified_at: modified,
        });
    }

    // ファイル名でソート
    images.sort_by(|a, b| a.filename.cmp(&b.filename));

    Ok(images)
}

/// セッションIDを生成（フォルダパスのハッシュ）
pub fn generate_session_id(folder_path: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(folder_path.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..16])
}

/// キャッシュディレクトリのパスを取得
pub fn get_cache_dir(session_id: &str) -> Result<PathBuf> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| GlimpseError::InvalidPath("Cannot find data directory".into()))?;
    let cache_dir = data_dir
        .join("Glimpse")
        .join("cache")
        .join(session_id)
        .join("thumbnails");
    std::fs::create_dir_all(&cache_dir)?;
    Ok(cache_dir)
}

/// サムネイルを生成
pub fn generate_thumbnail(
    image_path: &Path,
    output_path: &Path,
) -> Result<()> {
    let extension = image_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let img = if extension == "nef" {
        load_raw_image(image_path)?
    } else {
        image::open(image_path)?
    };

    // サムネイルサイズにリサイズ
    let thumbnail = img.thumbnail(THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    // JPEG形式で保存
    thumbnail.save_with_format(output_path, ImageFormat::Jpeg)?;

    Ok(())
}

/// RAW画像を読み込み
fn load_raw_image(path: &Path) -> Result<DynamicImage> {
    let raw_image = rawloader::decode_file(path)
        .map_err(|e| GlimpseError::RawProcessing(e.to_string()))?;

    // RAWデータを処理してRGB画像に変換
    let pipeline = imagepipe::Pipeline::new_from_source(imagepipe::ImageSource::Raw(raw_image))
        .map_err(|e| GlimpseError::RawProcessing(e.to_string()))?;

    let (width, height, pixels) = pipeline
        .output_8bit(None)
        .map_err(|e| GlimpseError::RawProcessing(e.to_string()))?;

    let img = image::RgbImage::from_raw(width as u32, height as u32, pixels)
        .ok_or_else(|| GlimpseError::RawProcessing("Failed to create image from raw data".into()))?;

    Ok(DynamicImage::ImageRgb8(img))
}

/// 複数のサムネイルを並列生成
pub fn generate_thumbnails_parallel<F>(
    images: &[ImageInfo],
    cache_dir: &Path,
    progress_callback: F,
) -> Vec<ThumbnailResult>
where
    F: Fn(usize, usize) + Sync,
{
    let total = images.len();
    let (tx, rx) = mpsc::channel();

    // 進捗報告用のスレッド
    std::thread::spawn(move || {
        let mut completed = 0;
        while let Ok(_) = rx.recv() {
            completed += 1;
            progress_callback(completed, total);
        }
    });

    let results: Vec<ThumbnailResult> = images
        .par_iter()
        .map(|image| {
            let thumbnail_filename = format!(
                "{}.jpg",
                Path::new(&image.filename)
                    .file_stem()
                    .unwrap()
                    .to_string_lossy()
            );
            let thumbnail_path = cache_dir.join(&thumbnail_filename);

            let result = if thumbnail_path.exists() {
                // キャッシュが存在する場合はスキップ
                ThumbnailResult {
                    filename: image.filename.clone(),
                    thumbnail_path: thumbnail_path.to_string_lossy().to_string(),
                    success: true,
                    error: None,
                }
            } else {
                match generate_thumbnail(Path::new(&image.path), &thumbnail_path) {
                    Ok(_) => ThumbnailResult {
                        filename: image.filename.clone(),
                        thumbnail_path: thumbnail_path.to_string_lossy().to_string(),
                        success: true,
                        error: None,
                    },
                    Err(e) => ThumbnailResult {
                        filename: image.filename.clone(),
                        thumbnail_path: String::new(),
                        success: false,
                        error: Some(e.to_string()),
                    },
                }
            };

            // 進捗通知
            let _ = tx.send(());

            result
        })
        .collect();

    results
}
