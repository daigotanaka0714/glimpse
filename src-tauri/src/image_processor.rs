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
    let mut pipeline = imagepipe::Pipeline::new_from_source(imagepipe::ImageSource::Raw(raw_image))
        .map_err(|e| GlimpseError::RawProcessing(e.to_string()))?;

    let srgb_image = pipeline
        .output_8bit(None)
        .map_err(|e| GlimpseError::RawProcessing(e.to_string()))?;

    let width = srgb_image.width;
    let height = srgb_image.height;
    let pixels = srgb_image.data;

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
    F: Fn(usize, usize) + Sync + Send + 'static,
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

        // 同じパスは同じIDを生成
        assert_eq!(session_id1, session_id3);

        // 異なるパスは異なるIDを生成
        assert_ne!(session_id1, session_id2);

        // IDは32文字（16バイトの16進数表現）
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

        // テスト用の画像ファイルを作成（中身は空でもOK）
        fs::write(dir.path().join("image1.jpg"), b"fake jpg").unwrap();
        fs::write(dir.path().join("image2.JPG"), b"fake jpg").unwrap();
        fs::write(dir.path().join("image3.png"), b"fake png").unwrap();
        fs::write(dir.path().join("image4.NEF"), b"fake nef").unwrap();

        let result = scan_folder(dir.path()).unwrap();

        assert_eq!(result.len(), 4);

        // ファイル名でソートされていることを確認
        assert_eq!(result[0].filename, "image1.jpg");
        assert_eq!(result[1].filename, "image2.JPG");
        assert_eq!(result[2].filename, "image3.png");
        assert_eq!(result[3].filename, "image4.NEF");
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

        // サブディレクトリ内のファイルはスキャンしない
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].filename, "image.jpg");
    }

    #[test]
    fn test_get_cache_dir() {
        let session_id = "test_session_123";
        let result = get_cache_dir(session_id);

        assert!(result.is_ok());
        let cache_dir = result.unwrap();

        // パスにセッションIDが含まれていることを確認
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
        // modified_atは空でないこと
        assert!(!info.modified_at.is_empty());
    }
}
