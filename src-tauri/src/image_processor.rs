use crate::config::get_thumbnail_thread_count;
use crate::error::{GlimpseError, Result};
use exif::{In, Reader, Tag};
use image::{DynamicImage, ImageFormat};
use rayon::prelude::*;
use rayon::ThreadPoolBuilder;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::mpsc;

const THUMBNAIL_SIZE: u32 = 300;
const PREVIEW_SIZE: u32 = 2000;

/// Normalize path (convert backslashes to forward slashes)
/// Convert Windows paths to a format usable with the asset:// protocol
pub fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

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
    pub preview_path: Option<String>,
    pub success: bool,
    pub error: Option<String>,
}

/// EXIF information
#[derive(Debug, Clone, serde::Serialize, Default)]
pub struct ExifInfo {
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub lens_model: Option<String>,
    pub focal_length: Option<String>,
    pub aperture: Option<String>,
    pub shutter_speed: Option<String>,
    pub iso: Option<String>,
    pub exposure_compensation: Option<String>,
    pub date_taken: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub orientation: Option<u16>,
}

/// Extract EXIF information from an image
pub fn extract_exif(image_path: &Path) -> Result<ExifInfo> {
    let file = File::open(image_path)?;
    let mut bufreader = BufReader::new(file);

    let exif = Reader::new()
        .read_from_container(&mut bufreader)
        .map_err(|e| GlimpseError::ExifError(e.to_string()))?;

    let mut info = ExifInfo::default();

    // Camera make
    if let Some(field) = exif.get_field(Tag::Make, In::PRIMARY) {
        info.camera_make = Some(
            field
                .display_value()
                .to_string()
                .trim_matches('"')
                .to_string(),
        );
    }

    // Camera model
    if let Some(field) = exif.get_field(Tag::Model, In::PRIMARY) {
        info.camera_model = Some(
            field
                .display_value()
                .to_string()
                .trim_matches('"')
                .to_string(),
        );
    }

    // Lens model
    if let Some(field) = exif.get_field(Tag::LensModel, In::PRIMARY) {
        info.lens_model = Some(
            field
                .display_value()
                .to_string()
                .trim_matches('"')
                .to_string(),
        );
    }

    // Focal length
    if let Some(field) = exif.get_field(Tag::FocalLength, In::PRIMARY) {
        info.focal_length = Some(field.display_value().to_string());
    }

    // Aperture
    if let Some(field) = exif.get_field(Tag::FNumber, In::PRIMARY) {
        info.aperture = Some(format!("f/{}", field.display_value()));
    }

    // Shutter speed
    if let Some(field) = exif.get_field(Tag::ExposureTime, In::PRIMARY) {
        info.shutter_speed = Some(format!("{}s", field.display_value()));
    }

    // ISO sensitivity
    if let Some(field) = exif.get_field(Tag::PhotographicSensitivity, In::PRIMARY) {
        info.iso = Some(format!("ISO {}", field.display_value()));
    }

    // Exposure compensation
    if let Some(field) = exif.get_field(Tag::ExposureBiasValue, In::PRIMARY) {
        info.exposure_compensation = Some(format!("{} EV", field.display_value()));
    }

    // Date taken
    if let Some(field) = exif.get_field(Tag::DateTimeOriginal, In::PRIMARY) {
        info.date_taken = Some(
            field
                .display_value()
                .to_string()
                .trim_matches('"')
                .to_string(),
        );
    }

    // Image dimensions
    if let Some(field) = exif.get_field(Tag::PixelXDimension, In::PRIMARY) {
        if let exif::Value::Long(ref v) = field.value {
            if !v.is_empty() {
                info.width = Some(v[0]);
            }
        }
    }
    if let Some(field) = exif.get_field(Tag::PixelYDimension, In::PRIMARY) {
        if let exif::Value::Long(ref v) = field.value {
            if !v.is_empty() {
                info.height = Some(v[0]);
            }
        }
    }

    // Orientation
    if let Some(field) = exif.get_field(Tag::Orientation, In::PRIMARY) {
        if let exif::Value::Short(ref v) = field.value {
            if !v.is_empty() {
                info.orientation = Some(v[0]);
            }
        }
    }

    Ok(info)
}

/// Supported RAW file extensions
const RAW_EXTENSIONS: &[&str] = &[
    "nef", "NEF", // Nikon
    "arw", "ARW", // Sony
    "cr2", "CR2", "cr3", "CR3", // Canon
    "raf", "RAF", // Fujifilm
    "orf", "ORF", // Olympus
    "rw2", "RW2", // Panasonic
    "pef", "PEF", // Pentax
    "dng", "DNG", // Adobe DNG
    "srw", "SRW", // Samsung
];

/// Supported standard image extensions
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "JPG", "jpeg", "JPEG", "png", "PNG"];

/// Check if extension is a RAW format
fn is_raw_extension(ext: &str) -> bool {
    RAW_EXTENSIONS.contains(&ext)
}

/// Scan image files in a folder
pub fn scan_folder(folder_path: &Path) -> Result<Vec<ImageInfo>> {
    let mut images = Vec::new();

    for entry in std::fs::read_dir(folder_path)? {
        let entry = entry?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("");

        if !RAW_EXTENSIONS.contains(&extension) && !IMAGE_EXTENSIONS.contains(&extension) {
            continue;
        }

        let metadata = entry.metadata()?;
        let modified = metadata
            .modified()
            .ok()
            .map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.format("%Y/%m/%d %H:%M").to_string()
            })
            .unwrap_or_else(|| "-".to_string());

        images.push(ImageInfo {
            filename: path.file_name().unwrap().to_string_lossy().to_string(),
            path: normalize_path(&path),
            size: metadata.len(),
            modified_at: modified,
        });
    }

    // Sort by filename
    images.sort_by(|a, b| a.filename.cmp(&b.filename));

    Ok(images)
}

/// Generate session ID (hash of folder path)
pub fn generate_session_id(folder_path: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(folder_path.as_bytes());
    let result = hasher.finalize();
    hex::encode(&result[..16])
}

/// Get cache directory path for thumbnails
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

/// Get cache directory path for previews (larger images for detail view)
pub fn get_preview_dir(session_id: &str) -> Result<PathBuf> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| GlimpseError::InvalidPath("Cannot find data directory".into()))?;
    let preview_dir = data_dir
        .join("Glimpse")
        .join("cache")
        .join(session_id)
        .join("previews");
    std::fs::create_dir_all(&preview_dir)?;
    Ok(preview_dir)
}

/// Generate thumbnail
pub fn generate_thumbnail(image_path: &Path, output_path: &Path) -> Result<()> {
    let extension = image_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    let img = if is_raw_extension(&extension) {
        load_raw_image(image_path)?
    } else {
        image::open(image_path)?
    };

    // Resize to thumbnail size
    let thumbnail = img.thumbnail(THUMBNAIL_SIZE, THUMBNAIL_SIZE);

    // Save as JPEG format
    thumbnail.save_with_format(output_path, ImageFormat::Jpeg)?;

    Ok(())
}

/// Generate preview image (larger size for detail view)
/// Only generates for RAW files since standard images can be displayed directly
pub fn generate_preview(image_path: &Path, output_path: &Path) -> Result<()> {
    let extension = image_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    // Only generate previews for RAW files
    if !is_raw_extension(&extension) {
        return Err(crate::error::GlimpseError::InvalidPath(
            "Preview generation only needed for RAW files".into(),
        ));
    }

    let img = load_raw_image(image_path)?;

    // Resize to preview size (larger than thumbnail)
    let preview = img.thumbnail(PREVIEW_SIZE, PREVIEW_SIZE);

    // Save as high-quality JPEG
    let mut output_file = std::fs::File::create(output_path)?;
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output_file, 90);
    preview.write_with_encoder(encoder)?;

    Ok(())
}

/// Check if an extension is a RAW format (public version)
pub fn is_raw_format(extension: &str) -> bool {
    is_raw_extension(extension)
}

/// Load RAW image
fn load_raw_image(path: &Path) -> Result<DynamicImage> {
    let raw_image =
        rawloader::decode_file(path).map_err(|e| GlimpseError::RawProcessing(e.to_string()))?;

    // Process RAW data and convert to RGB image
    let mut pipeline = imagepipe::Pipeline::new_from_source(imagepipe::ImageSource::Raw(raw_image))
        .map_err(|e| GlimpseError::RawProcessing(e.to_string()))?;

    let srgb_image = pipeline
        .output_8bit(None)
        .map_err(|e| GlimpseError::RawProcessing(e.to_string()))?;

    let width = srgb_image.width;
    let height = srgb_image.height;
    let pixels = srgb_image.data;

    let img = image::RgbImage::from_raw(width as u32, height as u32, pixels).ok_or_else(|| {
        GlimpseError::RawProcessing("Failed to create image from raw data".into())
    })?;

    Ok(DynamicImage::ImageRgb8(img))
}

/// Generate multiple thumbnails and previews in parallel
/// Limit thread count to control CPU usage
/// For RAW files, also generates a larger preview image for detail view
pub fn generate_thumbnails_parallel<F>(
    images: &[ImageInfo],
    cache_dir: &Path,
    preview_dir: &Path,
    progress_callback: F,
) -> Vec<ThumbnailResult>
where
    F: Fn(usize, usize) + Sync + Send + 'static,
{
    let total = images.len();
    let (tx, rx) = mpsc::channel();

    // Thread for progress reporting
    std::thread::spawn(move || {
        let mut completed = 0;
        while rx.recv().is_ok() {
            completed += 1;
            progress_callback(completed, total);
        }
    });

    // Create custom thread pool with limited thread count
    // RAW image processing (imagepipe) consumes large amounts of stack space,
    // default 2MB may not be sufficient. Increased to 8MB.
    let num_threads = get_thumbnail_thread_count();
    let pool = ThreadPoolBuilder::new()
        .num_threads(num_threads)
        .stack_size(8 * 1024 * 1024) // 8MB stack per thread for RAW processing
        .build()
        .expect("Failed to create thread pool");

    let cache_dir = cache_dir.to_path_buf();
    let preview_dir = preview_dir.to_path_buf();
    let results = pool.install(|| {
        images
            .par_iter()
            .map(|image| {
                let file_stem = Path::new(&image.filename)
                    .file_stem()
                    .unwrap()
                    .to_string_lossy();
                let thumbnail_filename = format!("{}.jpg", file_stem);
                let thumbnail_path = cache_dir.join(&thumbnail_filename);

                // Check if this is a RAW file
                let extension = Path::new(&image.filename)
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|s| s.to_lowercase())
                    .unwrap_or_default();
                let is_raw = is_raw_extension(&extension);

                // Preview path for RAW files
                let preview_filename = format!("{}_preview.jpg", file_stem);
                let preview_path_buf = preview_dir.join(&preview_filename);

                // Generate thumbnail
                let thumbnail_result = if thumbnail_path.exists() {
                    Ok(())
                } else {
                    generate_thumbnail(Path::new(&image.path), &thumbnail_path)
                };

                // Generate preview for RAW files
                let preview_path = if is_raw {
                    if preview_path_buf.exists() {
                        Some(normalize_path(&preview_path_buf))
                    } else {
                        match generate_preview(Path::new(&image.path), &preview_path_buf) {
                            Ok(_) => Some(normalize_path(&preview_path_buf)),
                            Err(e) => {
                                eprintln!(
                                    "Failed to generate preview for {}: {}",
                                    image.filename, e
                                );
                                None
                            }
                        }
                    }
                } else {
                    None
                };

                let result = match thumbnail_result {
                    Ok(_) => ThumbnailResult {
                        filename: image.filename.clone(),
                        thumbnail_path: normalize_path(&thumbnail_path),
                        preview_path,
                        success: true,
                        error: None,
                    },
                    Err(e) => ThumbnailResult {
                        filename: image.filename.clone(),
                        thumbnail_path: String::new(),
                        preview_path: None,
                        success: false,
                        error: Some(e.to_string()),
                    },
                };

                // Progress notification
                let _ = tx.send(());

                result
            })
            .collect()
    });

    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_generate_session_id() {
        let session_id1 = generate_session_id("/path/to/folder1");
        let session_id2 = generate_session_id("/path/to/folder2");
        let session_id3 = generate_session_id("/path/to/folder1");

        // Same path generates same ID
        assert_eq!(session_id1, session_id3);

        // Different paths generate different IDs
        assert_ne!(session_id1, session_id2);

        // ID is 32 characters (16 bytes in hex)
        assert_eq!(session_id1.len(), 32);
    }

    #[test]
    fn test_scan_folder_empty() {
        let dir = tempdir().unwrap();
        let result = scan_folder(dir.path()).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_scan_folder_with_images() {
        let dir = tempdir().unwrap();

        // Create test image files (content can be empty)
        fs::write(dir.path().join("image1.jpg"), b"fake jpg").unwrap();
        fs::write(dir.path().join("image2.JPG"), b"fake jpg").unwrap();
        fs::write(dir.path().join("image3.png"), b"fake png").unwrap();
        fs::write(dir.path().join("image4.NEF"), b"fake nef").unwrap();
        fs::write(dir.path().join("image5.ARW"), b"fake arw").unwrap();
        fs::write(dir.path().join("image6.CR2"), b"fake cr2").unwrap();

        let result = scan_folder(dir.path()).unwrap();

        assert_eq!(result.len(), 6);

        // Verify sorted by filename
        assert_eq!(result[0].filename, "image1.jpg");
        assert_eq!(result[1].filename, "image2.JPG");
        assert_eq!(result[2].filename, "image3.png");
        assert_eq!(result[3].filename, "image4.NEF");
        assert_eq!(result[4].filename, "image5.ARW");
        assert_eq!(result[5].filename, "image6.CR2");
    }

    #[test]
    fn test_scan_folder_ignores_non_images() {
        let dir = tempdir().unwrap();

        fs::write(dir.path().join("image.jpg"), b"fake jpg").unwrap();
        fs::write(dir.path().join("document.txt"), b"text file").unwrap();
        fs::write(dir.path().join("script.js"), b"javascript").unwrap();

        let result = scan_folder(dir.path()).unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].filename, "image.jpg");
    }

    #[test]
    fn test_scan_folder_ignores_directories() {
        let dir = tempdir().unwrap();

        fs::write(dir.path().join("image.jpg"), b"fake jpg").unwrap();
        fs::create_dir(dir.path().join("subdir")).unwrap();
        fs::write(dir.path().join("subdir").join("nested.jpg"), b"fake jpg").unwrap();

        let result = scan_folder(dir.path()).unwrap();

        // Does not scan files in subdirectories
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].filename, "image.jpg");
    }

    #[test]
    fn test_get_cache_dir() {
        let session_id = "test_session_123";
        let result = get_cache_dir(session_id);

        assert!(result.is_ok());
        let cache_dir = result.unwrap();

        // Verify path contains session ID
        assert!(cache_dir.to_string_lossy().contains(session_id));
        assert!(cache_dir.to_string_lossy().contains("thumbnails"));
    }

    #[test]
    fn test_image_info_has_correct_fields() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.jpg");
        fs::write(&file_path, b"fake jpg content with some size").unwrap();

        let result = scan_folder(dir.path()).unwrap();

        assert_eq!(result.len(), 1);
        let info = &result[0];

        assert_eq!(info.filename, "test.jpg");
        assert!(info.path.ends_with("test.jpg"));
        assert!(info.size > 0);
        // modified_at should not be empty
        assert!(!info.modified_at.is_empty());
    }
}
