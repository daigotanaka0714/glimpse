use crate::config::get_thumbnail_thread_count;
use crate::error::{GlimpseError, Result};
use crate::raw_preview;
use exif::{In, Reader, Tag};
use image::{DynamicImage, ImageFormat};
use rayon::prelude::*;
use rayon::ThreadPoolBuilder;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;

pub const THUMBNAIL_SIZE: u32 = 300;
pub const PREVIEW_SIZE: u32 = 2000;

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

fn is_supported_image_extension(ext: &str) -> bool {
    RAW_EXTENSIONS.contains(&ext) || IMAGE_EXTENSIONS.contains(&ext)
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

        if !is_supported_image_extension(extension) {
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

#[derive(Debug, Clone, serde::Serialize)]
pub struct SubfolderInfo {
    pub name: String,
    pub path: String,
    pub image_count: usize,
}

const MAX_SUBFOLDERS: usize = 50;
const SUBFOLDER_SCAN_CAP: usize = 5000;

/// Scan the immediate child directories of `folder_path`, returning the ones that contain
/// image files together with a lightweight (extension-only) count.
///
/// Intentionally non-recursive and metadata-free so it stays cheap even when the target
/// holds many subfolders. Subfolders with zero images are omitted.
pub fn scan_subfolders(folder_path: &Path) -> Result<Vec<SubfolderInfo>> {
    let mut subfolders = Vec::new();

    for entry in std::fs::read_dir(folder_path)?.flatten() {
        if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }
        let path = entry.path();

        let Ok(children) = std::fs::read_dir(&path) else {
            continue;
        };

        let mut image_count = 0usize;
        for child in children.flatten().take(SUBFOLDER_SCAN_CAP) {
            if !child.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                continue;
            }
            let child_path = child.path();
            let ext = child_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            if is_supported_image_extension(ext) {
                image_count += 1;
            }
        }

        if image_count == 0 {
            continue;
        }

        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();

        subfolders.push(SubfolderInfo {
            name,
            path: normalize_path(&path),
            image_count,
        });

        if subfolders.len() >= MAX_SUBFOLDERS {
            break;
        }
    }

    subfolders.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(subfolders)
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
        load_raw_at_least(image_path, THUMBNAIL_SIZE)?
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

    let img = load_raw_at_least(image_path, PREVIEW_SIZE)?;

    // Resize to preview size (larger than thumbnail)
    let preview = img.thumbnail(PREVIEW_SIZE, PREVIEW_SIZE);

    write_preview_jpeg(&preview, output_path)
}

/// プレビューを JPEG（品質 90）で書き出す。
///
/// 計測（`tests/thumbnail_breakdown.rs`）が工程ごとに呼び直すために分けてある。
pub fn write_preview_jpeg(preview: &DynamicImage, output_path: &Path) -> Result<()> {
    // 一時ファイルに書いてから rename する。
    // 一括生成と ensure_preview が同じファイルを同時に作ることがあり、直接書くと
    // 書きかけのファイルを <img> が読んだり、exists() が真になって未完成のまま
    // キャッシュ扱いされたりする。rename は同じディレクトリ内なら一度に置き換わる。
    let tmp_path = temp_path_for(output_path);
    let written = (|| -> Result<()> {
        let mut tmp_file = std::fs::File::create(&tmp_path)?;
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut tmp_file, 90);
        preview.write_with_encoder(encoder)?;
        Ok(())
    })();
    if let Err(e) = written {
        let _ = std::fs::remove_file(&tmp_path);
        return Err(e);
    }

    if let Err(e) = std::fs::rename(&tmp_path, output_path) {
        let _ = std::fs::remove_file(&tmp_path);
        // Windows では、相手が先に置いたファイルを <img> が開いていると置き換えに
        // 失敗する。中身は同じ RAW から作った完成品なので、それを使えばよい。
        if output_path.exists() {
            return Ok(());
        }
        return Err(e.into());
    }

    Ok(())
}

/// 同じ出力先に同時に書く者どうしがぶつからない一時ファイル名（出力先と同じディレクトリ）
fn temp_path_for(output_path: &Path) -> PathBuf {
    static COUNTER: AtomicU64 = AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    let name = output_path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    output_path.with_file_name(format!("{}.{}-{}.tmp", name, std::process::id(), n))
}

/// RAW のプレビューのキャッシュ上の置き場所。一括生成と ensure_preview で必ず同じ名前にする
pub fn preview_path_for(preview_dir: &Path, filename: &str) -> PathBuf {
    let file_stem = Path::new(filename)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    preview_dir.join(format!("{}_preview.jpg", file_stem))
}

/// 1枚だけプレビューを用意する。キャッシュ済みなら生成せずにそのパスを返す。
///
/// 表示中の1枚を一括生成の順番待ちから外すために使う。RAW の現像は既定の
/// 2MB スタックでは足りないので、呼び出し側は大きいスタックのスレッドで呼ぶこと。
pub fn ensure_preview(image_path: &Path, preview_dir: &Path) -> Result<PathBuf> {
    let filename = image_path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .ok_or_else(|| GlimpseError::InvalidPath("No file name".into()))?;
    let output_path = preview_path_for(preview_dir, &filename);
    if output_path.exists() {
        return Ok(output_path);
    }
    generate_preview(image_path, &output_path)?;
    Ok(output_path)
}

/// Check if an extension is a RAW format (public version)
pub fn is_raw_format(extension: &str) -> bool {
    is_raw_extension(extension)
}

/// RAW を「長辺が target 以上」の絵として読む。
///
/// まず埋め込み JPEG を試し、足りないときだけ現像に落ちる。
///
/// なぜこの順番か:
///   現像（rawloader + imagepipe）は1枚 1〜4秒かかり、機種表に無いカメラは
///   そもそも読めない（CR3 と X-T3 の RAF は実測で失敗する）。一方、埋め込み
///   JPEG は数十ミリ秒で取り出せて、構造だけ見るので機種に依存しない。
///   選別に必要なのは採否を判断できる絵なので、カメラが書いた JPEG で足りる。
///
/// 現像に落ちるのは次の2つだけ:
///   - 埋め込み JPEG が取り出せなかった
///   - 取り出せたが target より小さかった（拡大表示でぼやける）
///
/// どちらの場合も現像が失敗したら、小さくても埋め込み JPEG を返す。
/// 「小さい絵が出る」ほうが「何も出ない」より良い。
///
/// 計測（`tests/thumbnail_breakdown.rs`）はこの関数を工程に割って呼び直している。
/// 順番や分岐を変えたら、そちらも合わせること（食い違うと出力の一致テストが落ちる）。
fn load_raw_at_least(path: &Path, target: u32) -> Result<DynamicImage> {
    let embedded = match raw_preview::extract_embedded_jpeg(path, target) {
        Ok(jpeg) => match image::load_from_memory_with_format(&jpeg.bytes, ImageFormat::Jpeg) {
            Ok(img) => {
                let oriented = apply_orientation(img, embedded_orientation(&jpeg.bytes, path));
                if oriented.width().max(oriented.height()) >= target {
                    return Ok(oriented);
                }
                Some(oriented)
            }
            Err(e) => {
                eprintln!(
                    "embedded JPEG in {} could not be decoded: {e}",
                    path.display()
                );
                None
            }
        },
        Err(_) => None,
    };

    match load_raw_image(path) {
        Ok(img) => Ok(img),
        Err(e) => match embedded {
            Some(img) => Ok(img),
            None => Err(e),
        },
    }
}

/// 埋め込み JPEG に付ける向き。
/// JPEG 自身が EXIF を持っていればそれを使い、無ければ RAW 本体の向きを使う。
/// 計測から工程ごとに呼ぶため公開している。
pub fn embedded_orientation(jpeg: &[u8], raw_path: &Path) -> u16 {
    if let Some(o) = orientation_from_jpeg(jpeg) {
        return o;
    }
    extract_exif(raw_path)
        .ok()
        .and_then(|e| e.orientation)
        .unwrap_or(1)
}

fn orientation_from_jpeg(bytes: &[u8]) -> Option<u16> {
    let mut cursor = std::io::Cursor::new(bytes);
    let exif = Reader::new().read_from_container(&mut cursor).ok()?;
    let field = exif.get_field(Tag::Orientation, In::PRIMARY)?;
    field.value.get_uint(0).map(|v| v as u16)
}

/// EXIF の向きに合わせて回す。
/// 現像経路（imagepipe）は向きを自分で直すので、埋め込み経路だけここで揃える。
/// 揃えないと、同じフォルダの中で縦横が混ざる。
/// 計測から工程ごとに呼ぶため公開している。
pub fn apply_orientation(img: DynamicImage, orientation: u16) -> DynamicImage {
    match orientation {
        2 => img.fliph(),
        3 => img.rotate180(),
        4 => img.flipv(),
        5 => img.rotate90().fliph(),
        6 => img.rotate90(),
        7 => img.rotate270().fliph(),
        8 => img.rotate270(),
        _ => img,
    }
}

/// Load RAW image
/// 計測から工程ごとに呼ぶため公開している。
pub fn load_raw_image(path: &Path) -> Result<DynamicImage> {
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
///
/// `progress_callback(completed, total, result)` は1枚終わるごとに呼ばれる。
/// 全部終わるのを待たずに、できた1枚からフロントへ届けるため。
/// この関数が戻る時点で、全件のコールバックは呼び終わっている。
pub fn generate_thumbnails_parallel<F>(
    images: &[ImageInfo],
    cache_dir: &Path,
    preview_dir: &Path,
    progress_callback: F,
) -> Vec<ThumbnailResult>
where
    F: Fn(usize, usize, &ThumbnailResult) + Send + 'static,
{
    let total = images.len();
    let (tx, rx) = mpsc::channel::<ThumbnailResult>();

    // Thread for progress reporting
    let reporter = std::thread::spawn(move || {
        let mut completed = 0;
        while let Ok(result) = rx.recv() {
            completed += 1;
            progress_callback(completed, total, &result);
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
                let preview_path_buf = preview_path_for(&preview_dir, &image.filename);

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
                let _ = tx.send(result.clone());

                result
            })
            .collect()
    });

    // 送り手を閉じて、報告スレッドが残りを流し終えるのを待つ。
    // 待たないと、完了通知が最後の数枚の1枚ごとの通知より先に出ることがある。
    drop(tx);
    let _ = reporter.join();

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

    fn write_jpeg(path: &Path) {
        image::RgbImage::from_pixel(64, 48, image::Rgb([200, 100, 50]))
            .save_with_format(path, ImageFormat::Jpeg)
            .unwrap();
    }

    #[test]
    fn test_generate_thumbnails_parallel_reports_each_result() {
        use std::sync::{Arc, Mutex};

        let src = tempdir().unwrap();
        let cache = tempdir().unwrap();
        let previews = tempdir().unwrap();
        for name in ["a.jpg", "b.jpg", "c.jpg"] {
            write_jpeg(&src.path().join(name));
        }
        // 読めないファイルも1枚ごとに（失敗として）届くこと
        fs::write(src.path().join("broken.jpg"), b"not a jpeg").unwrap();
        let images = scan_folder(src.path()).unwrap();

        let reported = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&reported);
        let results = generate_thumbnails_parallel(
            &images,
            cache.path(),
            previews.path(),
            move |completed, total, result| {
                sink.lock().unwrap().push((
                    completed,
                    total,
                    result.filename.clone(),
                    result.success,
                ));
            },
        );

        // 戻った時点で全件が報告済みであること（完了通知が1枚ごとの通知を追い越さない）
        let mut reported = reported.lock().unwrap().clone();
        assert_eq!(reported.len(), images.len());
        assert_eq!(
            reported.iter().map(|r| r.0).collect::<Vec<_>>(),
            (1..=images.len()).collect::<Vec<_>>()
        );
        assert!(reported.iter().all(|r| r.1 == images.len()));

        reported.sort_by(|a, b| a.2.cmp(&b.2));
        let by_name: Vec<_> = reported.iter().map(|r| (r.2.as_str(), r.3)).collect();
        assert_eq!(
            by_name,
            vec![
                ("a.jpg", true),
                ("b.jpg", true),
                ("broken.jpg", false),
                ("c.jpg", true)
            ]
        );
        assert_eq!(results.len(), images.len());
    }

    #[test]
    fn test_ensure_preview_returns_cached_without_generating() {
        let src = tempdir().unwrap();
        let previews = tempdir().unwrap();
        // 中身は RAW ではないので、生成しようとすれば必ず失敗する
        let raw = src.path().join("DSC_0001.NEF");
        fs::write(&raw, b"not really a raw file").unwrap();

        let cached = preview_path_for(previews.path(), "DSC_0001.NEF");
        fs::write(&cached, b"cached preview").unwrap();

        let path = ensure_preview(&raw, previews.path()).unwrap();

        assert_eq!(path, cached);
        assert_eq!(fs::read(&cached).unwrap(), b"cached preview");
    }

    #[test]
    fn test_ensure_preview_uses_same_path_as_bulk_generation() {
        let previews = tempdir().unwrap();
        // 一括生成と名前がずれると、同じ RAW を二度現像し、キャッシュも効かない
        assert_eq!(
            preview_path_for(previews.path(), "DSC_0001.NEF"),
            previews.path().join("DSC_0001_preview.jpg")
        );
    }

    #[test]
    fn test_generate_preview_failure_leaves_no_files() {
        let src = tempdir().unwrap();
        let previews = tempdir().unwrap();
        let raw = src.path().join("DSC_0001.NEF");
        fs::write(&raw, b"not really a raw file").unwrap();

        assert!(ensure_preview(&raw, previews.path()).is_err());
        // 失敗したとき、書きかけのプレビューも一時ファイルも残さない
        assert_eq!(fs::read_dir(previews.path()).unwrap().count(), 0);
    }

    #[test]
    fn test_temp_path_is_unique_and_beside_output() {
        let out = Path::new("/cache/previews/a_preview.jpg");
        let a = temp_path_for(out);
        let b = temp_path_for(out);
        assert_ne!(a, b);
        assert_eq!(a.parent(), out.parent());
    }

    #[test]
    fn test_frontend_raw_extensions_match_backend() {
        // フロントは拡張子で RAW を見分け、RAW 本体を <img> に渡さない。
        // 一覧がずれると、その形式だけ Windows で表示されなくなる。
        let ts = include_str!("../../src/utils/imageSource.ts");
        let start = ts
            .find("RAW_EXTENSIONS = [")
            .expect("RAW_EXTENSIONS in imageSource.ts");
        let end = start + ts[start..].find("] as const").unwrap();
        let mut frontend: Vec<String> = ts[start..end]
            .split('"')
            .skip(1)
            .step_by(2)
            .map(str::to_string)
            .collect();
        frontend.sort();

        let mut backend: Vec<String> = RAW_EXTENSIONS.iter().map(|e| e.to_lowercase()).collect();
        backend.sort();
        backend.dedup();

        assert_eq!(frontend, backend);
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
