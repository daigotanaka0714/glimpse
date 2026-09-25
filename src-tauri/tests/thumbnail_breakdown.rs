//! サムネイル（300px）とプレビュー（2000px）の生成時間を、工程ごとに割って測る。
//!
//! なぜ要るか:
//!   縮小を GPU で速くする案が出たが、どの工程に時間が掛かっているかの数字が無い。
//!   数字が無いまま手を入れると、効かなかったときに「手段が効かないのか、
//!   当てどころが違ったのか」が区別できない。先に内訳を出す。
//!
//! 何を測るか:
//!   `generate_thumbnail` / `generate_preview` を本体と同じ順番で工程に割って呼び直し、
//!   工程ごとの時間を出す。本体には計測を入れていない（計測が無いときの挙動を変えないため）。
//!   組み直した工程が本体と同じものを作っていることは、出力 JPEG がバイト単位で
//!   一致することで確かめる（`staged_pipeline_matches_production`）。
//!
//!   | 工程 | RAW | JPEG / PNG |
//!   |---|---|---|
//!   | I/O | 選ばれた埋め込み JPEG のバイト列を読む | ファイル全体を読む |
//!   | 探索 | `raw_preview::list_candidates`（候補集め） | なし |
//!   | デコード | `image::load_from_memory_with_format` | 同左（形式は拡張子から） |
//!   | 向き | `embedded_orientation` + `apply_orientation` | なし |
//!   | 現像 | 足りないときだけ `load_raw_image` | なし |
//!   | 縮小 | `img.thumbnail(...)` | 同左 |
//!   | 保存 | JPEG エンコードと書き込み | 同左 |
//!
//! 使い方:
//!   GLIMPSE_RAW_DIR にサンプルの入ったフォルダを指定し、release で走らせる。
//!   指定が無ければ黙って通す（tests/raw_samples.rs と同じ約束）。
//!
//!   GLIMPSE_RAW_DIR=/path/to/samples \
//!     cargo test --release --test thumbnail_breakdown -- --nocapture --test-threads=1
//!
//!   GLIMPSE_BENCH_ITERS で1ファイルあたりの繰り返し回数を変えられる（既定 5、中央値を出す）。
//!   2回目以降はファイルが OS のキャッシュに載っているので、I/O はキャッシュ込みの数字になる。
//!   macOS でキャッシュを外した数字が欲しいときは `sudo purge` の直後に
//!   GLIMPSE_BENCH_ITERS=1 で走らせる。
use glimpse_lib::config::get_thumbnail_thread_count;
use glimpse_lib::image_processor::{
    apply_orientation, embedded_orientation, generate_preview, generate_thumbnail, is_raw_format,
    load_raw_image, write_preview_jpeg, PREVIEW_SIZE, THUMBNAIL_SIZE,
};
use glimpse_lib::raw_preview::{self, CandidateInfo};
use image::{DynamicImage, ImageDecoder, ImageFormat};
use std::fs::File;
use std::io::{Cursor, Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

// ── サンプル ─────────────────────────────

fn sample_dir() -> Option<PathBuf> {
    let dir = PathBuf::from(std::env::var("GLIMPSE_RAW_DIR").ok()?);
    dir.is_dir().then_some(dir)
}

/// 拡張子の表示順。形式によって経路が違うので、混ぜずに拡張子ごとに並べる。
const EXT_ORDER: [&str; 11] = [
    "nef", "arw", "cr2", "cr3", "raf", "dng", "orf", "rw2", "pef", "srw", "jpg",
];

fn ext_of(path: &Path) -> String {
    let e = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    if e == "jpeg" {
        "jpg".into()
    } else {
        e
    }
}

fn ext_rank(ext: &str) -> usize {
    EXT_ORDER
        .iter()
        .position(|e| *e == ext)
        .unwrap_or(EXT_ORDER.len())
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
    files.sort_by_key(|p| (ext_rank(&ext_of(p)), p.file_name().map(|n| n.to_owned())));
    files
}

fn name_of(path: &Path) -> String {
    path.file_name().unwrap().to_string_lossy().into_owned()
}

/// 本体と同じく 8MB スタックのスレッドで走らせる（現像は既定の 2MB では足りない）
fn on_big_stack<T: Send + 'static>(f: impl FnOnce() -> T + Send + 'static) -> T {
    std::thread::Builder::new()
        .stack_size(8 * 1024 * 1024)
        .spawn(f)
        .unwrap()
        .join()
        .unwrap()
}

// ── 工程に割った生成 ─────────────────────────────

/// 何を作るか
#[derive(Clone, Copy, PartialEq)]
enum Target {
    Thumbnail,
    Preview,
}

impl Target {
    fn size(self) -> u32 {
        match self {
            Target::Thumbnail => THUMBNAIL_SIZE,
            Target::Preview => PREVIEW_SIZE,
        }
    }
}

/// 1回分の工程ごとの時間。その工程を通らなかったものは None。
#[derive(Default, Clone)]
struct Timing {
    io: Duration,
    search: Option<Duration>,
    decode: Duration,
    orient: Option<Duration>,
    develop: Option<Duration>,
    resize: Duration,
    save: Duration,
}

impl Timing {
    fn total(&self) -> Duration {
        self.io
            + self.search.unwrap_or_default()
            + self.decode
            + self.orient.unwrap_or_default()
            + self.develop.unwrap_or_default()
            + self.resize
            + self.save
    }
}

/// 1回分の、時間以外に分かったこと
#[derive(Default, Clone)]
struct Facts {
    /// デコードした埋め込み JPEG（または JPEG 本体）の画素数
    decoded: Option<(u32, u32)>,
    orientation: Option<u16>,
    /// 埋め込み JPEG 自身が向きの EXIF を持っていたか（無いと RAW 本体の EXIF を読みに行く）
    orientation_in_jpeg: Option<bool>,
    /// 現像に落ちた理由と結果
    develop: Option<String>,
    /// `extract_largest_jpeg` を丸ごと呼んだときの時間（I/O + 探索と比べる用）
    extract_whole: Option<Duration>,
    picked_offset: Option<u64>,
    output: Option<(u32, u32)>,
    /// 参考: 同じ画像を同じ品質でメモリ上の Vec にエンコードした時間。
    /// 「エンコード+保存」のうち、どれだけが書き込み側かを見るため。工程の和には入れない
    encode_in_memory: Option<Duration>,
}

fn read_at(path: &Path, offset: u64, len: usize) -> std::io::Result<Vec<u8>> {
    let mut f = File::open(path)?;
    f.seek(SeekFrom::Start(offset))?;
    let mut buf = vec![0u8; len];
    f.read_exact(&mut buf)?;
    Ok(buf)
}

/// `image_processor::load_raw_at_least` を工程に割って呼び直したもの。
/// 分岐は本体と同じ:
///   埋め込み JPEG が取れて長辺が target 以上 → それを使う
///   それ以外 → 現像。現像に失敗したら、小さくても埋め込みを使う
fn staged_raw_load(path: &Path, target: u32, t: &mut Timing, f: &mut Facts) -> DynamicImage {
    let start = Instant::now();
    let _ = raw_preview::list_candidates(path);
    t.search = Some(start.elapsed());

    // 本体が呼ぶ関数そのもの。どの候補が選ばれたかと、丸ごとの時間を取る
    let start = Instant::now();
    let extracted = raw_preview::extract_largest_jpeg(path);
    f.extract_whole = Some(start.elapsed());

    let mut embedded = None;
    let mut reason = "埋め込み JPEG が取れない";
    if let Ok(jpeg) = &extracted {
        f.picked_offset = Some(jpeg.offset);

        let start = Instant::now();
        let bytes = read_at(path, jpeg.offset, jpeg.bytes.len()).unwrap();
        t.io = start.elapsed();
        assert_eq!(
            bytes, jpeg.bytes,
            "読み直したバイト列が本体の取り出しと違う"
        );

        let start = Instant::now();
        let decoded = image::load_from_memory_with_format(&bytes, ImageFormat::Jpeg);
        t.decode = start.elapsed();

        match decoded {
            Ok(img) => {
                f.decoded = Some((img.width(), img.height()));
                f.orientation_in_jpeg = Some(jpeg_has_orientation(&bytes));

                let start = Instant::now();
                let o = embedded_orientation(&bytes, path);
                let oriented = apply_orientation(img, o);
                t.orient = Some(start.elapsed());
                f.orientation = Some(o);

                if oriented.width().max(oriented.height()) >= target {
                    return oriented;
                }
                reason = "埋め込み JPEG が小さい";
                embedded = Some(oriented);
            }
            Err(_) => reason = "埋め込み JPEG がデコードできない",
        }
    }

    let start = Instant::now();
    let developed = load_raw_image(path);
    t.develop = Some(start.elapsed());

    match developed {
        Ok(img) => {
            f.develop = Some(format!("{reason} → 現像成功"));
            img
        }
        Err(e) => {
            f.develop = Some(format!("{reason} → 現像失敗（{e}）→ 埋め込みを使う"));
            embedded.expect("埋め込みも現像も無い")
        }
    }
}

fn jpeg_has_orientation(bytes: &[u8]) -> bool {
    exif::Reader::new()
        .read_from_container(&mut Cursor::new(bytes))
        .ok()
        .and_then(|e| {
            e.get_field(exif::Tag::Orientation, exif::In::PRIMARY)
                .map(|_| ())
        })
        .is_some()
}

/// `generate_thumbnail` / `generate_preview` を工程に割って呼び直したもの。
fn staged_generate(path: &Path, target: Target, out: &Path) -> (Timing, Facts) {
    let mut t = Timing::default();
    let mut f = Facts::default();

    let img = if is_raw_format(&ext_of(path)) {
        staged_raw_load(path, target.size(), &mut t, &mut f)
    } else {
        // 本体は image::open。読み込みとデコードを分けるため、読んでからメモリ上でデコードする。
        // image::open も形式は拡張子で決めている。
        let start = Instant::now();
        let bytes = std::fs::read(path).unwrap();
        t.io = start.elapsed();

        let format = ImageFormat::from_path(path).unwrap();
        let start = Instant::now();
        let img = image::load_from_memory_with_format(&bytes, format).unwrap();
        t.decode = start.elapsed();
        f.decoded = Some((img.width(), img.height()));
        img
    };

    let start = Instant::now();
    let small = img.thumbnail(target.size(), target.size());
    t.resize = start.elapsed();
    f.output = Some((small.width(), small.height()));

    let start = Instant::now();
    match target {
        Target::Thumbnail => small.save_with_format(out, ImageFormat::Jpeg).unwrap(),
        Target::Preview => write_preview_jpeg(&small, out).unwrap(),
    }
    t.save = start.elapsed();

    // 本体と同じ品質で、書き込み先だけメモリにしたもの（参考値）。
    // サムネイルの save_with_format は既定品質（75）、プレビューは 90。
    let quality = match target {
        Target::Thumbnail => 75,
        Target::Preview => 90,
    };
    let mut buf = Vec::new();
    let start = Instant::now();
    small
        .write_with_encoder(image::codecs::jpeg::JpegEncoder::new_with_quality(
            &mut buf, quality,
        ))
        .unwrap();
    f.encode_in_memory = Some(start.elapsed());

    (t, f)
}

fn production_generate(path: &Path, target: Target, out: &Path) -> glimpse_lib::error::Result<()> {
    match target {
        Target::Thumbnail => generate_thumbnail(path, out),
        Target::Preview => generate_preview(path, out),
    }
}

/// 本体がそもそも作らない組み合わせ（JPEG のプレビュー）は測らない
fn applies(path: &Path, target: Target) -> bool {
    target == Target::Thumbnail || is_raw_format(&ext_of(path))
}

// ── 候補一覧 ─────────────────────────────

struct CandidateRow {
    info: CandidateInfo,
    /// SOF から読んだ画素数。image クレートがヘッダを読めなければ None
    dims: Option<(u32, u32)>,
    /// 最初に出てくる SOF マーカーの種類
    sof: Option<&'static str>,
}

/// JPEG のセグメントをたどって、最初の SOF マーカーの種類を返す。
/// ロスレス（SOF3）は RAW の本体データの圧縮に使われる形式で、絵としては読めない。
fn sof_kind(bytes: &[u8]) -> Option<&'static str> {
    let mut pos = 2;
    while pos + 4 <= bytes.len() {
        if bytes[pos] != 0xFF {
            return None;
        }
        let marker = bytes[pos + 1];
        let kind = match marker {
            0xC0 => Some("SOF0 ベースライン"),
            0xC1 => Some("SOF1 拡張"),
            0xC2 => Some("SOF2 プログレッシブ"),
            0xC3 => Some("SOF3 ロスレス"),
            0xC5..=0xC7 | 0xC9..=0xCB | 0xCD..=0xCF => Some("SOF その他"),
            _ => None,
        };
        if kind.is_some() {
            return kind;
        }
        let len = u16::from_be_bytes([bytes[pos + 2], bytes[pos + 3]]) as usize;
        pos += 2 + len;
    }
    None
}

fn candidate_rows(path: &Path) -> Vec<CandidateRow> {
    let file_len = std::fs::metadata(path).unwrap().len();
    raw_preview::list_candidates(path)
        .unwrap_or_default()
        .into_iter()
        .map(|info| {
            let bytes = (info.offset + info.length <= file_len)
                .then(|| read_at(path, info.offset, info.length as usize).ok())
                .flatten()
                .filter(|b| b.len() > 4 && b[0] == 0xFF && b[1] == 0xD8 && b[2] == 0xFF);
            let sof = bytes.as_deref().and_then(sof_kind);
            let dims = bytes.and_then(|b| {
                image::codecs::jpeg::JpegDecoder::new(Cursor::new(b))
                    .ok()
                    .map(|d| d.dimensions())
            });
            CandidateRow { info, dims, sof }
        })
        .collect()
}

/// 長辺が size 以上ある候補のうち、バイト長がいちばん小さいもの
fn smallest_sufficient(rows: &[CandidateRow], size: u32) -> Option<u64> {
    rows.iter()
        .filter(|r| r.dims.map(|(w, h)| w.max(h) >= size).unwrap_or(false))
        .min_by_key(|r| r.info.length)
        .map(|r| r.info.offset)
}

// ── 集計と表示 ─────────────────────────────

fn iterations() -> usize {
    std::env::var("GLIMPSE_BENCH_ITERS")
        .ok()
        .and_then(|v| v.parse().ok())
        .filter(|n| *n > 0)
        .unwrap_or(5)
}

fn median(mut v: Vec<Duration>) -> Duration {
    v.sort();
    v[v.len() / 2]
}

fn ms(d: Duration) -> String {
    format!("{:.1}", d.as_secs_f64() * 1000.0)
}

fn px(d: Option<(u32, u32)>) -> String {
    match d {
        Some((w, h)) => format!("{w}×{h} ({:.1}MP)", (w as f64 * h as f64) / 1e6),
        None => "—".into(),
    }
}

/// 工程の中央値と、その工程が合計に占める割合
fn cell(d: Option<Duration>, sum: Duration) -> String {
    match d {
        Some(d) => format!(
            "{} ({:.0}%)",
            ms(d),
            d.as_secs_f64() / sum.as_secs_f64() * 100.0
        ),
        None => "—".into(),
    }
}

struct Measured {
    name: String,
    ext: String,
    stages: [Option<Duration>; 7],
    stage_sum: Duration,
    total_median: Duration,
    production_median: Duration,
    extract_whole: Option<Duration>,
    encode_in_memory: Option<Duration>,
    facts: Facts,
}

fn measure(path: &Path, target: Target, dir: &Path, iters: usize) -> Measured {
    let staged_out = dir.join("staged.jpg");
    let prod_out = dir.join("production.jpg");

    let mut runs = Vec::new();
    let mut production = Vec::new();
    let mut encode_in_memory = Vec::new();
    let mut facts = Facts::default();
    for _ in 0..iters {
        let (t, f) = staged_generate(path, target, &staged_out);
        runs.push(t);
        encode_in_memory.extend(f.encode_in_memory);
        facts = f;

        let start = Instant::now();
        production_generate(path, target, &prod_out).unwrap();
        production.push(start.elapsed());
    }

    let pick = |get: fn(&Timing) -> Option<Duration>| -> Option<Duration> {
        let v: Vec<Duration> = runs.iter().filter_map(get).collect();
        (!v.is_empty()).then(|| median(v))
    };
    let stages = [
        pick(|t| Some(t.io)),
        pick(|t| t.search),
        pick(|t| Some(t.decode)),
        pick(|t| t.orient),
        pick(|t| t.develop),
        pick(|t| Some(t.resize)),
        pick(|t| Some(t.save)),
    ];
    let stage_sum = stages.iter().flatten().sum();

    Measured {
        name: name_of(path),
        ext: ext_of(path).to_uppercase(),
        stages,
        stage_sum,
        total_median: median(runs.iter().map(Timing::total).collect()),
        production_median: median(production),
        extract_whole: facts.extract_whole,
        encode_in_memory: (!encode_in_memory.is_empty()).then(|| median(encode_in_memory)),
        facts,
    }
}

fn print_breakdown(target: Target, rows: &[Measured]) {
    let label = match target {
        Target::Thumbnail => "サムネイル（300px, `generate_thumbnail`）",
        Target::Preview => "プレビュー（2000px, `generate_preview`）",
    };
    println!("\n### {label}\n");
    println!(
        "| 拡張子 | ファイル | I/O | 探索 | デコード | 向き | 現像 | 縮小 | エンコード+保存 | 合計 | 本体の実測 |"
    );
    println!("|---|---|---|---|---|---|---|---|---|---|---|");
    for m in rows {
        let cells: Vec<String> = m.stages.iter().map(|s| cell(*s, m.stage_sum)).collect();
        println!(
            "| {} | {} | {} | {} | {} | {} | {} | {} | {} | **{}** | {} |",
            m.ext,
            m.name,
            cells[0],
            cells[1],
            cells[2],
            cells[3],
            cells[4],
            cells[5],
            cells[6],
            ms(m.total_median),
            ms(m.production_median),
        );
    }

    println!("\n| 拡張子 | ファイル | デコードした画素数 | 出力 | 向き | 現像 | `extract_largest_jpeg` 丸ごと | 参考: エンコードのみ（メモリ上） |");
    println!("|---|---|---|---|---|---|---|---|");
    for m in rows {
        let orient = match (m.facts.orientation, m.facts.orientation_in_jpeg) {
            (Some(o), Some(true)) => format!("{o}（JPEG の EXIF）"),
            (Some(o), Some(false)) => format!("{o}（RAW 本体の EXIF）"),
            _ => "—".into(),
        };
        println!(
            "| {} | {} | {} | {} | {} | {} | {} | {} |",
            m.ext,
            m.name,
            px(m.facts.decoded),
            px(m.facts.output),
            orient,
            m.facts.develop.as_deref().unwrap_or("落ちていない"),
            m.extract_whole.map(ms).unwrap_or_else(|| "—".into()),
            m.encode_in_memory.map(ms).unwrap_or_else(|| "—".into()),
        );
    }
}

fn print_candidates(files: &[PathBuf], picked: &[(String, Option<u64>)]) {
    println!("\n### 埋め込み JPEG の候補\n");
    println!("採用 = `pick_largest` が選んだもの（バイト長が最大）。");
    println!("300 / 2000 = 長辺がその大きさに足りる候補のうち、バイト長がいちばん小さいもの。\n");
    println!("| 拡張子 | ファイル | offset | バイト長 | SOF | 画素数（SOF） | タグの画素数 | 採用 | 300 | 2000 |");
    println!("|---|---|---|---|---|---|---|---|---|---|");
    for path in files.iter().filter(|p| is_raw_format(&ext_of(p))) {
        let name = name_of(path);
        let rows = candidate_rows(path);
        let chosen = picked
            .iter()
            .find(|(n, _)| *n == name)
            .and_then(|(_, o)| *o);
        let s300 = smallest_sufficient(&rows, THUMBNAIL_SIZE);
        let s2000 = smallest_sufficient(&rows, PREVIEW_SIZE);
        let mark = |b: bool| if b { "✓" } else { "" };
        if rows.is_empty() {
            println!(
                "| {} | {name} | — | — | — | 候補なし | — | | | |",
                ext_of(path).to_uppercase()
            );
        }
        for r in &rows {
            let tag = match (r.info.tag_width, r.info.tag_height) {
                (Some(w), Some(h)) => format!("{w}×{h}"),
                _ => "—".into(),
            };
            println!(
                "| {} | {name} | {} | {} | {} | {} | {tag} | {} | {} | {} |",
                ext_of(path).to_uppercase(),
                r.info.offset,
                r.info.length,
                r.sof.unwrap_or("—"),
                r.dims
                    .map(|d| px(Some(d)))
                    .unwrap_or_else(|| "読めない".into()),
                mark(chosen == Some(r.info.offset)),
                mark(s300 == Some(r.info.offset)),
                mark(s2000 == Some(r.info.offset)),
            );
        }
    }
}

// ── テスト ─────────────────────────────

/// 工程に割って呼び直したものが、本体と同じ JPEG を作ること。
/// これが通っている限り、下の内訳は本体と同じ処理を測っている。
#[test]
fn staged_pipeline_matches_production() {
    let files = samples();
    if files.is_empty() {
        eprintln!("GLIMPSE_RAW_DIR が未設定のため省略");
        return;
    }

    on_big_stack(move || {
        let dir = tempfile::tempdir().unwrap();
        for path in &files {
            for target in [Target::Thumbnail, Target::Preview] {
                if !applies(path, target) {
                    continue;
                }
                let staged = dir.path().join("staged.jpg");
                let prod = dir.path().join("production.jpg");
                staged_generate(path, target, &staged);
                production_generate(path, target, &prod).unwrap();
                assert!(
                    std::fs::read(&staged).unwrap() == std::fs::read(&prod).unwrap(),
                    "{}: 工程に割った生成が本体と違う JPEG を作った（{}px）",
                    name_of(path),
                    target.size()
                );
            }
        }
    });
}

/// 工程ごとの内訳を Markdown の表で出す。release でだけ走らせる。
#[test]
fn thumbnail_breakdown() {
    let files = samples();
    if files.is_empty() {
        eprintln!("GLIMPSE_RAW_DIR が未設定のため省略");
        return;
    }
    if cfg!(debug_assertions) {
        eprintln!(
            "debug ビルドの時間は参考にならないため省略。\
             cargo test --release --test thumbnail_breakdown -- --nocapture で走らせること"
        );
        return;
    }

    on_big_stack(move || {
        let iters = iterations();
        println!("\n## サムネイル生成の内訳\n");
        println!(
            "- 1ファイルあたり {iters} 回、工程ごとの中央値（ms）。括弧内は工程の中央値の和に対する割合"
        );
        println!("- 合計 = 1回ごとの工程の和の中央値。本体の実測 = 同じファイルで本体の関数を呼んだ時間の中央値");
        println!("- 1枚ずつ1スレッドで測っている（本体は下のスレッド数で並列に回す）");
        println!(
            "- available_parallelism = {}, get_thumbnail_thread_count() = {}",
            std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(0),
            get_thumbnail_thread_count()
        );

        let dir = tempfile::tempdir().unwrap();
        let mut picked = Vec::new();
        for target in [Target::Thumbnail, Target::Preview] {
            let rows: Vec<Measured> = files
                .iter()
                .filter(|p| applies(p, target))
                .map(|p| measure(p, target, dir.path(), iters))
                .collect();
            if target == Target::Thumbnail {
                picked = rows
                    .iter()
                    .map(|m| (m.name.clone(), m.facts.picked_offset))
                    .collect();
            }
            print_breakdown(target, &rows);
        }
        print_candidates(&files, &picked);
    });
}
