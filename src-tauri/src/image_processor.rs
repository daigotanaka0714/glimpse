use image::{DynamicImage, ImageFormat, ImageReader};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use thiserror::Error;
use walkdir::WalkDir;

#[derive(Error, Debug)]
pub enum ImageError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Image error: {0}")]
    Image(#[from] image::ImageError),
    #[error("RAW processing error: {0}")]
    Raw(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageFile {
    pub filename: String,
    pub path: String,
    pub modified: String,
    pub size: u64,
    pub is_raw: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailResult {
    pub filename: String,
    pub thumbnail_path: String,
    pub success: bool,
    pub error: Option<String>,
}

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp",
    "nef", "cr2", "cr3", "arw", "orf", "rw2", "dng", "raf"
];

const RAW_EXTENSIONS: &[&str] = &[
    "nef", "cr2", "cr3", "arw", "orf", "rw2", "dng", "raf"
];

pub fn is_supported_image(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn is_raw_image(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| RAW_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn scan_folder(folder_path: &str) -> Result<Vec<ImageFile>, ImageError> {
    let mut images: Vec<ImageFile> = Vec::new();

    for entry in WalkDir::new(folder_path)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() && is_supported_image(path) {
            let metadata = fs::metadata(path)?;
            let modified = metadata
                .modified()
                .unwrap_or(SystemTime::UNIX_EPOCH)
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_secs().to_string())
                .unwrap_or_default();

            images.push(ImageFile {
                filename: path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string(),
                path: path.to_string_lossy().to_string(),
                modified,
                size: metadata.len(),
                is_raw: is_raw_image(path),
            });
        }
    }

    // Sort by filename
    images.sort_by(|a, b| a.filename.cmp(&b.filename));

    Ok(images)
}

fn load_raw_image(path: &Path) -> Result<DynamicImage, ImageError> {
    let rawloader = rawloader::RawLoader::new();
    let raw = rawloader.decode_file(path)
        .map_err(|e| ImageError::Raw(e.to_string()))?;

    let pipeline = imagepipe::Pipeline::new_from_source(imagepipe::ImageSource::Raw(raw))
        .map_err(|e| ImageError::Raw(e.to_string()))?;

    let (width, height, pixels) = pipeline.output_8bit(None)
        .map_err(|e| ImageError::Raw(e.to_string()))?;

    let img_buffer = image::RgbImage::from_raw(width as u32, height as u32, pixels)
        .ok_or_else(|| ImageError::Raw("Failed to create image buffer".to_string()))?;

    Ok(DynamicImage::ImageRgb8(img_buffer))
}

fn load_image(path: &Path) -> Result<DynamicImage, ImageError> {
    if is_raw_image(path) {
        load_raw_image(path)
    } else {
        let img = ImageReader::open(path)?
            .with_guessed_format()?
            .decode()?;
        Ok(img)
    }
}

pub fn generate_thumbnail(
    source_path: &Path,
    thumbnail_path: &Path,
    size: u32,
) -> Result<(), ImageError> {
    let img = load_image(source_path)?;

    // Use thumbnail method which maintains aspect ratio
    let thumbnail = img.thumbnail(size, size);

    // Ensure parent directory exists
    if let Some(parent) = thumbnail_path.parent() {
        fs::create_dir_all(parent)?;
    }

    thumbnail.save_with_format(thumbnail_path, ImageFormat::Jpeg)?;

    Ok(())
}

pub fn generate_thumbnails_batch(
    images: &[ImageFile],
    cache_dir: &Path,
    size: u32,
) -> Vec<ThumbnailResult> {
    images.par_iter().map(|image| {
        let source_path = Path::new(&image.path);
        let thumbnail_path = cache_dir.join(&format!("{}.jpg",
            source_path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("unknown")));

        match generate_thumbnail(source_path, &thumbnail_path, size) {
            Ok(()) => ThumbnailResult {
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
    }).collect()
}

pub fn load_full_image(path: &str) -> Result<Vec<u8>, ImageError> {
    let path = Path::new(path);
    let img = load_image(path)?;

    let mut bytes: Vec<u8> = Vec::new();
    let mut cursor = std::io::Cursor::new(&mut bytes);
    img.write_to(&mut cursor, ImageFormat::Jpeg)?;

    Ok(bytes)
}

pub fn get_app_data_dir() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Glimpse")
}

pub fn get_cache_dir(session_id: &str) -> PathBuf {
    get_app_data_dir()
        .join("cache")
        .join(session_id)
        .join("thumbnails")
}

pub fn get_database_path() -> PathBuf {
    get_app_data_dir().join("glimpse.db")
}
