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
use glimpse_lib::image_processor::{generate_preview, generate_thumbnail};
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
