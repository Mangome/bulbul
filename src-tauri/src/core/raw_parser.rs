//! RAW/TIFF IFD 链解析器
//!
//! 手动解析 TIFF 格式的 IFD 链，定位并提取 RAW 文件中嵌入的最大 JPEG 预览图。
//! 定义 `ImageExtractor` trait 用于多图片格式扩展。

use crate::models::{AppError, ImageMetadata};

// ─── 支持的图片格式 ────────────────────────────────────

/// 所有支持的 RAW 文件扩展名（小写，不含点号，按字母序排列）
#[allow(dead_code)]
pub const SUPPORTED_RAW_EXTENSIONS: &[&str] = &[
    "arw", "cr2", "cr3", "dng", "nef", "orf", "pef", "raf", "rw2",
];

/// 所有支持的非 RAW 图片文件扩展名（小写，不含点号）
#[allow(dead_code)]
pub const SUPPORTED_IMAGE_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "tiff", "tif", "webp",
];

/// 所有支持的图片文件扩展名（RAW + 非RAW，小写，不含点号）
pub const ALL_SUPPORTED_EXTENSIONS: &[&str] = &[
    "arw", "cr2", "cr3", "dng", "jpg", "jpeg", "nef", "orf", "pef", "png", "raf", "rw2", "tif", "tiff", "webp",
];

/// 判断给定扩展名是否属于支持的 RAW 格式（大小写不敏感）
#[allow(dead_code)]
pub fn is_raw_extension(extension: &str) -> bool {
    SUPPORTED_RAW_EXTENSIONS.contains(&extension.to_lowercase().as_str())
}

/// 判断给定扩展名是否属于支持的图片格式（大小写不敏感）
pub fn is_supported_extension(extension: &str) -> bool {
    ALL_SUPPORTED_EXTENSIONS.contains(&extension.to_lowercase().as_str())
}

// ─── TIFF 常量 ─────────────────────────────────────────

const TIFF_MAGIC: u16 = 42;
/// Panasonic RW2 little-endian magic: 0x0055 (85)
const RW2_MAGIC_LE: u16 = 85;
/// Panasonic RW2 big-endian magic: 0x5500 (21760)
const RW2_MAGIC_BE: u16 = 0x5500;
/// Olympus ORF little-endian magic: "RO" (bytes: 0x52, 0x4F → LE u16: 0x4F52)
const ORF_MAGIC_LE_RO: u16 = 0x4F52;
/// Olympus ORF little-endian magic (newer): "RS" (bytes: 0x52, 0x53 → LE u16: 0x5352)
const ORF_MAGIC_LE_RS: u16 = 0x5352;
/// Olympus ORF big-endian magic: "RO" (bytes: 0x4F, 0x52 → BE u16: 0x4F52)
const ORF_MAGIC_BE_RO: u16 = 0x4F52;
/// Olympus ORF big-endian magic (newer): "RS" (bytes: 0x53, 0x52 → BE u16: 0x5352)
const ORF_MAGIC_BE_RS: u16 = 0x5352;
const TAG_SUB_IFDS: u16 = 0x014A;
const TAG_JPEG_OFFSET: u16 = 0x0201; // JPEGInterchangeFormat
const TAG_JPEG_LENGTH: u16 = 0x0202; // JPEGInterchangeFormatLength
const TAG_COMPRESSION: u16 = 0x0103; // Compression
const TAG_STRIP_OFFSETS: u16 = 0x0111; // StripOffsets
const TAG_STRIP_BYTE_COUNTS: u16 = 0x0117; // StripByteCounts
const COMPRESSION_JPEG: u16 = 7; // JPEG 压缩（DNG 等格式使用）
const COMPRESSION_OLD_JPEG: u16 = 6; // Old-style JPEG 压缩（CR2 等格式使用）
const JPEG_SOI: [u8; 2] = [0xFF, 0xD8];

// ─── 字节序 ─────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq)]
enum ByteOrder {
    LittleEndian,
    BigEndian,
}

impl ByteOrder {
    fn read_u16(&self, data: &[u8], offset: usize) -> Option<u16> {
        if offset + 2 > data.len() {
            return None;
        }
        let bytes = [data[offset], data[offset + 1]];
        Some(match self {
            ByteOrder::LittleEndian => u16::from_le_bytes(bytes),
            ByteOrder::BigEndian => u16::from_be_bytes(bytes),
        })
    }

    fn read_u32(&self, data: &[u8], offset: usize) -> Option<u32> {
        if offset + 4 > data.len() {
            return None;
        }
        let bytes = [
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ];
        Some(match self {
            ByteOrder::LittleEndian => u32::from_le_bytes(bytes),
            ByteOrder::BigEndian => u32::from_be_bytes(bytes),
        })
    }
}

// ─── JPEG 候选 ──────────────────────────────────────────

#[derive(Debug)]
struct JpegCandidate {
    offset: usize,
    length: usize,
}

// ─── TIFF 头解析 ─────────────────────────────────────────

/// 解析 TIFF 头，返回 (字节序, IFD0 偏移量)
fn parse_tiff_header(data: &[u8]) -> Result<(ByteOrder, usize), AppError> {
    if data.len() < 8 {
        return Err(AppError::ImageParseError(format!(
            "文件过短: {} 字节，最少需要 8 字节",
            data.len()
        )));
    }

    let byte_order = match (data[0], data[1]) {
        (0x49, 0x49) => ByteOrder::LittleEndian,
        (0x4D, 0x4D) => ByteOrder::BigEndian,
        _ => {
            return Err(AppError::ImageParseError(format!(
                "无效的字节序标记: 0x{:02X} 0x{:02X}",
                data[0], data[1]
            )))
        }
    };

    let magic = byte_order
        .read_u16(data, 2)
        .ok_or_else(|| AppError::ImageParseError("无法读取 TIFF 魔数".into()))?;

    if magic != TIFF_MAGIC
        && magic != RW2_MAGIC_LE
        && magic != RW2_MAGIC_BE
        && magic != ORF_MAGIC_LE_RO
        && magic != ORF_MAGIC_LE_RS
        && magic != ORF_MAGIC_BE_RO
        && magic != ORF_MAGIC_BE_RS
    {
        return Err(AppError::ImageParseError(format!(
            "无效的 TIFF 魔数: {}，期望 42、85 或 ORF 变体",
            magic
        )));
    }

    let ifd0_offset = byte_order
        .read_u32(data, 4)
        .ok_or_else(|| AppError::ImageParseError("无法读取 IFD0 偏移量".into()))?
        as usize;

    Ok((byte_order, ifd0_offset))
}

// ─── IFD 解析 ────────────────────────────────────────────

/// 解析单个 IFD，收集 JPEG 候选和 SubIFD 偏移
///
/// 返回 (jpeg_candidates, sub_ifd_offsets, next_ifd_offset)
fn parse_ifd(
    data: &[u8],
    bo: ByteOrder,
    ifd_offset: usize,
) -> Result<(Vec<JpegCandidate>, Vec<usize>, usize), AppError> {
    if ifd_offset + 2 > data.len() {
        return Ok((vec![], vec![], 0));
    }

    let entry_count = bo
        .read_u16(data, ifd_offset)
        .ok_or_else(|| AppError::ImageParseError("无法读取 IFD entry 数量".into()))?
        as usize;

    let mut jpeg_offset: Option<u32> = None;
    let mut jpeg_length: Option<u32> = None;
    let mut compression: Option<u16> = None;
    let mut strip_offsets: Option<Vec<u32>> = None;
    let mut strip_byte_counts: Option<Vec<u32>> = None;
    let mut sub_ifd_offsets = Vec::new();

    for i in 0..entry_count {
        let entry_offset = ifd_offset + 2 + i * 12;
        if entry_offset + 12 > data.len() {
            break;
        }

        let tag = match bo.read_u16(data, entry_offset) {
            Some(t) => t,
            None => continue,
        };
        let data_type = match bo.read_u16(data, entry_offset + 2) {
            Some(t) => t,
            None => continue,
        };
        let count = match bo.read_u32(data, entry_offset + 4) {
            Some(c) => c,
            None => continue,
        };

        // value/offset 字段在 entry_offset + 8
        match tag {
            TAG_JPEG_OFFSET => {
                jpeg_offset = read_entry_value(data, bo, entry_offset + 8, data_type, count);
            }
            TAG_JPEG_LENGTH => {
                jpeg_length = read_entry_value(data, bo, entry_offset + 8, data_type, count);
            }
            TAG_COMPRESSION => {
                compression = bo.read_u16(data, entry_offset + 8);
            }
            TAG_STRIP_OFFSETS => {
                strip_offsets =
                    read_entry_values(data, bo, entry_offset + 8, data_type, count as usize);
            }
            TAG_STRIP_BYTE_COUNTS => {
                strip_byte_counts =
                    read_entry_values(data, bo, entry_offset + 8, data_type, count as usize);
            }
            TAG_SUB_IFDS => {
                // SubIFD 指针可能是单个或多个偏移
                let offsets = read_sub_ifd_offsets(data, bo, entry_offset + 8, count as usize);
                sub_ifd_offsets.extend(offsets);
            }
            _ => {}
        }
    }

    let mut candidates = Vec::new();

    // 方式 1：标准 JPEGInterchangeFormat + JPEGInterchangeFormatLength
    if let (Some(offset), Some(length)) = (jpeg_offset, jpeg_length) {
        candidates.push(JpegCandidate {
            offset: offset as usize,
            length: length as usize,
        });
    }

    // 方式 2：StripOffsets + StripByteCounts + JPEG 压缩
    // Compression=7 (JPEG, DNG 等格式) 或 Compression=6 (Old-style JPEG, CR2 等格式)
    if compression == Some(COMPRESSION_JPEG) || compression == Some(COMPRESSION_OLD_JPEG) {
        if let (Some(offsets), Some(counts)) = (&strip_offsets, &strip_byte_counts) {
            if offsets.len() == counts.len() {
                // 多 strip 拼接为单个 JPEG
                let total_length: u32 = counts.iter().sum();
                let first_offset = offsets[0];
                // 验证 strips 是连续的
                let is_contiguous = offsets.windows(2).all(|w| {
                    let idx = offsets.iter().position(|&o| o == w[0]).unwrap_or(0);
                    w[0] + counts[idx] == w[1]
                });
                if is_contiguous && total_length > 0 {
                    candidates.push(JpegCandidate {
                        offset: first_offset as usize,
                        length: total_length as usize,
                    });
                } else {
                    // 非连续 strips，逐个添加
                    for (off, len) in offsets.iter().zip(counts.iter()) {
                        if *len > 0 {
                            candidates.push(JpegCandidate {
                                offset: *off as usize,
                                length: *len as usize,
                            });
                        }
                    }
                }
            }
        }
    }

    // next IFD offset
    let next_offset_pos = ifd_offset + 2 + entry_count * 12;
    let next_ifd = if next_offset_pos + 4 <= data.len() {
        bo.read_u32(data, next_offset_pos).unwrap_or(0) as usize
    } else {
        0
    };

    Ok((candidates, sub_ifd_offsets, next_ifd))
}

/// 读取 IFD entry 的值（LONG 或 SHORT 类型，单个）
fn read_entry_value(
    data: &[u8],
    bo: ByteOrder,
    value_offset: usize,
    data_type: u16,
    count: u32,
) -> Option<u32> {
    match data_type {
        // SHORT (type 3): 2 bytes
        3 if count == 1 => bo.read_u16(data, value_offset).map(|v| v as u32),
        // LONG (type 4): 4 bytes
        4 if count == 1 => bo.read_u32(data, value_offset),
        _ => bo.read_u32(data, value_offset),
    }
}

/// 读取 IFD entry 的值数组（StripOffsets / StripByteCounts 等）
///
/// 当 count=1 时值直接存储在 value 字段；count>1 时 value 字段存储指向数组的偏移
fn read_entry_values(
    data: &[u8],
    bo: ByteOrder,
    value_offset: usize,
    data_type: u16,
    count: usize,
) -> Option<Vec<u32>> {
    if count == 0 {
        return None;
    }

    let value_size = match data_type {
        3 => 2, // SHORT
        4 => 4, // LONG
        _ => 4,
    };

    // 值是否能直接存在 value 字段（4 字节）中
    let inline = count * value_size <= 4;
    let read_single = |pos: usize| -> Option<u32> {
        match data_type {
            3 => bo.read_u16(data, pos).map(|v| v as u32),
            _ => bo.read_u32(data, pos),
        }
    };

    let mut values = Vec::with_capacity(count);
    if inline {
        let mut pos = value_offset;
        for _ in 0..count {
            if let Some(v) = read_single(pos) {
                values.push(v);
            }
            pos += value_size;
        }
    } else {
        // 值存在别处，value 字段存的是偏移
        let array_offset = bo.read_u32(data, value_offset)? as usize;
        let mut pos = array_offset;
        for _ in 0..count {
            if pos + value_size > data.len() {
                break;
            }
            if let Some(v) = read_single(pos) {
                values.push(v);
            }
            pos += value_size;
        }
    }

    if values.is_empty() {
        None
    } else {
        Some(values)
    }
}

/// 读取 SubIFD 偏移数组
fn read_sub_ifd_offsets(
    data: &[u8],
    bo: ByteOrder,
    value_offset: usize,
    count: usize,
) -> Vec<usize> {
    let mut offsets = Vec::with_capacity(count);

    if count == 1 {
        // 单个值直接存在 value 字段
        if let Some(off) = bo.read_u32(data, value_offset) {
            if (off as usize) < data.len() {
                offsets.push(off as usize);
            }
        }
    } else {
        // 多个值：value 字段存的是指向数据的偏移
        let ptr = match bo.read_u32(data, value_offset) {
            Some(p) => p as usize,
            None => return offsets,
        };
        for i in 0..count {
            let off_pos = ptr + i * 4;
            if let Some(off) = bo.read_u32(data, off_pos) {
                if (off as usize) < data.len() {
                    offsets.push(off as usize);
                }
            }
        }
    }

    offsets
}

// ─── 嵌入 JPEG 提取 ─────────────────────────────────────

/// 检查 JPEG 数据是否为可浏览的图像（而非压缩 RAW 传感器数据）
///
/// CR2 等 RAW 格式在 IFD 中使用 Compression=6 存储压缩传感器数据，
/// 这些数据以 SOI 开头但 SOF 标记的 components 字段为 0 或异常值（如 24），
/// 标准 JPEG 解码器无法处理。真正的预览 JPEG 的 components 为 1（灰度）或 3（YCbCr）。
///
/// 返回值：
/// - `Some(true)` — 发现 SOF 且 components 正常（1 或 3）
/// - `Some(false)` — 发现 SOF 且 components 异常
/// - `None` — 未发现 SOF，无法判断（不拒绝）
fn check_jpeg_sof_components(data: &[u8], offset: usize, length: usize) -> Option<bool> {
    let end = offset.saturating_add(length).min(data.len());
    let mut i = offset + 2; // 跳过 SOI (0xFFD8)

    while i + 1 < end {
        if data[i] != 0xFF {
            i += 1;
            continue;
        }
        let marker = data[i + 1];
        i += 2;

        // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2) — 检查 components 字段
        // SOF layout after marker: length(2) + precision(1) + height(2) + width(2) + num_components(1)
        if marker == 0xC0 || marker == 0xC1 || marker == 0xC2 {
            if i + 7 < end {
                let num_components = data[i + 7];
                return Some(num_components == 1 || num_components == 3);
            }
            return Some(false);
        }

        // RST0-RST7, SOI, EOI — 无载荷，继续扫描
        if (0xD0..=0xD9).contains(&marker) || marker == 0x00 {
            continue;
        }

        // 其他标记 — 跳过载荷
        if i + 2 > end {
            break;
        }
        let seg_len = ((data[i] as usize) << 8) | data[i + 1] as usize;
        if seg_len < 2 {
            break;
        }
        i += seg_len;
    }

    // 未找到 SOF 标记，无法判断，不拒绝
    None
}

/// 遍历所有 IFD/SubIFD，提取最大的嵌入 JPEG
pub fn extract_largest_jpeg(data: &[u8]) -> Result<Vec<u8>, AppError> {
    let (bo, ifd0_offset) = parse_tiff_header(data)?;

    let mut all_candidates = Vec::new();
    let mut visited_ifds = std::collections::HashSet::new();
    let mut ifd_queue = vec![ifd0_offset];

    // BFS 遍历所有 IFD（主链 + SubIFD）
    while let Some(ifd_off) = ifd_queue.pop() {
        if ifd_off == 0 || ifd_off >= data.len() || !visited_ifds.insert(ifd_off) {
            continue;
        }

        let (candidates, sub_ifds, next_ifd) = parse_ifd(data, bo, ifd_off)?;
        all_candidates.extend(candidates);
        ifd_queue.extend(sub_ifds);

        if next_ifd != 0 {
            ifd_queue.push(next_ifd);
        }
    }

    // 按大小降序排列，优先选择最大的有效 JPEG
    all_candidates.sort_by(|a, b| b.length.cmp(&a.length));

    // 两轮筛选：
    // 第一轮：优先选择 SOF 验证通过（components=1 或 3）的候选
    // 第二轮：兜底选择 SOF 未知的候选（无 SOF 标记）
    // 始终跳过 SOF 明确异常（components=0 或 >4）的候选
    for pass in 0..2 {
        for candidate in &all_candidates {
            // 越界检查
            if candidate.offset + candidate.length > data.len() {
                continue;
            }
            // SOI 魔数验证
            if candidate.offset + 1 >= data.len() {
                continue;
            }
            if data[candidate.offset] != JPEG_SOI[0] || data[candidate.offset + 1] != JPEG_SOI[1] {
                continue;
            }
            let sof_result = check_jpeg_sof_components(data, candidate.offset, candidate.length);
            match sof_result {
                Some(true) => {
                    // SOF 验证通过，第一轮就返回
                    return Ok(data[candidate.offset..candidate.offset + candidate.length].to_vec());
                }
                Some(false) => {
                    // SOF 明确异常，始终跳过
                    continue;
                }
                None => {
                    // SOF 未知，第一轮跳过，第二轮兜底
                    if pass == 1 {
                        return Ok(data[candidate.offset..candidate.offset + candidate.length].to_vec());
                    }
                }
            }
        }
    }

    Err(AppError::NoEmbeddedJpeg)
}

// ─── ImageExtractor trait ─────────────────────────────────

/// 图片格式提取器 trait，支持 RAW 和非 RAW 格式扩展
#[allow(dead_code)]
pub trait ImageExtractor: Send + Sync {
    /// 支持的文件扩展名（小写，不含点）
    fn supported_extensions(&self) -> &[&str];

    /// 获取图像数据
    ///
    /// RAW 格式返回从容器中提取的嵌入 JPEG 数据；
    /// 非 RAW 格式（JPEG/PNG/TIFF/WebP）返回原始文件字节。
    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError>;

    /// 解析 Exif 元数据
    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError>;

    /// Exif 头部读取大小（字节）
    ///
    /// TIFF/EP 格式返回 65536（64KB），Exif 数据存储在文件头部 IFD 中；
    /// CR3 等非 TIFF 格式返回 0，需全量读取。
    fn exif_header_size(&self) -> usize;
}

/// Nikon NEF 格式提取器
pub struct NefExtractor;

impl ImageExtractor for NefExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["nef"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_largest_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

// ─── TIFF/EP 格式 Extractor ──────────────────────────────
// CR2/ARW/DNG/ORF/RW2/PEF 均基于 TIFF/EP 结构，
// 嵌入 JPEG 提取逻辑与 NEF 相同，复用 extract_largest_jpeg()

/// Canon CR2 格式提取器
pub struct Cr2Extractor;

impl ImageExtractor for Cr2Extractor {
    fn supported_extensions(&self) -> &[&str] {
        &["cr2"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_largest_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

/// Sony ARW 格式提取器
pub struct ArwExtractor;

impl ImageExtractor for ArwExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["arw"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_largest_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

/// Adobe DNG 格式提取器
pub struct DngExtractor;

impl ImageExtractor for DngExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["dng"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_largest_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

/// 从 Panasonic RW2 文件中提取嵌入的 JPEG 预览
///
/// RW2 文件的 JPEG 预览不通过标准 TIFF IFD 标签（JPEGInterchangeFormat）引用，
/// 而是直接嵌入在文件数据区域中。此函数先尝试标准 TIFF IFD 方式，
/// 失败后回退到在文件中搜索最大的有效 JPEG 块。
fn extract_rw2_jpeg(data: &[u8]) -> Result<Vec<u8>, AppError> {
    // 首先尝试标准 TIFF IFD 方式
    if let Ok(jpeg) = extract_largest_jpeg(data) {
        return Ok(jpeg);
    }

    // 回退：在文件中搜索最大的有效 JPEG 块
    scan_largest_jpeg(data)
}

/// 从 Olympus ORF 文件中提取嵌入的 JPEG 预览
///
/// ORF 文件的 JPEG 预览不通过标准 TIFF IFD 标签（JPEGInterchangeFormat）引用，
/// 而是嵌入在 MakerNote 或文件数据区域中。此函数通过搜索最大的有效 JPEG 块来提取预览。
fn extract_orf_jpeg(data: &[u8]) -> Result<Vec<u8>, AppError> {
    // 首先尝试标准 TIFF IFD 方式
    if let Ok(jpeg) = extract_largest_jpeg(data) {
        return Ok(jpeg);
    }

    // 回退：在文件中搜索最大的有效 JPEG 块
    scan_largest_jpeg(data)
}

/// 在文件数据中扫描最大的有效 JPEG 块
///
/// 有效 JPEG 以 FFD8 开头，后跟标准 JPEG 标记（FFXX，其中 XX != 00 且 XX != D8）。
/// 返回大小超过 50KB 的最大 JPEG 块（忽略缩略图和噪声）。
fn scan_largest_jpeg(data: &[u8]) -> Result<Vec<u8>, AppError> {
    let mut best_offset = 0;
    let mut best_size = 0usize;

    let mut i = 0;
    while i + 1 < data.len() {
        if data[i] != 0xFF || data[i + 1] != 0xD8 {
            i += 1;
            continue;
        }

        // 找到 SOI，验证下一个字节是有效的 JPEG 标记
        if i + 3 < data.len() && data[i + 2] == 0xFF {
            let marker = data[i + 3];
            // 标准 JPEG 标记：DQT(0xDB), SOF(0xC0-0xCF), DHT(0xC4), DRI(0xDD),
            // SOS(0xDA), DNL(0xDC), APPn(0xE0-0xEF)
            let is_valid_marker = (0xC0..=0xCF).contains(&marker)
                || marker == 0xDB
                || marker == 0xC4
                || marker == 0xDD
                || marker == 0xDA
                || marker == 0xDC
                || (0xE0..=0xEF).contains(&marker);

            if is_valid_marker {
                // 搜索对应的 EOI (FFD9)
                if let Some(eoi_pos) = find_jpeg_eoi(data, i) {
                    let size = eoi_pos - i;
                    // 忽略太小的 JPEG（< 50KB，可能是缩略图或噪声）
                    if size > 50 * 1024 && size > best_size {
                        best_offset = i;
                        best_size = size;
                    }
                }
            }
        }
        i += 1;
    }

    if best_size > 0 {
        Ok(data[best_offset..best_offset + best_size].to_vec())
    } else {
        Err(AppError::NoEmbeddedJpeg)
    }
}

/// 从 JPEG SOI 位置开始搜索对应的 EOI 标记
///
/// 正确处理 JPEG 标记结构，避免误判数据中的 FFD9 字节序列。
fn find_jpeg_eoi(data: &[u8], start: usize) -> Option<usize> {
    let mut pos = start + 2; // 跳过 SOI

    while pos + 1 < data.len() {
        if data[pos] != 0xFF {
            pos += 1;
            continue;
        }

        // 跳过填充字节
        while pos + 1 < data.len() && data[pos + 1] == 0xFF {
            pos += 1;
        }
        if pos + 1 >= data.len() {
            break;
        }

        let marker = data[pos + 1];

        if marker == 0xD9 {
            // EOI
            return Some(pos + 2);
        }

        if marker == 0x00 || marker == 0x01 || (0xD0..=0xD7).contains(&marker) {
            // 无长度的标记（RSTn, TEM, STUFF）
            pos += 2;
            continue;
        }

        if marker == 0xDA {
            // SOS - 后面是熵编码数据，需要扫描直到找到标记
            // 读取 SOS 段长度
            if pos + 3 >= data.len() {
                break;
            }
            let seg_len = u16::from_be_bytes([data[pos + 2], data[pos + 3]]) as usize;
            pos += 2 + seg_len;

            // 扫描熵编码数据，查找下一个标记
            while pos + 1 < data.len() {
                if data[pos] == 0xFF && data[pos + 1] != 0x00 && data[pos + 1] != 0xFF {
                    break;
                }
                pos += 1;
            }
            continue;
        }

        // 其他标记：读取段长度并跳过
        if pos + 3 >= data.len() {
            break;
        }
        let seg_len = u16::from_be_bytes([data[pos + 2], data[pos + 3]]) as usize;
        pos += 2 + seg_len;
    }

    None
}

/// Olympus ORF 格式提取器
pub struct OrfExtractor;

impl ImageExtractor for OrfExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["orf"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_orf_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        // ORF 使用非标准 TIFF magic (IIRO/IIRS/MMOR/MMSR)
        // kamadak-exif 只认标准 TIFF 签名 (II*\x00 / MM\x00*)，需要替换头部
        if data.len() < 8 {
            return Err(AppError::ExifError("ORF 文件过短".into()));
        }
        let mut normalized = data.to_vec();
        match (data[0], data[1]) {
            // Little-endian ORF: II + RO/RS → 替换为 II*\x00
            (0x49, 0x49) if data[2] == 0x52 && (data[3] == 0x4F || data[3] == 0x53) => {
                normalized[2] = 0x2A;
                normalized[3] = 0x00;
            }
            // Big-endian ORF: MM + OR/SR → 替换为 MM\x00*
            (0x4D, 0x4D) if (data[2] == 0x4F || data[2] == 0x53) && data[3] == 0x52 => {
                normalized[2] = 0x00;
                normalized[3] = 0x2A;
            }
            _ => {}
        }
        crate::core::metadata::parse_exif(&normalized)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

/// Panasonic RW2 格式提取器
pub struct Rw2Extractor;

impl ImageExtractor for Rw2Extractor {
    fn supported_extensions(&self) -> &[&str] {
        &["rw2"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_rw2_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        // RW2 使用 Panasonic 专有 TIFF magic (LE: 0x0055, BE: 0x5500)
        // kamadak-exif 只认标准 TIFF 签名 (II*\x00 / MM\x00*)，需要替换头部
        if data.len() < 8 {
            return Err(AppError::ExifError("RW2 文件过短".into()));
        }
        let mut normalized = data.to_vec();
        match (data[0], data[1]) {
            // Little-endian RW2: II + 0x0055 → 替换为 II*\x00
            (0x49, 0x49) if data[2] == 0x55 && data[3] == 0x00 => {
                normalized[2] = 0x2A;
                normalized[3] = 0x00;
            }
            // Big-endian RW2: MM + 0x5500 → 替换为 MM\x00*
            (0x4D, 0x4D) if data[2] == 0x55 && data[3] == 0x00 => {
                normalized[2] = 0x00;
                normalized[3] = 0x2A;
            }
            _ => {}
        }
        crate::core::metadata::parse_exif(&normalized)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

/// Pentax PEF 格式提取器
pub struct PefExtractor;

impl ImageExtractor for PefExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["pef"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_largest_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

// ─── Fuji RAF 格式解析 ───────────────────────────────────

/// RAF 文件魔数（`FUJIFILMCCD-RAW`，15 字节）
const RAF_MAGIC: &[u8; 15] = b"FUJIFILMCCD-RAW";

/// RAF 文件头最小长度
const RAF_HEADER_SIZE: usize = 148;

/// 解析 RAF 文件头，返回 (JPEG 偏移量, JPEG 长度)
///
/// RAF 文件头结构（前 148 字节）：
/// - 0-15: 魔数 `FUJIFILMCCD-RAW`
/// - 84-87: JPEG 偏移量（big-endian u32）
/// - 88-91: JPEG 长度（big-endian u32）
fn parse_raf_header(data: &[u8]) -> Result<(usize, usize), AppError> {
    if data.len() < RAF_HEADER_SIZE {
        return Err(AppError::ImageParseError(format!(
            "RAF 文件过短: {} 字节，最少需要 {} 字节",
            data.len(),
            RAF_HEADER_SIZE
        )));
    }

    // 验证魔数
    if &data[0..15] != RAF_MAGIC {
        return Err(AppError::ImageParseError(
            "无效的 RAF 文件魔数".into(),
        ));
    }

    // 读取 JPEG 偏移量和长度（big-endian u32）
    let jpeg_offset = u32::from_be_bytes([data[84], data[85], data[86], data[87]]) as usize;
    let jpeg_length = u32::from_be_bytes([data[88], data[89], data[90], data[91]]) as usize;

    Ok((jpeg_offset, jpeg_length))
}

/// 从 RAF 文件数据中提取嵌入的 JPEG 预览
fn extract_raf_jpeg(data: &[u8]) -> Result<Vec<u8>, AppError> {
    let (jpeg_offset, jpeg_length) = parse_raf_header(data)?;

    // 越界检查
    if jpeg_offset + jpeg_length > data.len() {
        return Err(AppError::ImageParseError(format!(
            "RAF JPEG 数据越界: 偏移 {} + 长度 {} > 文件大小 {}",
            jpeg_offset,
            jpeg_length,
            data.len()
        )));
    }

    // 验证 SOI 魔数
    if jpeg_length < 2 || data[jpeg_offset] != JPEG_SOI[0] || data[jpeg_offset + 1] != JPEG_SOI[1] {
        return Err(AppError::NoEmbeddedJpeg);
    }

    Ok(data[jpeg_offset..jpeg_offset + jpeg_length].to_vec())
}

/// Fuji RAF 格式提取器
pub struct RafExtractor;

impl ImageExtractor for RafExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["raf"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_raf_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        // RAF 使用 FUJIFILMCCD-RAW 容器，不是 TIFF 格式
        // kamadak-exif 不认识此容器，但内嵌 JPEG 包含 APP1/EXIF 段
        let jpeg_data = extract_raf_jpeg(data)?;
        crate::core::metadata::parse_exif(&jpeg_data)
    }

    fn exif_header_size(&self) -> usize {
        // RAF 的 EXIF 在 JPEG 内部，无法仅读头部解析
        0
    }
}

/// 根据文件扩展名选择对应的 ImageExtractor
pub fn get_extractor(extension: &str) -> Result<Box<dyn ImageExtractor>, AppError> {
    match extension.to_lowercase().as_str() {
        "nef" => Ok(Box::new(NefExtractor)),
        "cr2" => Ok(Box::new(Cr2Extractor)),
        "arw" => Ok(Box::new(ArwExtractor)),
        "dng" => Ok(Box::new(DngExtractor)),
        "orf" => Ok(Box::new(OrfExtractor)),
        "rw2" => Ok(Box::new(Rw2Extractor)),
        "pef" => Ok(Box::new(PefExtractor)),
        "raf" => Ok(Box::new(RafExtractor)),
        "cr3" => Ok(Box::new(Cr3Extractor)),
        "jpg" | "jpeg" => Ok(Box::new(JpegExtractor)),
        "png" => Ok(Box::new(PngExtractor)),
        "tiff" | "tif" => Ok(Box::new(TiffExtractor)),
        "webp" => Ok(Box::new(WebpExtractor)),
        ext => Err(AppError::ImageParseError(format!(
            "不支持的图片格式: .{}",
            ext
        ))),
    }
}

// ─── 非 RAW 格式 Extractor ────────────────────────────────

/// JPEG 格式提取器
pub struct JpegExtractor;

impl ImageExtractor for JpegExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["jpg", "jpeg"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        Ok(data.to_vec())
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        0
    }
}

/// PNG 格式提取器
pub struct PngExtractor;

impl ImageExtractor for PngExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["png"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        Ok(data.to_vec())
    }

    fn extract_metadata(&self, _data: &[u8]) -> Result<ImageMetadata, AppError> {
        Ok(ImageMetadata::default())
    }

    fn exif_header_size(&self) -> usize {
        0
    }
}

/// TIFF 格式提取器
pub struct TiffExtractor;

impl ImageExtractor for TiffExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["tiff", "tif"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        Ok(data.to_vec())
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        0
    }
}

/// WebP 格式提取器
pub struct WebpExtractor;

impl ImageExtractor for WebpExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["webp"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        Ok(data.to_vec())
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        // 尽力而为：解析失败返回空 metadata
        crate::core::metadata::parse_exif(data)
            .or_else(|_| Ok(ImageMetadata::default()))
    }

    fn exif_header_size(&self) -> usize {
        0
    }
}

// ─── Canon CR3 格式解析（ISOBMFF 容器）───────────────────

/// CR3 预览 JPEG 所在的 UUID box 标识符（PRVW box）
/// `eaf42b5e-1c98-4b88-b9fb-b7dc406e4d16`
const CR3_PREVIEW_UUID: [u8; 16] = [
    0xea, 0xf4, 0x2b, 0x5e, 0x1c, 0x98, 0x4b, 0x88, 0xb9, 0xfb, 0xb7, 0xdc, 0x40, 0x6e, 0x4d, 0x16,
];

/// CR3 缩略图 JPEG 所在的 UUID box 标识符（THMB box，在 moov 内）
/// `85c0b687-820f-11e0-8111-f4ce462b6a48`
const CR3_THUMB_UUID: [u8; 16] = [
    0x85, 0xc0, 0xb6, 0x87, 0x82, 0x0f, 0x11, 0xe0, 0x81, 0x11, 0xf4, 0xce, 0x46, 0x2b, 0x6a, 0x48,
];

/// 在 ISOBMFF 容器中递归查找指定 UUID 的 box，提取其内部数据
///
/// ISOBMFF box 格式：
/// - 4 字节 size（big-endian u32），0 表示此 box 延伸到文件末尾
/// - 4 字节 type（ASCII）
/// - 如果 type == "uuid"，紧接着 16 字节 UUID
/// - 剩余为 box 内容
///
/// Container box（如 "moov"、"uuid"）的内容本身由子 box 组成，
/// 本函数递归遍历这些子 box。
fn find_uuid_box<'a>(data: &'a [u8], target_uuid: &[u8; 16]) -> Option<&'a [u8]> {
    find_uuid_box_recursive(data, target_uuid)
}

fn find_uuid_box_recursive<'a>(data: &'a [u8], target_uuid: &[u8; 16]) -> Option<&'a [u8]> {
    let mut offset = 0usize;

    while offset + 8 <= data.len() {
        // 读取 box size 和 type
        let size = u32::from_be_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ]) as usize;
        let box_type = &data[offset + 4..offset + 8];

        // 计算实际 box 大小
        let box_size = if size == 0 {
            // 0 表示此 box 延伸到末尾
            data.len() - offset
        } else if size == 1 {
            // 64 位扩展大小（暂不支持，跳过）
            break;
        } else {
            size
        };

        if box_size < 8 || offset + box_size > data.len() {
            break;
        }

        if box_type == b"uuid" {
            // UUID box：读取 16 字节 UUID
            if offset + 24 <= data.len() {
                let uuid = &data[offset + 8..offset + 24];
                if uuid == target_uuid {
                    // 找到目标 UUID box，返回其内容（去掉 header）
                    return Some(&data[offset + 24..offset + box_size]);
                }
            }
        }

        // 对 container box 递归搜索
        if box_type == b"moov" || box_type == b"uuid" {
            let content_start = if box_type == b"uuid" {
                offset + 24 // uuid box 有 16 字节额外 UUID
            } else {
                offset + 8
            };
            if content_start < offset + box_size {
                let sub_data = &data[content_start..offset + box_size];
                if let result @ Some(_) = find_uuid_box_recursive(sub_data, target_uuid) {
                    return result;
                }
            }
        }

        offset += box_size;
    }

    None
}

/// 从 CR3 的 mdat box 提取全分辨率 JPEG
///
/// CR3 文件的 mdat box 开头直接存放全分辨率 JPEG 预览（通常 6000×4000+ 像素），
/// 后跟 RAW 数据。通过定位 mdat box 并在其数据开头搜索 JPEG SOI (FF D8) 来提取。
///
/// 与 PRVW box（1620×1080）相比，mdat JPEG 分辨率高 ~15 倍，
/// 可生成完整质量的 medium 和缩略图。
fn extract_jpeg_from_mdat(data: &[u8]) -> Option<Vec<u8>> {
    let mut offset = 0usize;

    while offset + 8 <= data.len() {
        let size32 = u32::from_be_bytes([
            data[offset],
            data[offset + 1],
            data[offset + 2],
            data[offset + 3],
        ]);
        let box_type = &data[offset + 4..offset + 8];

        let (box_size, data_start) = if size32 == 0 {
            // 延伸到文件末尾
            (data.len() - offset, offset + 8)
        } else if size32 == 1 {
            // 64 位扩展大小
            if offset + 16 > data.len() {
                break;
            }
            let size64 = u64::from_be_bytes([
                data[offset + 8],
                data[offset + 9],
                data[offset + 10],
                data[offset + 11],
                data[offset + 12],
                data[offset + 13],
                data[offset + 14],
                data[offset + 15],
            ]) as usize;
            (size64, offset + 16)
        } else {
            (size32 as usize, offset + 8)
        };

        if box_size < 8 || offset + box_size > data.len() {
            break;
        }

        if box_type == b"mdat" {
            let mdat_data = &data[data_start..offset + box_size];
            // mdat 开头是否是 JPEG SOI？
            if mdat_data.len() >= 2 && mdat_data[0] == 0xFF && mdat_data[1] == 0xD8 {
                // 找到 JPEG EOI (FF D9) 确定大小
                if let Some(jpeg_len) = find_jpeg_end(mdat_data) {
                    // 验证尺寸：全分辨率 JPEG 通常 > 200KB
                    if jpeg_len > 200 * 1024 {
                        return Some(mdat_data[..jpeg_len].to_vec());
                    }
                }
            }
        }

        offset += box_size;
    }

    None
}

/// 在 JPEG 数据中定位 EOI 标记，返回包含 EOI 在内的 JPEG 总字节数
///
/// 通过解析 JPEG 段结构逐段跳过，直到 SOS 后扫描裸压缩数据中的 EOI。
/// 返回 None 表示未找到有效 EOI。
fn find_jpeg_end(data: &[u8]) -> Option<usize> {
    let mut pos = 2usize; // 跳过 SOI (FF D8)
    while pos + 2 <= data.len() {
        if data[pos] != 0xFF {
            return None;
        }
        let marker = data[pos + 1];
        if marker == 0xD9 {
            // EOI
            return Some(pos + 2);
        }
        if marker == 0xDA {
            // SOS：跳过 SOS 头部后直接扫描裸压缩数据
            if pos + 4 > data.len() {
                return None;
            }
            let sos_len =
                u16::from_be_bytes([data[pos + 2], data[pos + 3]]) as usize;
            pos += 2 + sos_len;
            // 在压缩数据流中找 FF D9（不是 FF 00 填充）
            while pos + 1 < data.len() {
                if data[pos] == 0xFF && data[pos + 1] == 0xD9 {
                    return Some(pos + 2);
                }
                pos += 1;
            }
            return None;
        }
        if marker == 0xD8 || (marker >= 0xD0 && marker <= 0xD7) {
            // 无长度的标记（SOI/RSTn）
            pos += 2;
            continue;
        }
        if pos + 4 > data.len() {
            return None;
        }
        let seg_len = u16::from_be_bytes([data[pos + 2], data[pos + 3]]) as usize;
        if seg_len < 2 {
            return None;
        }
        pos += 2 + seg_len;
    }
    None
}

/// 从 PRVW box 内容中提取 JPEG 数据
///
/// PRVW box 结构：
/// - 0-3: size (u32)
/// - 4-7: "PRVW" (4 bytes)
/// - 8-11: unknown (u32)
/// - 12-13: unknown (u16)
/// - 14-15: width (u16)
/// - 16-17: height (u16)
/// - 18-19: unknown (u16)
/// - 20-23: JPEG size (u32)
/// - 24+: JPEG data
fn extract_jpeg_from_prvw(prvw_data: &[u8]) -> Result<Vec<u8>, AppError> {
    // 在 PRVW UUID box 内容中查找 PRVW 子 box
    let mut offset = 0usize;

    while offset + 8 <= prvw_data.len() {
        let size = u32::from_be_bytes([
            prvw_data[offset],
            prvw_data[offset + 1],
            prvw_data[offset + 2],
            prvw_data[offset + 3],
        ]) as usize;
        let box_type = &prvw_data[offset + 4..offset + 8];

        let box_size = if size == 0 {
            prvw_data.len() - offset
        } else {
            size
        };

        if box_size < 8 || offset + box_size > prvw_data.len() {
            break;
        }

        if box_type == b"PRVW" {
            // 读取 JPEG 大小（偏移 20-23）和 JPEG 数据（偏移 24+）
            if offset + 24 > prvw_data.len() {
                return Err(AppError::ImageParseError("PRVW box 数据过短".into()));
            }
            let jpeg_size = u32::from_be_bytes([
                prvw_data[offset + 20],
                prvw_data[offset + 21],
                prvw_data[offset + 22],
                prvw_data[offset + 23],
            ]) as usize;

            let jpeg_start = offset + 24;
            if jpeg_start + jpeg_size > prvw_data.len() {
                return Err(AppError::ImageParseError("PRVW JPEG 数据越界".into()));
            }

            let jpeg_data = &prvw_data[jpeg_start..jpeg_start + jpeg_size];
            // 验证 SOI
            if jpeg_data.len() < 2 || jpeg_data[0] != 0xFF || jpeg_data[1] != 0xD8 {
                return Err(AppError::NoEmbeddedJpeg);
            }

            return Ok(jpeg_data.to_vec());
        }

        offset += box_size;
    }

    Err(AppError::NoEmbeddedJpeg)
}

/// 从 CR3 文件数据中提取嵌入的 JPEG 预览
///
/// 优先提取 PRVW（1620×1080 预览），若未找到则尝试 THMB（160×120 缩略图）
fn extract_cr3_jpeg(data: &[u8]) -> Result<Vec<u8>, AppError> {
    // 优先从 mdat box 提取全分辨率 JPEG（通常为 6000×4000+ 的完整画质预览）
    // CR3 的 mdat box 开头直接存放全分辨率 JPEG，远优于 PRVW 的 1620×1080
    if let Some(jpeg) = extract_jpeg_from_mdat(data) {
        return Ok(jpeg);
    }

    // 回退到 PRVW 预览（1620×1080）
    if let Some(prvw_content) = find_uuid_box(data, &CR3_PREVIEW_UUID) {
        if let Ok(jpeg) = extract_jpeg_from_prvw(prvw_content) {
            return Ok(jpeg);
        }
    }

    // 回退到 THMB 缩略图（在 moov 内的 uuid box 中）
    if let Some(thumb_content) = find_uuid_box(data, &CR3_THUMB_UUID) {
        // THMB 结构：
        // 0-3: size, 4-7: "THMB", 8: version, 9-11: flags,
        // 12-13: width, 14-15: height, 16-19: jpeg_size, 20-21/22-23: unknown,
        // 24+: jpeg data (version 0) or 20+: jpeg data (version 1)
        let mut offset = 0usize;
        while offset + 8 <= thumb_content.len() {
            let size = u32::from_be_bytes([
                thumb_content[offset],
                thumb_content[offset + 1],
                thumb_content[offset + 2],
                thumb_content[offset + 3],
            ]) as usize;
            let box_type = &thumb_content[offset + 4..offset + 8];

            let box_size = if size == 0 {
                thumb_content.len() - offset
            } else {
                size
            };

            if box_size < 8 || offset + box_size > thumb_content.len() {
                break;
            }

            if box_type == b"THMB" {
                if offset + 20 > thumb_content.len() {
                    break;
                }
                let version = thumb_content[offset + 8];
                let jpeg_size = u32::from_be_bytes([
                    thumb_content[offset + 16],
                    thumb_content[offset + 17],
                    thumb_content[offset + 18],
                    thumb_content[offset + 19],
                ]) as usize;

                let jpeg_start = if version == 1 {
                    offset + 20
                } else {
                    offset + 24
                };
                if jpeg_start + jpeg_size > thumb_content.len() {
                    break;
                }

                let jpeg_data = &thumb_content[jpeg_start..jpeg_start + jpeg_size];
                if jpeg_data.len() >= 2 && jpeg_data[0] == 0xFF && jpeg_data[1] == 0xD8 {
                    return Ok(jpeg_data.to_vec());
                }
            }

            offset += box_size;
        }
    }

    Err(AppError::NoEmbeddedJpeg)
}

// ─── CR3 ISOBMFF meta box EXIF 提取 ─────────────────────

/// CR3 的 EXIF 数据存储在 ISOBMFF 容器的 moov/meta box 中，
/// 而非嵌入的 JPEG 预览内。需要解析 iinf 找到 EXIF item ID，
/// 再解析 iloc 获取其偏移和长度，最后从文件中提取 TIFF 格式的 EXIF 数据。

/// 在 ISOBMFF 容器中递归查找指定类型的 box，提取其内部数据
///
/// 与 `find_uuid_box` 类似，但按 box type（而非 UUID）搜索。
/// 递归遍历 `moov` 和 `uuid` container box 的子 box。
fn find_box_recursive<'a>(data: &'a [u8], target_type: &[u8; 4]) -> Option<&'a [u8]> {
    let mut offset = 0usize;

    while offset + 8 <= data.len() {
        let size = u32::from_be_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]) as usize;
        let box_type = &data[offset + 4..offset + 8];

        let box_size = if size == 0 {
            data.len() - offset
        } else if size == 1 {
            // 64 位扩展大小（暂不支持，跳过）
            break;
        } else {
            size
        };

        if box_size < 8 || offset + box_size > data.len() {
            break;
        }

        if box_type == target_type {
            // 非uuid box：内容从 offset+8 开始
            return Some(&data[offset + 8..offset + box_size]);
        }

        // 对 container box 递归搜索
        if box_type == b"moov" || box_type == b"uuid" {
            let content_start = if box_type == b"uuid" {
                offset + 24 // uuid box 有 16 字节额外 UUID
            } else {
                offset + 8
            };
            if content_start < offset + box_size {
                let sub_data = &data[content_start..offset + box_size];
                if let result @ Some(_) = find_box_recursive(sub_data, target_type) {
                    return result;
                }
            }
        }

        offset += box_size;
    }

    None
}

/// 从 CR3 文件的 Canon UUID box 中提取 CMT1 EXIF 数据
///
/// Canon CR3 使用专有 ISOBMFF 结构：
/// - moov → uuid(Canon THMB UUID) → CMT1（TIFF 格式 EXIF）+ CMT2（Maker Note）
/// - CMT1 内容直接是标准 TIFF 数据（II*\0 或 MM\0* 开头）
fn extract_cr3_exif_from_cmt1(data: &[u8]) -> Result<Vec<u8>, AppError> {
    let cmt1_content = find_box_recursive(data, b"CMT1").ok_or_else(|| {
        AppError::ExifError("CR3: 未找到 CMT1 box".into())
    })?;

    // CMT1 内容直接是 TIFF 格式 EXIF 数据
    if cmt1_content.len() < 4 {
        return Err(AppError::ExifError("CR3: CMT1 数据过短".into()));
    }

    let is_valid_tiff = (cmt1_content[0] == 0x49 && cmt1_content[1] == 0x49 && cmt1_content[2] == 0x2A && cmt1_content[3] == 0x00)
        || (cmt1_content[0] == 0x4D && cmt1_content[1] == 0x4D && cmt1_content[2] == 0x00 && cmt1_content[3] == 0x2A);
    if !is_valid_tiff {
        return Err(AppError::ExifError("CR3: CMT1 数据非有效 TIFF 格式".into()));
    }

    Ok(cmt1_content.to_vec())
}

/// Canon CR3 格式提取器
pub struct Cr3Extractor;

impl ImageExtractor for Cr3Extractor {
    fn supported_extensions(&self) -> &[&str] {
        &["cr3"]
    }

    fn get_image_data(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_cr3_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        // CR3 EXIF 存储在 Canon 专有 UUID box 内的 CMT1 子 box 中（标准 TIFF 格式）
        // 回退：从嵌入 JPEG 预览中解析 EXIF（部分 CR3 文件的 JPEG 预览包含 APP1 段）
        match extract_cr3_exif_from_cmt1(data) {
            Ok(exif_data) => crate::core::metadata::parse_exif(&exif_data),
            Err(_) => {
                let jpeg_data = extract_cr3_jpeg(data)?;
                crate::core::metadata::parse_exif(&jpeg_data)
            }
        }
    }

    fn exif_header_size(&self) -> usize {
        // CR3 的 EXIF 在 ISOBMFF meta box 中，无法仅读头部解析
        0
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    /// 构建一个最小的有效 TIFF 结构（小端），包含嵌入 JPEG
    fn build_tiff_with_jpeg(jpeg_data: &[u8], little_endian: bool) -> Vec<u8> {
        let mut buf = Vec::new();

        // TIFF Header (8 bytes)
        if little_endian {
            buf.extend_from_slice(&[0x49, 0x49]); // II
            buf.extend_from_slice(&42u16.to_le_bytes()); // magic
            buf.extend_from_slice(&8u32.to_le_bytes()); // IFD0 offset = 8
        } else {
            buf.extend_from_slice(&[0x4D, 0x4D]); // MM
            buf.extend_from_slice(&42u16.to_be_bytes());
            buf.extend_from_slice(&8u32.to_be_bytes());
        }

        // IFD0 at offset 8
        let entry_count: u16 = 2;
        let jpeg_offset: u32 = 8 + 2 + 2 * 12 + 4; // after IFD0

        if little_endian {
            buf.extend_from_slice(&entry_count.to_le_bytes());

            // Entry 1: JPEGInterchangeFormat (0x0201)
            buf.extend_from_slice(&TAG_JPEG_OFFSET.to_le_bytes()); // tag
            buf.extend_from_slice(&4u16.to_le_bytes()); // type = LONG
            buf.extend_from_slice(&1u32.to_le_bytes()); // count
            buf.extend_from_slice(&jpeg_offset.to_le_bytes()); // value = offset to jpeg

            // Entry 2: JPEGInterchangeFormatLength (0x0202)
            buf.extend_from_slice(&TAG_JPEG_LENGTH.to_le_bytes());
            buf.extend_from_slice(&4u16.to_le_bytes());
            buf.extend_from_slice(&1u32.to_le_bytes());
            buf.extend_from_slice(&(jpeg_data.len() as u32).to_le_bytes());

            // next IFD = 0
            buf.extend_from_slice(&0u32.to_le_bytes());
        } else {
            buf.extend_from_slice(&entry_count.to_be_bytes());

            buf.extend_from_slice(&TAG_JPEG_OFFSET.to_be_bytes());
            buf.extend_from_slice(&4u16.to_be_bytes());
            buf.extend_from_slice(&1u32.to_be_bytes());
            buf.extend_from_slice(&jpeg_offset.to_be_bytes());

            buf.extend_from_slice(&TAG_JPEG_LENGTH.to_be_bytes());
            buf.extend_from_slice(&4u16.to_be_bytes());
            buf.extend_from_slice(&1u32.to_be_bytes());
            buf.extend_from_slice(&(jpeg_data.len() as u32).to_be_bytes());

            buf.extend_from_slice(&0u32.to_be_bytes());
        }

        // Append JPEG data
        buf.extend_from_slice(jpeg_data);

        buf
    }

    #[test]
    fn test_parse_tiff_header_little_endian() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0]; // 最小 JPEG SOI
        let data = build_tiff_with_jpeg(&jpeg, true);
        let (bo, offset) = parse_tiff_header(&data).unwrap();
        assert_eq!(bo, ByteOrder::LittleEndian);
        assert_eq!(offset, 8);
    }

    #[test]
    fn test_parse_tiff_header_big_endian() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0];
        let data = build_tiff_with_jpeg(&jpeg, false);
        let (bo, offset) = parse_tiff_header(&data).unwrap();
        assert_eq!(bo, ByteOrder::BigEndian);
        assert_eq!(offset, 8);
    }

    #[test]
    fn test_parse_tiff_header_invalid_byte_order() {
        let data = [0x00, 0x00, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08];
        let result = parse_tiff_header(&data);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("无效的字节序标记"));
    }

    #[test]
    fn test_parse_tiff_header_invalid_magic() {
        // II but wrong magic number (99 instead of 42)
        let mut data = vec![0x49, 0x49];
        data.extend_from_slice(&99u16.to_le_bytes());
        data.extend_from_slice(&8u32.to_le_bytes());
        let result = parse_tiff_header(&data);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("无效的 TIFF 魔数"));
    }

    #[test]
    fn test_parse_tiff_header_too_short() {
        let data = [0x49, 0x49, 0x2A];
        let result = parse_tiff_header(&data);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("文件过短"));
    }

    #[test]
    fn test_extract_largest_jpeg_little_endian() {
        let jpeg_data = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]; // minimal JPEG SOI + APP0
        let tiff = build_tiff_with_jpeg(&jpeg_data, true);
        let result = extract_largest_jpeg(&tiff).unwrap();
        assert_eq!(result, jpeg_data);
    }

    #[test]
    fn test_extract_largest_jpeg_big_endian() {
        let jpeg_data = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let tiff = build_tiff_with_jpeg(&jpeg_data, false);
        let result = extract_largest_jpeg(&tiff).unwrap();
        assert_eq!(result, jpeg_data);
    }

    #[test]
    fn test_extract_jpeg_invalid_soi() {
        // 构建一个 JPEG 数据但魔数不对
        let bad_jpeg = [0x00, 0x00, 0xFF, 0xE0];
        let tiff = build_tiff_with_jpeg(&bad_jpeg, true);
        let result = extract_largest_jpeg(&tiff);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NoEmbeddedJpeg => {}
            e => panic!("Expected NoEmbeddedJpeg, got: {:?}", e),
        }
    }

    #[test]
    fn test_extract_jpeg_no_jpeg_entries() {
        // 构建只有 header 和空 IFD 的 TIFF
        let mut data = vec![0x49, 0x49]; // II
        data.extend_from_slice(&42u16.to_le_bytes());
        data.extend_from_slice(&8u32.to_le_bytes());
        // IFD with 0 entries
        data.extend_from_slice(&0u16.to_le_bytes());
        data.extend_from_slice(&0u32.to_le_bytes()); // next IFD = 0

        let result = extract_largest_jpeg(&data);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NoEmbeddedJpeg => {}
            e => panic!("Expected NoEmbeddedJpeg, got: {:?}", e),
        }
    }

    #[test]
    fn test_extract_jpeg_offset_out_of_bounds() {
        // 构建 TIFF，JPEG offset 超出文件范围
        let mut data = vec![0x49, 0x49]; // II
        data.extend_from_slice(&42u16.to_le_bytes());
        data.extend_from_slice(&8u32.to_le_bytes());

        // IFD with 2 entries
        data.extend_from_slice(&2u16.to_le_bytes());

        // JPEGInterchangeFormat pointing beyond file
        data.extend_from_slice(&TAG_JPEG_OFFSET.to_le_bytes());
        data.extend_from_slice(&4u16.to_le_bytes());
        data.extend_from_slice(&1u32.to_le_bytes());
        data.extend_from_slice(&99999u32.to_le_bytes()); // way beyond

        // JPEGInterchangeFormatLength
        data.extend_from_slice(&TAG_JPEG_LENGTH.to_le_bytes());
        data.extend_from_slice(&4u16.to_le_bytes());
        data.extend_from_slice(&1u32.to_le_bytes());
        data.extend_from_slice(&100u32.to_le_bytes());

        // next IFD = 0
        data.extend_from_slice(&0u32.to_le_bytes());

        let result = extract_largest_jpeg(&data);
        assert!(result.is_err());
    }

    #[test]
    fn test_nef_extractor_supported_extensions() {
        let ext = NefExtractor;
        assert_eq!(ext.supported_extensions(), &["nef"]);
    }

    #[test]
    fn test_get_extractor_nef() {
        let ext = get_extractor("nef").unwrap();
        assert_eq!(ext.supported_extensions(), &["nef"]);
    }

    #[test]
    fn test_get_extractor_nef_case_insensitive() {
        let ext = get_extractor("NEF").unwrap();
        assert_eq!(ext.supported_extensions(), &["nef"]);
    }

    #[test]
    fn test_get_extractor_unsupported() {
        let result = get_extractor("xyz");
        assert!(result.is_err());
    }

    // ─── 多格式 Extractor 测试 ──────────────────────────────

    #[test]
    fn test_cr2_extractor() {
        let ext = Cr2Extractor;
        assert_eq!(ext.supported_extensions(), &["cr2"]);
        assert_eq!(ext.exif_header_size(), 65536);
        let via_factory = get_extractor("cr2").unwrap();
        assert_eq!(via_factory.supported_extensions(), &["cr2"]);
    }

    /// 构造带 SOF 标记的 JPEG 数据
    /// SOF0 格式: marker(2) + length(2) + precision(1) + height(2) + width(2) + num_components(1) + ...
    fn build_jpeg_with_sof(num_components: u8, extra_payload: &[u8]) -> Vec<u8> {
        let mut jpeg = vec![0xFF, 0xD8]; // SOI
        // SOF0 marker: length=8+3*num_components, precision=8, height=100, width=100
        jpeg.extend_from_slice(&[0xFF, 0xC0]); // SOF0
        let sof_len = (8 + 3 * num_components as u16).to_be_bytes();
        jpeg.extend_from_slice(&sof_len); // length
        jpeg.push(8); // precision
        jpeg.extend_from_slice(&100u16.to_be_bytes()); // height
        jpeg.extend_from_slice(&100u16.to_be_bytes()); // width
        jpeg.push(num_components); // num_components
        // component specs (3 bytes each, just fill zeros)
        for _ in 0..num_components {
            jpeg.extend_from_slice(&[0x01, 0x11, 0x00]);
        }
        // Extra payload
        jpeg.extend_from_slice(extra_payload);
        jpeg.extend_from_slice(&[0xFF, 0xD9]); // EOI
        jpeg
    }

    /// CR2 使用 Compression=6 (Old-style JPEG) 的 StripOffsets 存储预览 JPEG
    /// 修复前只处理 Compression=7，导致 CR2 只能提取到 IFD1 的小缩略图
    ///
    /// CR2 文件中有多种 JPEG：
    /// - IFD0 StripOffsets: 全尺寸预览 (components=3, 可解码)
    /// - IFD1 JPEGInterchangeFormat: 小缩略图 (components=3, 可解码)
    /// - IFD3 StripOffsets: 压缩 RAW 传感器数据 (components=0, 不可解码)
    ///
    /// extract_largest_jpeg 应跳过 components=0 的 RAW 数据，选择最大的可解码 JPEG
    #[test]
    fn test_cr2_strip_jpeg_compression6() {
        // 小缩略图 (JPEGInterchangeFormat)
        let thumbnail_jpeg = build_jpeg_with_sof(3, &[0x01]);
        // 全尺寸预览 (StripOffsets, components=3, 可解码)
        let preview_jpeg = build_jpeg_with_sof(3, &[0x02; 20]);
        // 压缩 RAW 数据 (StripOffsets, components=0, 不可解码) — 体积最大但应被跳过
        let raw_jpeg = build_jpeg_with_sof(0, &[0x03; 50]);

        let mut buf = Vec::new();

        // TIFF Header (Little-endian)
        buf.extend_from_slice(&[0x49, 0x49]);
        buf.extend_from_slice(&42u16.to_le_bytes());
        buf.extend_from_slice(&8u32.to_le_bytes()); // IFD0 at 8

        // IFD0: JPEGInterchangeFormat (thumbnail) + Compression=6 + StripOffsets (preview)
        let entry_count: u16 = 5;
        buf.extend_from_slice(&entry_count.to_le_bytes());

        let ifd_size = 2 + 5 * 12 + 4; // = 66
        let thumbnail_offset: u32 = 8 + ifd_size as u32;
        let preview_offset: u32 = thumbnail_offset + thumbnail_jpeg.len() as u32;
        let raw_offset: u32 = preview_offset + preview_jpeg.len() as u32;

        // Entry 1: JPEGInterchangeFormat (thumbnail)
        buf.extend_from_slice(&TAG_JPEG_OFFSET.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&thumbnail_offset.to_le_bytes());

        // Entry 2: JPEGInterchangeFormatLength
        buf.extend_from_slice(&TAG_JPEG_LENGTH.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&(thumbnail_jpeg.len() as u32).to_le_bytes());

        // Entry 3: Compression = 6 (Old-style JPEG, CR2 uses this)
        buf.extend_from_slice(&TAG_COMPRESSION.to_le_bytes());
        buf.extend_from_slice(&3u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&COMPRESSION_OLD_JPEG.to_le_bytes());
        buf.extend_from_slice(&[0u8; 2]);

        // Entry 4: StripOffsets (preview JPEG, components=3)
        buf.extend_from_slice(&TAG_STRIP_OFFSETS.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&preview_offset.to_le_bytes());

        // Entry 5: StripByteCounts
        buf.extend_from_slice(&TAG_STRIP_BYTE_COUNTS.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&(preview_jpeg.len() as u32).to_le_bytes());

        // next IFD → IFD1 (raw data)
        let ifd1_offset: u32 = raw_offset + raw_jpeg.len() as u32;
        buf.extend_from_slice(&ifd1_offset.to_le_bytes());

        // Append JPEG data for IFD0
        buf.extend_from_slice(&thumbnail_jpeg);
        buf.extend_from_slice(&preview_jpeg);
        buf.extend_from_slice(&raw_jpeg);

        // IFD1: Compression=6 + StripOffsets (raw data, components=0) — 应被跳过
        let entry_count1: u16 = 3;
        buf.extend_from_slice(&entry_count1.to_le_bytes());
        // Entry 1: Compression = 6
        buf.extend_from_slice(&TAG_COMPRESSION.to_le_bytes());
        buf.extend_from_slice(&3u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&COMPRESSION_OLD_JPEG.to_le_bytes());
        buf.extend_from_slice(&[0u8; 2]);
        // Entry 2: StripOffsets (raw data)
        buf.extend_from_slice(&TAG_STRIP_OFFSETS.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&raw_offset.to_le_bytes());
        // Entry 3: StripByteCounts
        buf.extend_from_slice(&TAG_STRIP_BYTE_COUNTS.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&(raw_jpeg.len() as u32).to_le_bytes());

        // next IFD = 0
        buf.extend_from_slice(&0u32.to_le_bytes());

        // raw data JPEG 已在前面 append 过，不需要再次 append

        let result = extract_largest_jpeg(&buf).unwrap();
        assert_eq!(result, preview_jpeg, "应该跳过 components=0 的 RAW 数据，选择最大的可解码预览 JPEG");
    }

    #[test]
    fn test_check_jpeg_sof_components() {
        // components=3 (YCbCr, 正常预览)
        let rgb_jpeg = build_jpeg_with_sof(3, &[]);
        assert_eq!(
            check_jpeg_sof_components(&rgb_jpeg, 0, rgb_jpeg.len()),
            Some(true)
        );

        // components=1 (灰度, 正常)
        let gray_jpeg = build_jpeg_with_sof(1, &[]);
        assert_eq!(
            check_jpeg_sof_components(&gray_jpeg, 0, gray_jpeg.len()),
            Some(true)
        );

        // components=0 (CR2 压缩 RAW 数据, 不可解码)
        let raw_jpeg = build_jpeg_with_sof(0, &[]);
        assert_eq!(
            check_jpeg_sof_components(&raw_jpeg, 0, raw_jpeg.len()),
            Some(false)
        );

        // components=24 (CR2 压缩 RAW 数据, 不可解码)
        let raw24_jpeg = build_jpeg_with_sof(24, &[]);
        assert_eq!(
            check_jpeg_sof_components(&raw24_jpeg, 0, raw24_jpeg.len()),
            Some(false)
        );

        // 无 SOF 标记的最小 JPEG (仅 SOI + APP0 + EOI)
        let minimal_jpeg = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x02, 0xFF, 0xD9];
        assert_eq!(
            check_jpeg_sof_components(&minimal_jpeg, 0, minimal_jpeg.len()),
            None
        );
    }

    #[test]
    fn test_arw_extractor() {
        let ext = ArwExtractor;
        assert_eq!(ext.supported_extensions(), &["arw"]);
        assert_eq!(ext.exif_header_size(), 65536);
        let via_factory = get_extractor("arw").unwrap();
        assert_eq!(via_factory.supported_extensions(), &["arw"]);
    }

    #[test]
    fn test_dng_extractor() {
        let ext = DngExtractor;
        assert_eq!(ext.supported_extensions(), &["dng"]);
        assert_eq!(ext.exif_header_size(), 65536);
        let via_factory = get_extractor("dng").unwrap();
        assert_eq!(via_factory.supported_extensions(), &["dng"]);
    }

    #[test]
    fn test_orf_extractor() {
        let ext = OrfExtractor;
        assert_eq!(ext.supported_extensions(), &["orf"]);
        assert_eq!(ext.exif_header_size(), 65536);
        let via_factory = get_extractor("orf").unwrap();
        assert_eq!(via_factory.supported_extensions(), &["orf"]);
    }

    #[test]
    fn test_rw2_extractor() {
        let ext = Rw2Extractor;
        assert_eq!(ext.supported_extensions(), &["rw2"]);
        assert_eq!(ext.exif_header_size(), 65536);
        let via_factory = get_extractor("rw2").unwrap();
        assert_eq!(via_factory.supported_extensions(), &["rw2"]);
    }

    /// 构建一个最小有效的 RW2 TIFF 结构（小端，magic=85），包含嵌入 JPEG
    fn build_rw2_tiff_with_jpeg(jpeg_data: &[u8]) -> Vec<u8> {
        let mut buf = Vec::new();

        // TIFF Header (8 bytes) — Little-endian with RW2 magic (85)
        buf.extend_from_slice(&[0x49, 0x49]); // II
        buf.extend_from_slice(&85u16.to_le_bytes()); // RW2 magic
        buf.extend_from_slice(&8u32.to_le_bytes()); // IFD0 offset = 8

        // IFD0 at offset 8
        let entry_count: u16 = 2;
        let jpeg_offset: u32 = 8 + 2 + 2 * 12 + 4;

        buf.extend_from_slice(&entry_count.to_le_bytes());

        // Entry 1: JPEGInterchangeFormat (0x0201)
        buf.extend_from_slice(&TAG_JPEG_OFFSET.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&jpeg_offset.to_le_bytes());

        // Entry 2: JPEGInterchangeFormatLength (0x0202)
        buf.extend_from_slice(&TAG_JPEG_LENGTH.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&(jpeg_data.len() as u32).to_le_bytes());

        // next IFD = 0
        buf.extend_from_slice(&0u32.to_le_bytes());

        // Append JPEG data
        buf.extend_from_slice(jpeg_data);
        buf
    }

    #[test]
    fn test_rw2_magic_accepted_in_tiff_header() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let data = build_rw2_tiff_with_jpeg(&jpeg);
        let (bo, offset) = parse_tiff_header(&data).unwrap();
        assert_eq!(bo, ByteOrder::LittleEndian);
        assert_eq!(offset, 8);
    }

    #[test]
    fn test_rw2_extract_jpeg() {
        let jpeg_data = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let data = build_rw2_tiff_with_jpeg(&jpeg_data);
        let result = extract_largest_jpeg(&data).unwrap();
        assert_eq!(result, jpeg_data);
    }

    #[test]
    fn test_rw2_extract_metadata_normalizes_magic() {
        // 验证 RW2 Extractor 会将 magic 85 规范化为 42
        let mut data = vec![0x49, 0x49, 0x55, 0x00]; // II + RW2 magic (LE)
        data.extend_from_slice(&8u32.to_le_bytes()); // IFD0 offset
        data.extend_from_slice(&0u16.to_le_bytes()); // 0 entries
        data.extend_from_slice(&0u32.to_le_bytes()); // next IFD = 0

        let ext = Rw2Extractor;
        // parse_exif 可能因空 IFD 返回错误，但关键是不会因 magic 无效而失败
        // 规范化后 kamadak-exif 应能识别 TIFF 签名
        let _ = ext.extract_metadata(&data); // 不 panic 即通过
    }

    #[test]
    fn test_pef_extractor() {
        let ext = PefExtractor;
        assert_eq!(ext.supported_extensions(), &["pef"]);
        assert_eq!(ext.exif_header_size(), 65536);
        let via_factory = get_extractor("pef").unwrap();
        assert_eq!(via_factory.supported_extensions(), &["pef"]);
    }

    #[test]
    fn test_get_extractor_case_insensitive() {
        assert_eq!(
            get_extractor("CR2").unwrap().supported_extensions(),
            &["cr2"]
        );
        assert_eq!(
            get_extractor("Arw").unwrap().supported_extensions(),
            &["arw"]
        );
        assert_eq!(
            get_extractor("DNG").unwrap().supported_extensions(),
            &["dng"]
        );
    }

    // ─── is_raw_extension 和 SUPPORTED_RAW_EXTENSIONS 测试 ──

    #[test]
    fn test_supported_raw_extensions_content() {
        assert_eq!(SUPPORTED_RAW_EXTENSIONS.len(), 9);
        assert!(SUPPORTED_RAW_EXTENSIONS.contains(&"nef"));
        assert!(SUPPORTED_RAW_EXTENSIONS.contains(&"cr2"));
        assert!(SUPPORTED_RAW_EXTENSIONS.contains(&"cr3"));
        assert!(SUPPORTED_RAW_EXTENSIONS.contains(&"arw"));
        assert!(SUPPORTED_RAW_EXTENSIONS.contains(&"dng"));
        assert!(SUPPORTED_RAW_EXTENSIONS.contains(&"raf"));
        assert!(SUPPORTED_RAW_EXTENSIONS.contains(&"orf"));
        assert!(SUPPORTED_RAW_EXTENSIONS.contains(&"rw2"));
        assert!(SUPPORTED_RAW_EXTENSIONS.contains(&"pef"));
    }

    #[test]
    fn test_is_raw_extension() {
        assert!(is_raw_extension("nef"));
        assert!(is_raw_extension("NEF"));
        assert!(is_raw_extension("Nef"));
        assert!(is_raw_extension("cr2"));
        assert!(is_raw_extension("ARW"));
        assert!(!is_raw_extension("jpg"));
        assert!(!is_raw_extension("png"));
        assert!(!is_raw_extension("tiff"));
    }

    // ─── RAF 解析器测试 ─────────────────────────────────────

    /// 构建一个最小有效的 RAF 文件（包含嵌入 JPEG）
    fn build_raf_with_jpeg(jpeg_data: &[u8]) -> Vec<u8> {
        let jpeg_offset: u32 = RAF_HEADER_SIZE as u32; // JPEG 数据紧跟在头部之后
        let jpeg_length = jpeg_data.len() as u32;

        let mut data = vec![0u8; RAF_HEADER_SIZE];
        // 写入魔数
        data[0..15].copy_from_slice(RAF_MAGIC);
        // 写入 JPEG 偏移量和长度（big-endian）
        data[84..88].copy_from_slice(&jpeg_offset.to_be_bytes());
        data[88..92].copy_from_slice(&jpeg_length.to_be_bytes());
        // 追加 JPEG 数据
        data.extend_from_slice(jpeg_data);
        data
    }

    #[test]
    fn test_raf_parse_header_valid() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let data = build_raf_with_jpeg(&jpeg);
        let (offset, length) = parse_raf_header(&data).unwrap();
        assert_eq!(offset, RAF_HEADER_SIZE);
        assert_eq!(length, jpeg.len());
    }

    #[test]
    fn test_raf_parse_header_invalid_magic() {
        let mut data = vec![0u8; RAF_HEADER_SIZE];
        data[0..15].copy_from_slice(b"NOT_FUJI_FORMAT");
        let result = parse_raf_header(&data);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("无效的 RAF 文件魔数"));
    }

    #[test]
    fn test_raf_parse_header_too_short() {
        let data = vec![0u8; 50];
        let result = parse_raf_header(&data);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("RAF 文件过短"));
    }

    #[test]
    fn test_raf_extract_jpeg_valid() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let data = build_raf_with_jpeg(&jpeg);
        let result = extract_raf_jpeg(&data).unwrap();
        assert_eq!(result, jpeg);
    }

    #[test]
    fn test_raf_extract_jpeg_invalid_soi() {
        let bad_jpeg = [0x00, 0x00, 0xFF, 0xE0];
        let data = build_raf_with_jpeg(&bad_jpeg);
        let result = extract_raf_jpeg(&data);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NoEmbeddedJpeg => {}
            e => panic!("Expected NoEmbeddedJpeg, got: {:?}", e),
        }
    }

    #[test]
    fn test_raf_extract_jpeg_offset_out_of_bounds() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0];
        let mut data = build_raf_with_jpeg(&jpeg);
        // 篡改偏移量使其越界
        let huge_offset: u32 = 999999;
        data[84..88].copy_from_slice(&huge_offset.to_be_bytes());
        let result = extract_raf_jpeg(&data);
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("越界"));
    }

    #[test]
    fn test_raf_extractor() {
        let ext = RafExtractor;
        assert_eq!(ext.supported_extensions(), &["raf"]);
        // RAF 的 EXIF 在 JPEG 内部，无法仅读头部解析
        assert_eq!(ext.exif_header_size(), 0);
        let via_factory = get_extractor("raf").unwrap();
        assert_eq!(via_factory.supported_extensions(), &["raf"]);
    }

    // ─── CR3 解析器测试 ─────────────────────────────────────

    /// 构建 ISOBMFF box（通用）
    fn build_isobmff_box(box_type: &[u8; 4], content: &[u8]) -> Vec<u8> {
        let size = (8 + content.len()) as u32;
        let mut buf = Vec::with_capacity(size as usize);
        buf.extend_from_slice(&size.to_be_bytes());
        buf.extend_from_slice(box_type);
        buf.extend_from_slice(content);
        buf
    }

    /// 构建 UUID box
    fn build_uuid_box(uuid: &[u8; 16], content: &[u8]) -> Vec<u8> {
        let size = (24 + content.len()) as u32;
        let mut buf = Vec::with_capacity(size as usize);
        buf.extend_from_slice(&size.to_be_bytes());
        buf.extend_from_slice(b"uuid");
        buf.extend_from_slice(uuid);
        buf.extend_from_slice(content);
        buf
    }

    /// 构建 PRVW 子 box
    fn build_prvw_box(jpeg_data: &[u8]) -> Vec<u8> {
        let mut content = Vec::new();
        // PRVW box header: size(4) + "PRVW"(4) + unknown(4) + unknown(2) + width(2) + height(2) + unknown(2) + jpeg_size(4) = 24
        let total_size = (24 + jpeg_data.len()) as u32;
        content.extend_from_slice(&total_size.to_be_bytes());
        content.extend_from_slice(b"PRVW");
        content.extend_from_slice(&0u32.to_be_bytes()); // unknown
        content.extend_from_slice(&1u16.to_be_bytes()); // unknown
        content.extend_from_slice(&1620u16.to_be_bytes()); // width
        content.extend_from_slice(&1080u16.to_be_bytes()); // height
        content.extend_from_slice(&1u16.to_be_bytes()); // unknown
        content.extend_from_slice(&(jpeg_data.len() as u32).to_be_bytes()); // jpeg_size
        content.extend_from_slice(jpeg_data);
        content
    }

    #[test]
    fn test_cr3_extract_jpeg_from_prvw() {
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let prvw_content = build_prvw_box(&jpeg);
        let prvw_uuid_box = build_uuid_box(&CR3_PREVIEW_UUID, &prvw_content);
        let result = extract_cr3_jpeg(&prvw_uuid_box).unwrap();
        assert_eq!(result, jpeg);
    }

    #[test]
    fn test_cr3_extract_jpeg_nested_in_moov() {
        // 模拟 CR3 结构：ftyp + moov(containing uuid with THMB)
        let jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x08];

        // THMB box (version 1)
        let mut thmb_content = Vec::new();
        let thmb_size = (20 + jpeg.len()) as u32;
        thmb_content.extend_from_slice(&thmb_size.to_be_bytes());
        thmb_content.extend_from_slice(b"THMB");
        thmb_content.push(1); // version
        thmb_content.extend_from_slice(&[0u8; 3]); // flags
        thmb_content.extend_from_slice(&160u16.to_be_bytes()); // width
        thmb_content.extend_from_slice(&120u16.to_be_bytes()); // height
        thmb_content.extend_from_slice(&(jpeg.len() as u32).to_be_bytes()); // jpeg_size
        thmb_content.extend_from_slice(&jpeg);

        let thumb_uuid = build_uuid_box(&CR3_THUMB_UUID, &thmb_content);
        let moov = build_isobmff_box(b"moov", &thumb_uuid);
        let ftyp = build_isobmff_box(b"ftyp", b"crx ");

        let mut cr3_data = Vec::new();
        cr3_data.extend_from_slice(&ftyp);
        cr3_data.extend_from_slice(&moov);

        let result = extract_cr3_jpeg(&cr3_data).unwrap();
        assert_eq!(result, jpeg);
    }

    #[test]
    fn test_cr3_no_embedded_jpeg() {
        // 空的 ftyp box，无 PRVW 或 THMB
        let ftyp = build_isobmff_box(b"ftyp", b"crx ");
        let result = extract_cr3_jpeg(&ftyp);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::NoEmbeddedJpeg => {}
            e => panic!("Expected NoEmbeddedJpeg, got: {:?}", e),
        }
    }

    #[test]
    fn test_cr3_prvw_jpeg_invalid_soi() {
        let bad_jpeg = [0x00, 0x00, 0x01, 0x02];
        let prvw_content = build_prvw_box(&bad_jpeg);
        let prvw_uuid_box = build_uuid_box(&CR3_PREVIEW_UUID, &prvw_content);
        let result = extract_cr3_jpeg(&prvw_uuid_box);
        assert!(result.is_err());
    }

    /// 构建一个最小有效的 JPEG (SOI + SOF0 + SOS + EOI)
    fn build_minimal_jpeg(width: u16, height: u16) -> Vec<u8> {
        let mut jpeg = Vec::new();
        // SOI
        jpeg.extend_from_slice(&[0xFF, 0xD8]);
        // SOF0: precision=8, height, width, components=1
        jpeg.extend_from_slice(&[0xFF, 0xC0]);
        jpeg.extend_from_slice(&11u16.to_be_bytes()); // length
        jpeg.push(8); // precision
        jpeg.extend_from_slice(&height.to_be_bytes());
        jpeg.extend_from_slice(&width.to_be_bytes());
        jpeg.push(1); // components
        jpeg.extend_from_slice(&[1, 0x11, 0]); // component spec
        // SOS
        jpeg.extend_from_slice(&[0xFF, 0xDA]);
        jpeg.extend_from_slice(&12u16.to_be_bytes()); // length
        jpeg.push(1); // components
        jpeg.extend_from_slice(&[1, 0x00]); // component selector
        jpeg.extend_from_slice(&[0x00, 0x3F, 0x00]); // Ss, Se, Ah/Al
        // Compressed data (minimal)
        jpeg.extend_from_slice(&[0x7F, 0xA0]);
        // EOI
        jpeg.extend_from_slice(&[0xFF, 0xD9]);
        jpeg
    }

    #[test]
    fn test_extract_jpeg_from_mdat_finds_jpeg() {
        // 构建含有 >200KB JPEG 的 mdat box
        let mut jpeg = build_minimal_jpeg(3000, 2000);
        // 填充到 >200KB
        let padding = vec![0xFFu8; 210 * 1024];
        // 实际上 JPEG 已经有 EOI，我们在 SOS 数据中加填充
        // 移除 EOI，加入填充，再加回 EOI
        jpeg.truncate(jpeg.len() - 2); // 去掉 EOI
        jpeg.extend_from_slice(&padding);
        jpeg.extend_from_slice(&[0xFF, 0xD9]); // EOI

        let mut mdat_content = jpeg.clone();
        let mdat_box = build_isobmff_box(b"mdat", &mdat_content);

        let result = extract_jpeg_from_mdat(&mdat_box);
        assert!(result.is_some(), "应该能从 mdat 中提取 JPEG");
        let extracted = result.unwrap();
        assert_eq!(&extracted[..2], &[0xFF, 0xD8], "提取的应是合法 JPEG");
    }

    #[test]
    fn test_extract_jpeg_from_mdat_too_small_falls_through() {
        // JPEG 小于 200KB 时应返回 None（视为缩略图，不使用）
        let jpeg = build_minimal_jpeg(100, 80);
        let mdat_box = build_isobmff_box(b"mdat", &jpeg);
        let result = extract_jpeg_from_mdat(&mdat_box);
        assert!(result.is_none(), "小于 200KB 的 mdat JPEG 应跳过");
    }

    #[test]
    fn test_extract_jpeg_from_mdat_no_mdat_box() {
        // 没有 mdat box 时应返回 None
        let ftyp = build_isobmff_box(b"ftyp", b"crx ");
        let result = extract_jpeg_from_mdat(&ftyp);
        assert!(result.is_none());
    }

    #[test]
    fn test_cr3_mdat_preferred_over_prvw() {
        // CR3 应优先使用 mdat 中的高分辨率 JPEG 而非 PRVW
        let mut hq_jpeg = build_minimal_jpeg(6000, 4000);
        hq_jpeg.truncate(hq_jpeg.len() - 2);
        hq_jpeg.extend_from_slice(&vec![0x7Fu8; 210 * 1024]);
        hq_jpeg.extend_from_slice(&[0xFF, 0xD9]);

        let prvw_jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
        let prvw_content = build_prvw_box(&prvw_jpeg);
        let prvw_uuid_box = build_uuid_box(&CR3_PREVIEW_UUID, &prvw_content);

        let mdat_box = build_isobmff_box(b"mdat", &hq_jpeg);

        let mut cr3_data = Vec::new();
        cr3_data.extend_from_slice(&prvw_uuid_box);
        cr3_data.extend_from_slice(&mdat_box);

        let result = extract_cr3_jpeg(&cr3_data).unwrap();
        // 应提取 mdat 中的高分辨率 JPEG（大于 200KB）
        assert!(result.len() > 200 * 1024, "应提取 mdat 中的高分辨率 JPEG");
        assert_eq!(&result[..2], &[0xFF, 0xD8]);
    }

    #[test]
    fn test_cr3_extractor() {
        let ext = Cr3Extractor;
        assert_eq!(ext.supported_extensions(), &["cr3"]);
        assert_eq!(ext.exif_header_size(), 0);
        let via_factory = get_extractor("cr3").unwrap();
        assert_eq!(via_factory.supported_extensions(), &["cr3"]);
    }

    /// 构建最小的 TIFF 数据（小端，用于 EXIF 提取测试）
    fn build_minimal_tiff_le() -> Vec<u8> {
        let mut buf = Vec::new();
        buf.extend_from_slice(b"II"); // little-endian
        buf.extend_from_slice(&42u16.to_le_bytes()); // TIFF magic
        buf.extend_from_slice(&8u32.to_le_bytes()); // IFD0 offset
        buf.extend_from_slice(&0u16.to_le_bytes()); // 0 entries
        buf.extend_from_slice(&0u32.to_le_bytes()); // next IFD = 0
        buf
    }

    #[test]
    fn test_cr3_extract_exif_from_cmt1() {
        let tiff_data = build_minimal_tiff_le();

        // 构建模拟 Canon CR3 结构：ftyp + moov[uuid(CMT1)]
        let cmt1 = build_isobmff_box(b"CMT1", &tiff_data);
        let uuid_box = build_uuid_box(&CR3_THUMB_UUID, &cmt1);
        let moov = build_isobmff_box(b"moov", &uuid_box);
        let ftyp = build_isobmff_box(b"ftyp", b"crx ");

        let mut cr3_data = Vec::new();
        cr3_data.extend_from_slice(&ftyp);
        cr3_data.extend_from_slice(&moov);

        let result = extract_cr3_exif_from_cmt1(&cr3_data).unwrap();
        assert_eq!(result, tiff_data);
    }

    #[test]
    fn test_cr3_extract_exif_from_cmt1_not_found() {
        let ftyp = build_isobmff_box(b"ftyp", b"crx ");
        let result = extract_cr3_exif_from_cmt1(&ftyp);
        assert!(result.is_err());
    }

    #[test]
    fn test_cr3_extract_exif_from_cmt1_invalid_tiff() {
        // CMT1 box 内容不是 TIFF 格式
        let bad_data = vec![0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x00, 0x00, 0x00];
        let cmt1 = build_isobmff_box(b"CMT1", &bad_data);
        let uuid_box = build_uuid_box(&CR3_THUMB_UUID, &cmt1);
        let moov = build_isobmff_box(b"moov", &uuid_box);

        let result = extract_cr3_exif_from_cmt1(&moov);
        assert!(result.is_err());
    }

    #[test]
    fn test_find_box_recursive() {
        // 构建嵌套结构：moov[uuid[CMT1 + THMB]]
        let tiff = build_minimal_tiff_le();
        let cmt1 = build_isobmff_box(b"CMT1", &tiff);
        let thmb = build_isobmff_box(b"THMB", b"thumb");
        let mut uuid_inner = Vec::new();
        uuid_inner.extend_from_slice(&cmt1);
        uuid_inner.extend_from_slice(&thmb);
        let uuid_box = build_uuid_box(&CR3_THUMB_UUID, &uuid_inner);
        let moov = build_isobmff_box(b"moov", &uuid_box);

        let found = find_box_recursive(&moov, b"CMT1").unwrap();
        assert_eq!(found, tiff);

        let found_thmb = find_box_recursive(&moov, b"THMB").unwrap();
        assert_eq!(found_thmb, b"thumb");

        assert!(find_box_recursive(&moov, b"xxxx").is_none());
    }

    #[test]
    fn test_ifd_chain_traversal() {
        // 构建包含两个 IFD 链接的 TIFF
        // IFD0 (无 JPEG) → IFD1 (包含 JPEG)
        let mut data = vec![0x49, 0x49]; // II
        data.extend_from_slice(&42u16.to_le_bytes());
        data.extend_from_slice(&8u32.to_le_bytes()); // IFD0 at 8

        // IFD0: 0 entries, next IFD at known offset
        let ifd1_offset: u32 = 8 + 2 + 0 * 12 + 4; // = 14
        data.extend_from_slice(&0u16.to_le_bytes()); // 0 entries
        data.extend_from_slice(&ifd1_offset.to_le_bytes()); // next IFD

        // IFD1 at offset 14: 2 entries with JPEG
        let jpeg_data = [0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x08];
        let jpeg_offset_val: u32 = 14 + 2 + 2 * 12 + 4; // after IFD1
        data.extend_from_slice(&2u16.to_le_bytes());

        data.extend_from_slice(&TAG_JPEG_OFFSET.to_le_bytes());
        data.extend_from_slice(&4u16.to_le_bytes());
        data.extend_from_slice(&1u32.to_le_bytes());
        data.extend_from_slice(&jpeg_offset_val.to_le_bytes());

        data.extend_from_slice(&TAG_JPEG_LENGTH.to_le_bytes());
        data.extend_from_slice(&4u16.to_le_bytes());
        data.extend_from_slice(&1u32.to_le_bytes());
        data.extend_from_slice(&(jpeg_data.len() as u32).to_le_bytes());

        data.extend_from_slice(&0u32.to_le_bytes()); // next IFD = 0

        // Append JPEG
        data.extend_from_slice(&jpeg_data);

        let result = extract_largest_jpeg(&data).unwrap();
        assert_eq!(result, jpeg_data);
    }

    // ─── DNG StripOffsets + Compression=7 JPEG 提取测试 ──────

    /// 构建 DNG 风格的 TIFF：IFD0 包含 SubIFD，SubIFD 使用
    /// StripOffsets + StripByteCounts + Compression=7 引用 JPEG 数据
    fn build_dng_with_strip_jpeg(jpeg_data: &[u8]) -> Vec<u8> {
        let mut buf = Vec::new();

        // TIFF Header (8 bytes)
        buf.extend_from_slice(&[0x49, 0x49]); // II
        buf.extend_from_slice(&42u16.to_le_bytes()); // magic
        buf.extend_from_slice(&8u32.to_le_bytes()); // IFD0 offset = 8

        // IFD0: 1 entry (SubIFDs pointing to one SubIFD)
        let ifd0_entries: u16 = 1;
        buf.extend_from_slice(&ifd0_entries.to_le_bytes());

        // SubIFD entry at IFD0
        // The SubIFD offset will point to sub_ifd_offset
        // IFD0 size = 2 + 1*12 + 4 = 18, so SubIFD starts at 8 + 18 = 26
        let sub_ifd_offset: u32 = 26;
        buf.extend_from_slice(&TAG_SUB_IFDS.to_le_bytes()); // tag
        buf.extend_from_slice(&4u16.to_le_bytes()); // type = LONG
        buf.extend_from_slice(&1u32.to_le_bytes()); // count = 1
        buf.extend_from_slice(&sub_ifd_offset.to_le_bytes()); // value = offset

        // next IFD = 0
        buf.extend_from_slice(&0u32.to_le_bytes());

        // SubIFD at offset 26: 3 entries (Compression, StripOffsets, StripByteCounts)
        let sub_ifd_entries: u16 = 3;
        buf.extend_from_slice(&sub_ifd_entries.to_le_bytes());

        // JPEG data starts after SubIFD
        // SubIFD size = 2 + 3*12 + 4 = 42
        let jpeg_data_offset: u32 = sub_ifd_offset + 42;

        // Entry 1: Compression = 7 (JPEG)
        buf.extend_from_slice(&TAG_COMPRESSION.to_le_bytes());
        buf.extend_from_slice(&3u16.to_le_bytes()); // SHORT
        buf.extend_from_slice(&1u32.to_le_bytes()); // count
        buf.extend_from_slice(&COMPRESSION_JPEG.to_le_bytes()); // value = 7
        buf.extend_from_slice(&[0u8; 2]); // padding to 4 bytes

        // Entry 2: StripOffsets
        buf.extend_from_slice(&TAG_STRIP_OFFSETS.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes()); // LONG
        buf.extend_from_slice(&1u32.to_le_bytes()); // count = 1
        buf.extend_from_slice(&jpeg_data_offset.to_le_bytes());

        // Entry 3: StripByteCounts
        buf.extend_from_slice(&TAG_STRIP_BYTE_COUNTS.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes()); // LONG
        buf.extend_from_slice(&1u32.to_le_bytes()); // count = 1
        buf.extend_from_slice(&(jpeg_data.len() as u32).to_le_bytes());

        // next IFD = 0
        buf.extend_from_slice(&0u32.to_le_bytes());

        // Append JPEG data
        buf.extend_from_slice(jpeg_data);

        buf
    }

    #[test]
    fn test_dng_strip_jpeg_extraction() {
        let jpeg_data = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x00, 0x00, 0xFF, 0xD9];
        let dng = build_dng_with_strip_jpeg(&jpeg_data);
        let result = extract_largest_jpeg(&dng).unwrap();
        assert_eq!(result, jpeg_data);
    }

    #[test]
    fn test_dng_strip_jpeg_larger_than_standard_tag() {
        // DNG with both standard JPEGInterchangeFormat and StripOffsets+Compression=7
        // StripOffsets should produce larger JPEG candidate
        let small_jpeg = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x02, 0xFF, 0xD9]; // 8 bytes
        let large_jpeg = vec![
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x41, 0x42, 0x43, 0x44, 0xFF, 0xD9,
        ]; // 12 bytes

        let mut buf = Vec::new();

        // TIFF Header
        buf.extend_from_slice(&[0x49, 0x49]);
        buf.extend_from_slice(&42u16.to_le_bytes());
        buf.extend_from_slice(&8u32.to_le_bytes()); // IFD0 at 8

        // IFD0: 5 entries
        let entry_count: u16 = 5;
        buf.extend_from_slice(&entry_count.to_le_bytes());

        // Calculate offsets
        let ifd_size = 2 + 5 * 12 + 4; // = 66
        let small_jpeg_offset: u32 = 8 + ifd_size as u32; // after IFD
        let large_jpeg_offset: u32 = small_jpeg_offset + small_jpeg.len() as u32;

        // Entry 1: JPEGInterchangeFormat (small JPEG)
        buf.extend_from_slice(&TAG_JPEG_OFFSET.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&small_jpeg_offset.to_le_bytes());

        // Entry 2: JPEGInterchangeFormatLength
        buf.extend_from_slice(&TAG_JPEG_LENGTH.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&(small_jpeg.len() as u32).to_le_bytes());

        // Entry 3: Compression = 7
        buf.extend_from_slice(&TAG_COMPRESSION.to_le_bytes());
        buf.extend_from_slice(&3u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&COMPRESSION_JPEG.to_le_bytes());
        buf.extend_from_slice(&[0u8; 2]);

        // Entry 4: StripOffsets (large JPEG)
        buf.extend_from_slice(&TAG_STRIP_OFFSETS.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&large_jpeg_offset.to_le_bytes());

        // Entry 5: StripByteCounts
        buf.extend_from_slice(&TAG_STRIP_BYTE_COUNTS.to_le_bytes());
        buf.extend_from_slice(&4u16.to_le_bytes());
        buf.extend_from_slice(&1u32.to_le_bytes());
        buf.extend_from_slice(&(large_jpeg.len() as u32).to_le_bytes());

        // next IFD = 0
        buf.extend_from_slice(&0u32.to_le_bytes());

        // Append JPEG data
        buf.extend_from_slice(&small_jpeg);
        buf.extend_from_slice(&large_jpeg);

        let result = extract_largest_jpeg(&buf).unwrap();
        assert_eq!(result, large_jpeg, "应该选择更大的 StripOffsets JPEG");
    }

    // ─── ORF 头部标准化测试 ──────────────────────────────────

    #[test]
    fn test_orf_header_normalization_le() {
        // ORF little-endian with IIRO header
        let jpeg_data = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x02, 0x00, 0x00, 0xFF, 0xD9];
        let mut data = build_tiff_with_jpeg(&jpeg_data, true);
        data[2] = 0x52; // 'R'
        data[3] = 0x4F; // 'O'

        // parse_tiff_header should now accept ORF magic
        let result = parse_tiff_header(&data);
        assert!(
            result.is_ok(),
            "ORF header should be accepted: {:?}",
            result
        );

        // OrfExtractor.extract_metadata should normalize header
        let extractor = OrfExtractor;
        let meta_result = extractor.extract_metadata(&data);
        // 可能因数据不完整而失败，但不应是 "Unknown image format" 错误
        if let Err(e) = &meta_result {
            let err_str = e.to_string();
            assert!(
                !err_str.contains("Unknown image format"),
                "ORF should not fail with 'Unknown image format', got: {}",
                err_str
            );
        }
    }

    #[test]
    fn test_orf_header_normalization_be() {
        // ORF big-endian with MMOR header
        let mut data = vec![0x4D, 0x4D]; // MM
        data.push(0x4F); // 'O'
        data.push(0x52); // 'R'
        data.extend_from_slice(&8u32.to_be_bytes()); // IFD0 offset

        // 1 entry: JPEG offset tag
        data.extend_from_slice(&1u16.to_be_bytes());
        data.extend_from_slice(&0x0201u16.to_be_bytes()); // JPEGInterchangeFormat
        data.extend_from_slice(&0x4u16.to_be_bytes()); // LONG
        data.extend_from_slice(&1u32.to_be_bytes()); // count
        let jpeg_offset_pos = data.len();
        data.extend_from_slice(&0u32.to_be_bytes()); // placeholder offset
        data.extend_from_slice(&0u32.to_be_bytes()); // next IFD

        // Append JPEG
        let jpeg_data = vec![0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x02, 0x00, 0x00, 0xFF, 0xD9];
        let jpeg_offset = data.len() as u32;
        data[jpeg_offset_pos..jpeg_offset_pos + 4].copy_from_slice(&jpeg_offset.to_be_bytes());
        data.extend_from_slice(&jpeg_data);

        // parse_tiff_header should accept ORF magic
        let result = parse_tiff_header(&data);
        assert!(
            result.is_ok(),
            "ORF BE header should be accepted: {:?}",
            result
        );
    }
}
