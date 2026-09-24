//! RAW ファイルに埋め込まれている JPEG を取り出す。
//!
//! # なぜこれが要るか
//!
//! `rawloader` + `imagepipe` で現像すると1枚あたり1〜4秒かかる。選別作業では
//! 数千枚を見るので、これだけで数十分になる。しかも `rawloader` は機種表を
//! 持っているため、表に無いカメラ（Canon R5 の CR3、Fujifilm X-T3 の RAF など）は
//! 読めない。実測: CR3 は "Couldn't find a decoder"、X-T3 は
//! "Couldn't find camera FUJIFILM X-T3" で失敗する（Windows・macOS 共通）。
//!
//! 一方、RAW ファイルにはカメラが書き込んだ JPEG が必ず入っている。背面液晶が
//! 表示しているのはこれで、**現像を通さずに取り出せる**。機種表も要らない。
//! 選別に必要なのは「採用か不採用か」を判断できる絵なので、カメラの絵作りで
//! 十分であり、むしろ撮影者の見た絵に近い。
//!
//! # なぜ自分で書くか
//!
//! `rawler` / `quickraw` はどちらも LGPL-2.1 で、Glimpse（MIT）に静的リンクすると
//! ライセンスが縛られる。ここでやることは構造をたどって JPEG の位置を読むだけなので、
//! 依存を増やさず自前で持つ。
//!
//! # 対応している構造
//!
//! | 構造 | 拡張子 | どこに入っているか |
//! |---|---|---|
//! | TIFF/IFD | NEF, CR2, ARW, DNG, ORF, RW2, PEF, SRW | IFD を全部たどって JPEG を集め、一番大きいものを選ぶ |
//! | RAF | RAF | ヘッダ 0x54 に位置、0x58 に長さ（ビッグエンディアン） |
//! | ISOBMFF | CR3 | ボックスをたどって PRVW ボックスの中の JPEG |
//!
//! 取り出せなかったときは呼び出し側が `rawloader` に落ちる。**この関数は
//! 「速い経路」であって、唯一の経路ではない。**

use crate::error::{GlimpseError, Result};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

/// これより小さい JPEG は「小さすぎるサムネイル」とみなして候補から外す。
/// 160x120 程度の EXIF サムネイルを拾ってしまうと、拡大表示に使えない。
const MIN_JPEG_BYTES: u64 = 8 * 1024;

/// IFD をたどる深さの上限。壊れたファイルで無限に潜らないため。
const MAX_IFD_DEPTH: u8 = 4;

/// 1ファイルから拾う候補の上限。壊れたファイルで延々と走らないため。
const MAX_CANDIDATES: usize = 64;

/// 取り出した JPEG
#[derive(Debug)]
pub struct EmbeddedJpeg {
    pub bytes: Vec<u8>,
    /// ファイル先頭からの位置。どの候補を選んだかを計測側で見分けるため
    pub offset: u64,
    /// 画素数が分かった場合のみ（TIFF のタグから読めるとき）
    pub width: Option<u32>,
    pub height: Option<u32>,
}

/// RAW ファイルから、いちばん大きい埋め込み JPEG を取り出す。
///
/// 見つからない場合も含めてエラーを返す。呼び出し側は現像に落ちること。
pub fn extract_largest_jpeg(path: &Path) -> Result<EmbeddedJpeg> {
    let mut file = File::open(path)?;
    match detect_container(&mut file)? {
        Container::Raf => extract_from_raf(&mut file),
        Container::Isobmff => extract_from_isobmff(&mut file),
        Container::Tiff { little } => extract_from_tiff(&mut file, little),
    }
}

/// 埋め込み JPEG の候補1つ。選ぶ前の形。
#[derive(Debug, Clone, Copy)]
pub struct CandidateInfo {
    pub offset: u64,
    pub length: u64,
    /// TIFF のタグに書いてある画素数（strip 形式のときだけ分かる）
    pub tag_width: Option<u32>,
    pub tag_height: Option<u32>,
}

/// `extract_largest_jpeg` が選ぶ前に集めている候補を、全部そのまま返す。
///
/// 計測（`tests/thumbnail_breakdown.rs`）で「どれを選んだか・他に何があったか」を
/// 出すためのもの。選び方には関与しない。
///
/// - TIFF 系: `walk_ifd` が集めた候補すべて（`pick_largest` が落とす前）
/// - RAF: ヘッダが指す1つ
/// - CR3: PRVW ボックスの JPEG 1つ（PRVW 以外のボックスはそもそも見ていない）
pub fn list_candidates(path: &Path) -> Result<Vec<CandidateInfo>> {
    let mut file = File::open(path)?;
    let candidates = match detect_container(&mut file)? {
        Container::Raf => {
            let (offset, length) = raf_location(&mut file)?;
            vec![Candidate {
                offset,
                length,
                width: None,
                height: None,
            }]
        }
        Container::Isobmff => {
            let file_len = file.metadata()?.len();
            let mut best = None;
            walk_boxes(&mut file, 0, file_len, 0, &mut best)?;
            best.map(|(offset, bytes): (u64, Vec<u8>)| Candidate {
                offset,
                length: bytes.len() as u64,
                width: None,
                height: None,
            })
            .into_iter()
            .collect()
        }
        Container::Tiff { little } => tiff_candidates(&mut file, little)?,
    };
    Ok(candidates
        .into_iter()
        .map(|c| CandidateInfo {
            offset: c.offset,
            length: c.length,
            tag_width: c.width,
            tag_height: c.height,
        })
        .collect())
}

enum Container {
    Raf,
    Isobmff,
    Tiff { little: bool },
}

fn detect_container(file: &mut File) -> Result<Container> {
    let mut magic = [0u8; 16];
    let read = file.read(&mut magic)?;
    if read < 12 {
        return Err(GlimpseError::RawProcessing("file too short".into()));
    }

    // RAF は先頭が "FUJIFILMCCD-RAW"
    if magic.starts_with(b"FUJIFILM") {
        return Ok(Container::Raf);
    }

    // ISOBMFF（CR3）は 4..8 が "ftyp"
    if &magic[4..8] == b"ftyp" {
        return Ok(Container::Isobmff);
    }

    // TIFF は "II*\0"（リトルエンディアン）または "MM\0*"（ビッグエンディアン）
    if &magic[0..4] == b"II\x2a\x00" || &magic[0..4] == b"MM\x00\x2a" {
        let little = magic[0] == b'I';
        return Ok(Container::Tiff { little });
    }

    Err(GlimpseError::RawProcessing(format!(
        "unsupported container (magic {:02x?})",
        &magic[0..4]
    )))
}

// ── 共通のバイト読み ─────────────────────────────

fn read_exact_at(file: &mut File, offset: u64, len: usize) -> Result<Vec<u8>> {
    file.seek(SeekFrom::Start(offset))?;
    let mut buf = vec![0u8; len];
    file.read_exact(&mut buf)?;
    Ok(buf)
}

fn u16_at(buf: &[u8], pos: usize, little: bool) -> u16 {
    let b = [buf[pos], buf[pos + 1]];
    if little {
        u16::from_le_bytes(b)
    } else {
        u16::from_be_bytes(b)
    }
}

fn u32_at(buf: &[u8], pos: usize, little: bool) -> u32 {
    let b = [buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]];
    if little {
        u32::from_le_bytes(b)
    } else {
        u32::from_be_bytes(b)
    }
}

/// JPEG として使えるかを先頭のマーカーで確かめる。
/// オフセットがずれている RAW も実在するので、必ず見る。
fn looks_like_jpeg(bytes: &[u8]) -> bool {
    bytes.len() > 4 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF
}

// ── TIFF / IFD ─────────────────────────────

/// JPEG の場所の候補
#[derive(Debug, Clone, Copy)]
struct Candidate {
    offset: u64,
    length: u64,
    width: Option<u32>,
    height: Option<u32>,
}

const TAG_IMAGE_WIDTH: u16 = 0x0100;
const TAG_IMAGE_LENGTH: u16 = 0x0101;
const TAG_COMPRESSION: u16 = 0x0103;
const TAG_STRIP_OFFSETS: u16 = 0x0111;
const TAG_STRIP_BYTE_COUNTS: u16 = 0x0117;
const TAG_SUB_IFDS: u16 = 0x014A;
const TAG_JPEG_INTERCHANGE_FORMAT: u16 = 0x0201;
const TAG_JPEG_INTERCHANGE_FORMAT_LENGTH: u16 = 0x0202;

/// 圧縮方式が JPEG かどうか。6 は旧 JPEG、7 は新 JPEG。
fn is_jpeg_compression(v: u32) -> bool {
    v == 6 || v == 7
}

fn extract_from_tiff(file: &mut File, little: bool) -> Result<EmbeddedJpeg> {
    let candidates = tiff_candidates(file, little)?;
    pick_largest(file, candidates)
}

fn tiff_candidates(file: &mut File, little: bool) -> Result<Vec<Candidate>> {
    let header = read_exact_at(file, 0, 8)?;
    let first_ifd = u32_at(&header, 4, little) as u64;

    let mut candidates = Vec::new();
    let mut next = first_ifd;
    let mut seen = 0u8;

    // IFD0 → IFD1 → … と鎖をたどる。CR2 は IFD0 に全画素の JPEG、
    // NEF は SubIFD にプレビューが入っている。
    while next != 0 && seen < MAX_IFD_DEPTH && candidates.len() < MAX_CANDIDATES {
        next = walk_ifd(file, next, little, 0, &mut candidates)?;
        seen += 1;
    }

    Ok(candidates)
}

/// 1つの IFD を読み、候補を集めて、次の IFD のオフセットを返す。
fn walk_ifd(
    file: &mut File,
    ifd_offset: u64,
    little: bool,
    depth: u8,
    candidates: &mut Vec<Candidate>,
) -> Result<u64> {
    if depth >= MAX_IFD_DEPTH || candidates.len() >= MAX_CANDIDATES {
        return Ok(0);
    }

    let count_buf = read_exact_at(file, ifd_offset, 2)?;
    let count = u16_at(&count_buf, 0, little) as usize;
    if count == 0 || count > 512 {
        return Ok(0);
    }

    let entries = read_exact_at(file, ifd_offset + 2, count * 12 + 4)?;

    let mut compression = None;
    let mut strip_offset = None;
    let mut strip_len = None;
    let mut jpeg_offset = None;
    let mut jpeg_len = None;
    let mut width = None;
    let mut height = None;
    let mut sub_ifds: Vec<u64> = Vec::new();

    for i in 0..count {
        let e = i * 12;
        let tag = u16_at(&entries, e, little);
        let typ = u16_at(&entries, e + 2, little);
        let n = u32_at(&entries, e + 4, little);
        let value_pos = e + 8;

        // 型ごとの1要素の大きさ。ここでは short(3) と long(4) だけ扱う。
        let scalar = |pos: usize| -> Option<u32> {
            match typ {
                3 => Some(u16_at(&entries, pos, little) as u32),
                4 => Some(u32_at(&entries, pos, little)),
                _ => None,
            }
        };

        match tag {
            TAG_IMAGE_WIDTH => width = scalar(value_pos),
            TAG_IMAGE_LENGTH => height = scalar(value_pos),
            TAG_COMPRESSION => compression = scalar(value_pos),
            TAG_JPEG_INTERCHANGE_FORMAT => jpeg_offset = scalar(value_pos).map(u64::from),
            TAG_JPEG_INTERCHANGE_FORMAT_LENGTH => jpeg_len = scalar(value_pos).map(u64::from),
            // strip は複数ありうるが、JPEG プレビューは1 strip に収まっている。
            // 複数 strip のものは現像側に任せる。
            TAG_STRIP_OFFSETS if n == 1 => strip_offset = scalar(value_pos).map(u64::from),
            TAG_STRIP_BYTE_COUNTS if n == 1 => strip_len = scalar(value_pos).map(u64::from),
            TAG_SUB_IFDS => {
                if n == 1 {
                    if let Some(v) = scalar(value_pos) {
                        sub_ifds.push(v as u64);
                    }
                } else if typ == 4 && n <= 16 {
                    // 4バイトに収まらないので、値は別の場所にある
                    let list_at = u32_at(&entries, value_pos, little) as u64;
                    if let Ok(list) = read_exact_at(file, list_at, n as usize * 4) {
                        for k in 0..n as usize {
                            sub_ifds.push(u32_at(&list, k * 4, little) as u64);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // JPEGInterchangeFormat 形式（ARW など）
    if let (Some(off), Some(len)) = (jpeg_offset, jpeg_len) {
        if len >= MIN_JPEG_BYTES {
            candidates.push(Candidate {
                offset: off,
                length: len,
                width: None, // このタグの画素数は別タグなので、あとで JPEG から読む
                height: None,
            });
        }
    }

    // strip 形式（CR2 の全画素 JPEG、NEF のプレビューなど）
    if let (Some(off), Some(len)) = (strip_offset, strip_len) {
        if len >= MIN_JPEG_BYTES && compression.map(is_jpeg_compression).unwrap_or(false) {
            candidates.push(Candidate {
                offset: off,
                length: len,
                width,
                height,
            });
        }
    }

    for sub in sub_ifds {
        // SubIFD の中の next は追わない（本体の鎖と混ざるため）
        let _ = walk_ifd(file, sub, little, depth + 1, candidates)?;
    }

    // この IFD の次
    let next_pos = count * 12;
    Ok(u32_at(&entries, next_pos, little) as u64)
}

/// 候補のうち、実際に JPEG として読めるいちばん大きいものを返す。
fn pick_largest(file: &mut File, mut candidates: Vec<Candidate>) -> Result<EmbeddedJpeg> {
    if candidates.is_empty() {
        return Err(GlimpseError::RawProcessing("no embedded JPEG found".into()));
    }

    let file_len = file.metadata()?.len();
    candidates.retain(|c| c.length >= MIN_JPEG_BYTES && c.offset + c.length <= file_len);
    candidates.sort_by_key(|c| std::cmp::Reverse(c.length));

    for c in candidates {
        let bytes = read_exact_at(file, c.offset, c.length as usize)?;
        if looks_like_jpeg(&bytes) {
            return Ok(EmbeddedJpeg {
                bytes,
                offset: c.offset,
                width: c.width,
                height: c.height,
            });
        }
    }

    Err(GlimpseError::RawProcessing(
        "embedded JPEG candidates were not valid JPEG".into(),
    ))
}

// ── RAF（Fujifilm）─────────────────────────────

/// RAF のヘッダは固定長で、JPEG の位置と長さがビッグエンディアンで入っている。
/// 0x54 = offset, 0x58 = length。
fn extract_from_raf(file: &mut File) -> Result<EmbeddedJpeg> {
    let (offset, length) = raf_location(file)?;

    let file_len = file.metadata()?.len();
    if length < MIN_JPEG_BYTES || offset + length > file_len {
        return Err(GlimpseError::RawProcessing(format!(
            "RAF JPEG offset/length out of range ({offset}/{length})"
        )));
    }

    let bytes = read_exact_at(file, offset, length as usize)?;
    if !looks_like_jpeg(&bytes) {
        return Err(GlimpseError::RawProcessing(
            "RAF JPEG offset did not point to a JPEG".into(),
        ));
    }

    Ok(EmbeddedJpeg {
        bytes,
        offset,
        width: None,
        height: None,
    })
}

/// RAF ヘッダに書いてある JPEG の位置と長さ
fn raf_location(file: &mut File) -> Result<(u64, u64)> {
    let header = read_exact_at(file, 0, 0x60)?;
    let offset = u32_at(&header, 0x54, false) as u64;
    let length = u32_at(&header, 0x58, false) as u64;
    Ok((offset, length))
}

// ── ISOBMFF（CR3）─────────────────────────────

/// CR3 は MP4 と同じボックス構造。プレビューは uuid ボックスの中の
/// PRVW ボックスに入っている。ボックスをたどって PRVW を探し、
/// その中の JPEG を返す。
fn extract_from_isobmff(file: &mut File) -> Result<EmbeddedJpeg> {
    let file_len = file.metadata()?.len();
    let mut best: Option<(u64, Vec<u8>)> = None;
    walk_boxes(file, 0, file_len, 0, &mut best)?;

    match best {
        Some((offset, bytes)) => Ok(EmbeddedJpeg {
            bytes,
            offset,
            width: None,
            height: None,
        }),
        None => Err(GlimpseError::RawProcessing(
            "no PRVW box with a JPEG found".into(),
        )),
    }
}

fn walk_boxes(
    file: &mut File,
    start: u64,
    end: u64,
    depth: u8,
    best: &mut Option<(u64, Vec<u8>)>,
) -> Result<()> {
    if depth > 6 {
        return Ok(());
    }

    let mut pos = start;
    while pos + 8 <= end {
        let head = read_exact_at(file, pos, 8)?;
        let mut size = u32_at(&head, 0, false) as u64;
        let kind = [head[4], head[5], head[6], head[7]];
        let mut body = pos + 8;

        if size == 1 {
            // 64bit サイズ
            let ext = read_exact_at(file, pos + 8, 8)?;
            size = u64::from_be_bytes([
                ext[0], ext[1], ext[2], ext[3], ext[4], ext[5], ext[6], ext[7],
            ]);
            body = pos + 16;
        } else if size == 0 {
            // 残り全部
            size = end - pos;
        }

        if size < 8 || pos + size > end {
            break;
        }

        let body_end = pos + size;

        match &kind {
            b"PRVW" => {
                // PRVW の中は短いヘッダのあとに JPEG が続く。位置は機種で違うので
                // 先頭から SOI マーカーを探す。
                let len = (body_end - body).min(32 * 1024 * 1024) as usize;
                let buf = read_exact_at(file, body, len)?;
                if let Some(at) = find_soi(&buf) {
                    let jpeg = buf[at..].to_vec();
                    if jpeg.len() >= MIN_JPEG_BYTES as usize
                        && best
                            .as_ref()
                            .map(|(_, b)| b.len() < jpeg.len())
                            .unwrap_or(true)
                    {
                        *best = Some((body + at as u64, jpeg));
                    }
                }
            }
            // 中にボックスが入っているもの
            b"moov" | b"trak" | b"mdia" | b"minf" | b"stbl" => {
                walk_boxes(file, body, body_end, depth + 1, best)?;
            }
            b"uuid" => {
                // uuid（16バイト）のあとに子ボックスが続く。ただし CR3 の
                // プレビュー用 uuid は、そのあとにさらに8バイトの前置きを挟む
                // （実測: 00000000 00000001 のあとに PRVW）。ここでずれると
                // 箱の境界が壊れて何も見つからないので、両方試す。
                for skip in [16u64, 24] {
                    let start = body + skip;
                    if start < body_end && plausible_box_at(file, start, body_end) {
                        walk_boxes(file, start, body_end, depth + 1, best)?;
                        break;
                    }
                }
            }
            _ => {}
        }

        pos = body_end;
    }

    Ok(())
}

/// その位置がボックスの先頭として筋が通っているか。
/// 大きさが収まっていて、種類が ASCII 4文字であることだけを見る。
fn plausible_box_at(file: &mut File, pos: u64, end: u64) -> bool {
    if pos + 8 > end {
        return false;
    }
    let Ok(head) = read_exact_at(file, pos, 8) else {
        return false;
    };
    let size = u32_at(&head, 0, false) as u64;
    let kind_ok = head[4..8]
        .iter()
        .all(|b| b.is_ascii_alphanumeric() || *b == b' ');
    kind_ok && size >= 8 && pos + size <= end
}

/// JPEG の先頭（FF D8 FF）を探す。先頭 4KB までしか見ない。
fn find_soi(buf: &[u8]) -> Option<usize> {
    let limit = buf.len().min(4096);
    (0..limit.saturating_sub(3))
        .find(|&i| buf[i] == 0xFF && buf[i + 1] == 0xD8 && buf[i + 2] == 0xFF)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    /// 中身のない JPEG らしきバイト列
    fn fake_jpeg(size: usize) -> Vec<u8> {
        let mut v = vec![0xFF, 0xD8, 0xFF, 0xE0];
        v.resize(size - 2, 0x5A);
        v.extend_from_slice(&[0xFF, 0xD9]);
        v
    }

    /// IFD が1つだけの最小の TIFF を組む。
    /// JPEGInterchangeFormat / Length で JPEG を指す。
    fn minimal_tiff(jpeg: &[u8]) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(b"II\x2a\x00");
        out.extend_from_slice(&8u32.to_le_bytes()); // IFD0 は 8 から

        let entry_count: u16 = 2;
        let ifd_size = 2 + entry_count as usize * 12 + 4;
        let jpeg_at = (8 + ifd_size) as u32;

        out.extend_from_slice(&entry_count.to_le_bytes());
        // 0x0201 JPEGInterchangeFormat (long, 1)
        out.extend_from_slice(&0x0201u16.to_le_bytes());
        out.extend_from_slice(&4u16.to_le_bytes());
        out.extend_from_slice(&1u32.to_le_bytes());
        out.extend_from_slice(&jpeg_at.to_le_bytes());
        // 0x0202 length
        out.extend_from_slice(&0x0202u16.to_le_bytes());
        out.extend_from_slice(&4u16.to_le_bytes());
        out.extend_from_slice(&1u32.to_le_bytes());
        out.extend_from_slice(&(jpeg.len() as u32).to_le_bytes());
        // next IFD なし
        out.extend_from_slice(&0u32.to_le_bytes());

        assert_eq!(out.len(), jpeg_at as usize);
        out.extend_from_slice(jpeg);
        out
    }

    fn write_temp(name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(name);
        let mut f = File::create(&path).unwrap();
        f.write_all(bytes).unwrap();
        path
    }

    #[test]
    fn extracts_jpeg_from_tiff_container() {
        let jpeg = fake_jpeg(20 * 1024);
        let path = write_temp("glimpse-test-tiff.nef", &minimal_tiff(&jpeg));
        let got = extract_largest_jpeg(&path).unwrap();
        assert_eq!(got.bytes.len(), jpeg.len());
        assert!(looks_like_jpeg(&got.bytes));
    }

    #[test]
    fn lists_the_candidate_that_extract_picks() {
        let jpeg = fake_jpeg(20 * 1024);
        let path = write_temp("glimpse-test-list.nef", &minimal_tiff(&jpeg));
        let listed = list_candidates(&path).unwrap();
        let got = extract_largest_jpeg(&path).unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].offset, got.offset);
        assert_eq!(listed[0].length, jpeg.len() as u64);
    }

    #[test]
    fn ignores_jpeg_too_small_to_be_a_preview() {
        // EXIF の小さなサムネイルだけがある状態。拡大表示に使えないので拾わない。
        let jpeg = fake_jpeg(1024);
        let path = write_temp("glimpse-test-small.nef", &minimal_tiff(&jpeg));
        assert!(extract_largest_jpeg(&path).is_err());
    }

    #[test]
    fn extracts_jpeg_from_raf_header() {
        let jpeg = fake_jpeg(30 * 1024);
        let mut raf = vec![0u8; 0x60];
        raf[0..8].copy_from_slice(b"FUJIFILM");
        let offset = 0x60u32;
        raf[0x54..0x58].copy_from_slice(&offset.to_be_bytes());
        raf[0x58..0x5C].copy_from_slice(&(jpeg.len() as u32).to_be_bytes());
        raf.extend_from_slice(&jpeg);

        let path = write_temp("glimpse-test.raf", &raf);
        let got = extract_largest_jpeg(&path).unwrap();
        assert_eq!(got.bytes.len(), jpeg.len());
    }

    #[test]
    fn rejects_offset_that_does_not_point_at_a_jpeg() {
        // オフセットはあるが中身が JPEG でない（壊れたファイル）
        let mut raf = vec![0u8; 0x60];
        raf[0..8].copy_from_slice(b"FUJIFILM");
        raf[0x54..0x58].copy_from_slice(&0x60u32.to_be_bytes());
        raf[0x58..0x5C].copy_from_slice(&(20 * 1024u32).to_be_bytes());
        raf.extend_from_slice(&vec![0x00; 20 * 1024]);

        let path = write_temp("glimpse-test-broken.raf", &raf);
        assert!(extract_largest_jpeg(&path).is_err());
    }

    #[test]
    fn rejects_unknown_container() {
        let path = write_temp("glimpse-test-unknown.xyz", &vec![0x11; 4096]);
        assert!(extract_largest_jpeg(&path).is_err());
    }

    #[test]
    fn finds_soi_only_near_the_beginning() {
        let mut buf = vec![0u8; 5000];
        buf[4500] = 0xFF;
        buf[4501] = 0xD8;
        buf[4502] = 0xFF;
        assert_eq!(find_soi(&buf), None);

        buf[100] = 0xFF;
        buf[101] = 0xD8;
        buf[102] = 0xFF;
        assert_eq!(find_soi(&buf), Some(100));
    }
}
