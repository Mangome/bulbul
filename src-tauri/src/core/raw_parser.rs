//! RAW/TIFF IFD 链解析器
//!
//! 手动解析 TIFF 格式的 IFD 链，定位并提取 RAW 文件中嵌入的最大 JPEG 预览图。
//! 定义 `RawExtractor` trait 用于多 RAW 格式扩展。

use crate::models::{AppError, ImageMetadata};

// ─── 支持的 RAW 格式 ────────────────────────────────────

/// 所有支持的 RAW 文件扩展名（小写，不含点号，按字母序排列）
pub const SUPPORTED_RAW_EXTENSIONS: &[&str] = &[
    "arw", "cr2", "cr3", "dng", "nef", "orf", "pef", "raf", "rw2",
];

/// 判断给定扩展名是否属于支持的 RAW 格式（大小写不敏感）
pub fn is_raw_extension(extension: &str) -> bool {
    SUPPORTED_RAW_EXTENSIONS.contains(&extension.to_lowercase().as_str())
}

// ─── TIFF 常量 ─────────────────────────────────────────

const TIFF_MAGIC: u16 = 42;
const TAG_SUB_IFDS: u16 = 0x014A;
const TAG_JPEG_OFFSET: u16 = 0x0201; // JPEGInterchangeFormat
const TAG_JPEG_LENGTH: u16 = 0x0202; // JPEGInterchangeFormatLength
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
        let bytes = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]];
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
        return Err(AppError::RawParseError(format!(
            "文件过短: {} 字节，最少需要 8 字节",
            data.len()
        )));
    }

    let byte_order = match (data[0], data[1]) {
        (0x49, 0x49) => ByteOrder::LittleEndian,
        (0x4D, 0x4D) => ByteOrder::BigEndian,
        _ => {
            return Err(AppError::RawParseError(format!(
                "无效的字节序标记: 0x{:02X} 0x{:02X}",
                data[0], data[1]
            )))
        }
    };

    let magic = byte_order
        .read_u16(data, 2)
        .ok_or_else(|| AppError::RawParseError("无法读取 TIFF 魔数".into()))?;

    if magic != TIFF_MAGIC {
        return Err(AppError::RawParseError(format!(
            "无效的 TIFF 魔数: {}，期望 42",
            magic
        )));
    }

    let ifd0_offset = byte_order
        .read_u32(data, 4)
        .ok_or_else(|| AppError::RawParseError("无法读取 IFD0 偏移量".into()))?
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
        .ok_or_else(|| AppError::RawParseError("无法读取 IFD entry 数量".into()))?
        as usize;

    let mut jpeg_offset: Option<u32> = None;
    let mut jpeg_length: Option<u32> = None;
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
            TAG_SUB_IFDS => {
                // SubIFD 指针可能是单个或多个偏移
                let offsets = read_sub_ifd_offsets(data, bo, entry_offset + 8, count as usize);
                sub_ifd_offsets.extend(offsets);
            }
            _ => {}
        }
    }

    let mut candidates = Vec::new();
    if let (Some(offset), Some(length)) = (jpeg_offset, jpeg_length) {
        candidates.push(JpegCandidate {
            offset: offset as usize,
            length: length as usize,
        });
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

/// 读取 IFD entry 的值（LONG 或 SHORT 类型）
fn read_entry_value(data: &[u8], bo: ByteOrder, value_offset: usize, data_type: u16, count: u32) -> Option<u32> {
    match data_type {
        // SHORT (type 3): 2 bytes
        3 if count == 1 => bo.read_u16(data, value_offset).map(|v| v as u32),
        // LONG (type 4): 4 bytes
        4 if count == 1 => bo.read_u32(data, value_offset),
        _ => bo.read_u32(data, value_offset),
    }
}

/// 读取 SubIFD 偏移数组
fn read_sub_ifd_offsets(data: &[u8], bo: ByteOrder, value_offset: usize, count: usize) -> Vec<usize> {
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

    // 选择最大的有效 JPEG
    let mut best: Option<(usize, usize)> = None; // (offset, length)

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
        // 选最大的
        match &best {
            Some((_, best_len)) if candidate.length <= *best_len => {}
            _ => {
                best = Some((candidate.offset, candidate.length));
            }
        }
    }

    match best {
        Some((offset, length)) => Ok(data[offset..offset + length].to_vec()),
        None => Err(AppError::NoEmbeddedJpeg),
    }
}

// ─── RawExtractor trait ──────────────────────────────────

/// RAW 格式提取器 trait，支持多 RAW 格式扩展
#[allow(dead_code)]
pub trait RawExtractor: Send + Sync {
    /// 支持的文件扩展名（小写，不含点）
    fn supported_extensions(&self) -> &[&str];

    /// 提取嵌入 JPEG
    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError>;

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

impl RawExtractor for NefExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["nef"]
    }

    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
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

impl RawExtractor for Cr2Extractor {
    fn supported_extensions(&self) -> &[&str] {
        &["cr2"]
    }

    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
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

impl RawExtractor for ArwExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["arw"]
    }

    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
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

impl RawExtractor for DngExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["dng"]
    }

    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_largest_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

/// Olympus ORF 格式提取器
pub struct OrfExtractor;

impl RawExtractor for OrfExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["orf"]
    }

    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_largest_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

/// Panasonic RW2 格式提取器
pub struct Rw2Extractor;

impl RawExtractor for Rw2Extractor {
    fn supported_extensions(&self) -> &[&str] {
        &["rw2"]
    }

    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_largest_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

/// Pentax PEF 格式提取器
pub struct PefExtractor;

impl RawExtractor for PefExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["pef"]
    }

    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
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
        return Err(AppError::RawParseError(format!(
            "RAF 文件过短: {} 字节，最少需要 {} 字节",
            data.len(),
            RAF_HEADER_SIZE
        )));
    }

    // 验证魔数
    if &data[0..15] != RAF_MAGIC {
        return Err(AppError::RawParseError(
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
        return Err(AppError::RawParseError(format!(
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

impl RawExtractor for RafExtractor {
    fn supported_extensions(&self) -> &[&str] {
        &["raf"]
    }

    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_raf_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
        65536
    }
}

/// 根据文件扩展名选择对应的 RawExtractor
pub fn get_extractor(extension: &str) -> Result<Box<dyn RawExtractor>, AppError> {
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
        ext => Err(AppError::RawParseError(format!(
            "不支持的 RAW 格式: .{}",
            ext
        ))),
    }
}

// ─── Canon CR3 格式解析（ISOBMFF 容器）───────────────────

/// CR3 预览 JPEG 所在的 UUID box 标识符（PRVW box）
/// `eaf42b5e-1c98-4b88-b9fb-b7dc406e4d16`
const CR3_PREVIEW_UUID: [u8; 16] = [
    0xea, 0xf4, 0x2b, 0x5e, 0x1c, 0x98, 0x4b, 0x88,
    0xb9, 0xfb, 0xb7, 0xdc, 0x40, 0x6e, 0x4d, 0x16,
];

/// CR3 缩略图 JPEG 所在的 UUID box 标识符（THMB box，在 moov 内）
/// `85c0b687-820f-11e0-8111-f4ce462b6a48`
const CR3_THUMB_UUID: [u8; 16] = [
    0x85, 0xc0, 0xb6, 0x87, 0x82, 0x0f, 0x11, 0xe0,
    0x81, 0x11, 0xf4, 0xce, 0x46, 0x2b, 0x6a, 0x48,
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
        let size = u32::from_be_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]) as usize;
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
                return Err(AppError::RawParseError("PRVW box 数据过短".into()));
            }
            let jpeg_size = u32::from_be_bytes([
                prvw_data[offset + 20],
                prvw_data[offset + 21],
                prvw_data[offset + 22],
                prvw_data[offset + 23],
            ]) as usize;

            let jpeg_start = offset + 24;
            if jpeg_start + jpeg_size > prvw_data.len() {
                return Err(AppError::RawParseError("PRVW JPEG 数据越界".into()));
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
    // 优先尝试 PRVW 预览
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

                let jpeg_start = if version == 1 { offset + 20 } else { offset + 24 };
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

/// Canon CR3 格式提取器
pub struct Cr3Extractor;

impl RawExtractor for Cr3Extractor {
    fn supported_extensions(&self) -> &[&str] {
        &["cr3"]
    }

    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError> {
        extract_cr3_jpeg(data)
    }

    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError> {
        crate::core::metadata::parse_exif(data)
    }

    fn exif_header_size(&self) -> usize {
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
        assert_eq!(get_extractor("CR2").unwrap().supported_extensions(), &["cr2"]);
        assert_eq!(get_extractor("Arw").unwrap().supported_extensions(), &["arw"]);
        assert_eq!(get_extractor("DNG").unwrap().supported_extensions(), &["dng"]);
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
        assert_eq!(ext.exif_header_size(), 65536);
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

    #[test]
    fn test_cr3_extractor() {
        let ext = Cr3Extractor;
        assert_eq!(ext.supported_extensions(), &["cr3"]);
        assert_eq!(ext.exif_header_size(), 0);
        let via_factory = get_extractor("cr3").unwrap();
        assert_eq!(via_factory.supported_extensions(), &["cr3"]);
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
}
