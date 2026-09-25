//! 実物の RAW サンプルで、対応表と実際が食い違っていないかを確かめる。
//!
//! なぜ要るか:
//!   README とダウンロードページには CR3 と RAF も「対応」と書いてあったが、
//!   実際は `rawloader` の機種表に無く、Canon R5 と Fujifilm X-T3 は読めなかった。
//!   **書いてある対応表と、動く範囲がずれていたことに誰も気づけなかった。**
//!   ここを機械が見ていれば、次にずれたときに CI が落ちる。
//!
//! 使い方:
//!   GLIMPSE_RAW_DIR にサンプルの入ったフォルダを指定する。
//!   指定が無ければ黙って通す（普段の開発でサンプルを置かなくてよい）。
//!   CI は .github/workflows/raw-samples.yml が raw.pixls.us（CC0）から取得する。
use glimpse_lib::image_processor::{
    generate_preview, generate_thumbnail, is_raw_format, PREVIEW_SIZE, THUMBNAIL_SIZE,
};
use glimpse_lib::raw_preview;
use image::ImageFormat;
use std::path::PathBuf;
use std::time::Instant;

fn sample_dir() -> Option<PathBuf> {
    let dir = PathBuf::from(std::env::var("GLIMPSE_RAW_DIR").ok()?);
    dir.is_dir().then_some(dir)
}

fn samples() -> Vec<PathBuf> {
    let Some(dir) = sample_dir() else {
        return Vec::new();
    };
    let mut files: Vec<PathBuf> = std::fs::read_dir(&dir)
        .expect("GLIMPSE_RAW_DIR が読めない")
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.is_file() && p.extension().is_some())
        .collect();
    files.sort();
    files
}

fn out_dir() -> PathBuf {
    let d = std::env::temp_dir().join("glimpse-raw-samples");
    std::fs::create_dir_all(&d).unwrap();
    d
}

/// 置いてあるサンプルは全部、サムネイルとプレビューが作れること。
#[test]
fn every_sample_produces_a_thumbnail_and_preview() {
    let files = samples();
    if files.is_empty() {
        eprintln!("GLIMPSE_RAW_DIR が未設定のため省略");
        return;
    }

    let out = out_dir();
    let mut failures = Vec::new();

    for path in &files {
        let name = path.file_name().unwrap().to_string_lossy().to_string();

        let t = Instant::now();
        let thumb = generate_thumbnail(path, &out.join(format!("{name}.jpg")));
        let thumb_ms = t.elapsed().as_millis();

        let t = Instant::now();
        let preview = generate_preview(path, &out.join(format!("{name}_preview.jpg")));
        let preview_ms = t.elapsed().as_millis();

        println!(
            "{name:<28} thumbnail={:<4} ({thumb_ms:>5}ms)  preview={:<4} ({preview_ms:>5}ms)",
            if thumb.is_ok() { "OK" } else { "NG" },
            if preview.is_ok() { "OK" } else { "NG" },
        );

        if let Err(e) = thumb {
            failures.push(format!("{name}: サムネイルが作れない: {e}"));
        }
        if let Err(e) = preview {
            failures.push(format!("{name}: プレビューが作れない: {e}"));
        }
    }

    assert!(
        failures.is_empty(),
        "対応表に載っている形式が読めていない:\n  {}",
        failures.join("\n  ")
    );
}

/// RAW のサンプルは全部、埋め込み JPEG が取り出せて、絵としてデコードできること。
///
/// なぜ上のテストだけでは足りないか:
///   埋め込み JPEG が使えないと本体は現像（rawloader）に落ちる。現像が成功すれば
///   サムネイルもプレビューも作れるので、上のテストは通ってしまう。実際に CR2 と DNG は
///   RAW 本体のロスレス JPEG を選んで毎回現像に落ちていた（1枚 360〜570ms）が、CI では
///   見えなかった。速い経路を通れているかは、ここで直接見る。
#[test]
fn every_raw_sample_has_a_decodable_embedded_jpeg() {
    let files: Vec<PathBuf> = samples()
        .into_iter()
        .filter(|p| {
            p.extension()
                .and_then(|e| e.to_str())
                .map(|e| is_raw_format(&e.to_lowercase()))
                .unwrap_or(false)
        })
        .collect();
    if files.is_empty() {
        eprintln!("GLIMPSE_RAW_DIR が未設定のため省略");
        return;
    }

    let mut failures = Vec::new();
    for path in &files {
        let name = path.file_name().unwrap().to_string_lossy().to_string();
        for target in [THUMBNAIL_SIZE, PREVIEW_SIZE] {
            let result = raw_preview::extract_embedded_jpeg(path, target)
                .map_err(|e| format!("取り出せない: {e}"))
                .and_then(|jpeg| {
                    image::load_from_memory_with_format(&jpeg.bytes, ImageFormat::Jpeg)
                        .map_err(|e| format!("offset {} がデコードできない: {e}", jpeg.offset))
                });
            match result {
                Ok(img) => println!(
                    "{name:<28} target={target:<5} embedded={}x{}",
                    img.width(),
                    img.height()
                ),
                Err(e) => {
                    println!("{name:<28} target={target:<5} embedded=NG");
                    failures.push(format!("{name}（target {target}）: {e}"));
                }
            }
        }
    }

    assert!(
        failures.is_empty(),
        "埋め込み JPEG の経路を通れず、現像に落ちている:\n  {}",
        failures.join("\n  ")
    );
}
