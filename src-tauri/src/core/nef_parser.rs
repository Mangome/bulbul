//! NEF/TIFF IFD 链解析器
//!
//! 手动解析 TIFF 格式的 IFD 链，定位并提取 NEF 文件中嵌入的最大 JPEG 预览图。
//! 同时定义 `RawExtractor` trait 用于多 RAW 格式扩展。

use crate::models::{AppError, ImageMetadata};

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
        return Err(AppError::NefParseError(format!(
            "文件过短: {} 字节，最少需要 8 字节",
            data.len()
        )));
    }

    let byte_order = match (data[0], data[1]) {
        (0x49, 0x49) => ByteOrder::LittleEndian,
        (0x4D, 0x4D) => ByteOrder::BigEndian,
        _ => {
            return Err(AppError::NefParseError(format!(
                "无效的字节序标记: 0x{:02X} 0x{:02X}",
                data[0], data[1]
            )))
        }
    };

    let magic = byte_order
        .read_u16(data, 2)
        .ok_or_else(|| AppError::NefParseError("无法读取 TIFF 魔数".into()))?;

    if magic != TIFF_MAGIC {
        return Err(AppError::NefParseError(format!(
            "无效的 TIFF 魔数: {}，期望 42",
            magic
        )));
    }

    let ifd0_offset = byte_order
        .read_u32(data, 4)
        .ok_or_else(|| AppError::NefParseError("无法读取 IFD0 偏移量".into()))?
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
        .ok_or_else(|| AppError::NefParseError("无法读取 IFD entry 数量".into()))?
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

/// RAW 格式提取器 trait，为后续支持多格式预留
pub trait RawExtractor: Send + Sync {
    /// 支持的文件扩展名（小写，不含点）
    fn supported_extensions(&self) -> &[&str];

    /// 提取嵌入 JPEG
    fn extract_jpeg(&self, data: &[u8]) -> Result<Vec<u8>, AppError>;

    /// 解析 Exif 元数据
    fn extract_metadata(&self, data: &[u8]) -> Result<ImageMetadata, AppError>;
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
}

/// 根据文件扩展名选择对应的 RawExtractor
pub fn get_extractor(extension: &str) -> Result<Box<dyn RawExtractor>, AppError> {
    match extension.to_lowercase().as_str() {
        "nef" => Ok(Box::new(NefExtractor)),
        ext => Err(AppError::NefParseError(format!(
            "不支持的 RAW 格式: .{}",
            ext
        ))),
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
        let result = get_extractor("cr2");
        assert!(result.is_err());
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
