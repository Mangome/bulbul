//! RAW 图像处理器
//!
//! 协调 NEF 解析与 Exif 提取，将嵌入 JPEG 解码并保存为 medium 图片，
//! 生成 600px 长边缩略图。
//!
//! 性能关键路径：
//! - 使用 seek 而非全量读取来提取嵌入 JPEG（避免 30-60MB 全量 IO）
//! - Exif 解析仅读取文件头部
//! - 图像处理使用 spawn_blocking 避免阻塞 tokio 异步运行时

use std::io::Cursor;
use std::path::Path;

use image::imageops::FilterType;
use serde::{Deserialize, Serialize};

use crate::core::raw_parser;
use crate::models::{AppError, ImageMetadata};
use crate::utils::cache;
use crate::utils::paths::compute_path_hash;

/// 缩略图最大宽度（像素）
/// 600px 长边适合画布默认展示，兼顾清晰度与内存
const THUMBNAIL_WIDTH: u32 = 600;

/// Medium 图片最大宽度（像素）
/// 对应 2560p 显示器，兼顾高分屏清晰度与内存开销
const MEDIUM_WIDTH: u32 = 2560;

/// 缩略图 JPEG 质量（600px 需要较高质量以保持清晰）
const THUMBNAIL_QUALITY: u8 = 80;

/// Medium JPEG 质量（1920px 显示用，80% 是高质量与文件大小的平衡）
const MEDIUM_QUALITY: u8 = 80;

/// 单文件处理结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessResult {
    pub hash: String,
    pub filename: String,
    pub file_path: String,
    pub metadata: ImageMetadata,
    pub medium_path: String,
    pub thumbnail_path: String,
}

/// 处理单个 RAW 文件
///
/// 流程：计算哈希 → 检查缓存 → 提取嵌入 JPEG → 解析 Exif → 保存 medium → 生成缩略图
///
/// 性能优化：
/// - 缓存命中：仅读取 64KB 头部解析 Exif，跳过全量读取
/// - 缓存未命中：全量读取后，JPEG 提取和 Exif 解析共享同一份数据
/// - 图像解码/缩放在 blocking 线程池中执行
pub async fn process_single_raw(
    file_path: &Path,
    cache_base_dir: &Path,
) -> Result<ProcessResult, AppError> {
    let hash = compute_path_hash(file_path)?;
    let filename = file_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let extension = file_path
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    // 校验支持的格式并获取 Extractor（快速失败）
    let extractor = raw_parser::get_extractor(&extension)?;

    // 缓存命中时走快速路径：仅读取头部解析 Exif
    if cache::is_cached(cache_base_dir, &hash) {
        let header_size = extractor.exif_header_size();
        // 先尝试头部快速读取；若 header_size 为 0 则跳过直接全量读取
        // 若 EXIF 字段偏移超出头部范围则回退全量读取
        let metadata = if header_size == 0 {
            let data = tokio::fs::read(file_path).await.map_err(|e| {
                AppError::FileNotFound(format!("{}: {}", file_path.display(), e))
            })?;
            extractor.extract_metadata(&data)?
        } else {
            match read_exif_from_header(file_path, header_size, &*extractor).await {
                Ok(m) => m,
                Err(_) => {
                    let data = tokio::fs::read(file_path).await.map_err(|e| {
                        AppError::FileNotFound(format!("{}: {}", file_path.display(), e))
                    })?;
                    extractor.extract_metadata(&data)?
                }
            }
        };
        let medium_path =
            crate::utils::paths::get_cache_file_path(cache_base_dir, &hash, "medium");
        let thumbnail_path =
            crate::utils::paths::get_cache_file_path(cache_base_dir, &hash, "thumbnail");

        return Ok(ProcessResult {
            hash,
            filename,
            file_path: file_path.to_string_lossy().to_string(),
            metadata,
            medium_path: medium_path.to_string_lossy().to_string(),
            thumbnail_path: thumbnail_path.to_string_lossy().to_string(),
        });
    }

    // 缓存未命中：全量读取（JPEG 提取需要完整文件）
    let data = tokio::fs::read(file_path).await.map_err(|e| {
        AppError::FileNotFound(format!("{}: {}", file_path.display(), e))
    })?;

    // 从同一份数据中提取 JPEG 和 Exif（使用格式特定的 Extractor）
    let jpeg_data = extractor.extract_jpeg(&data)?;
    let metadata = extractor.extract_metadata(&data)?;

    // 不再需要原始 RAW 数据，尽早释放
    drop(data);

    // 生成 medium 和缩略图（CPU 密集型，在 blocking 线程池中执行）
    let jpeg_clone = jpeg_data.clone();
    let (medium_data, thumbnail_data) = tokio::task::spawn_blocking(move || {
        let medium = generate_medium(&jpeg_clone)
            .map_err(|e| AppError::ImageProcessError(format!("Medium 生成失败: {}", e)))?;
        let thumbnail = generate_thumbnail(&jpeg_clone)
            .map_err(|e| AppError::ImageProcessError(format!("缩略图生成失败: {}", e)))?;
        Ok::<_, AppError>((medium, thumbnail))
    })
    .await
    .map_err(|e| AppError::ImageProcessError(format!("图像处理任务失败: {}", e)))??;

    // 异步写入磁盘
    let medium_path = cache::write_medium(cache_base_dir, &hash, &medium_data).await?;
    let thumbnail_path = cache::write_thumbnail(cache_base_dir, &hash, &thumbnail_data).await?;

    Ok(ProcessResult {
        hash,
        filename,
        file_path: file_path.to_string_lossy().to_string(),
        metadata,
        medium_path: medium_path.to_string_lossy().to_string(),
        thumbnail_path: thumbnail_path.to_string_lossy().to_string(),
    })
}

/// 仅读取文件头部解析 Exif（用于缓存命中快速路径）
///
/// TIFF/EP 格式的 Exif 数据存储在文件头部 IFD 中，通常 64KB 以内即可完全覆盖。
/// 相比全量读取 30-60MB，头部读取速度提升 ~500x。
///
/// 当 `exif_header_size` 为 0 时返回错误，由调用方执行全量读取。
async fn read_exif_from_header(
    file_path: &Path,
    exif_header_size: usize,
    extractor: &dyn raw_parser::RawExtractor,
) -> Result<ImageMetadata, AppError> {
    use tokio::io::AsyncReadExt;

    let mut file = tokio::fs::File::open(file_path).await.map_err(|e| {
        AppError::FileNotFound(format!("{}: {}", file_path.display(), e))
    })?;

    let file_size = file
        .metadata()
        .await
        .map(|m| m.len() as usize)
        .unwrap_or(exif_header_size);

    let read_size = file_size.min(exif_header_size);
    let mut header = vec![0u8; read_size];
    file.read_exact(&mut header).await.map_err(|e| {
        AppError::IoError(std::io::Error::new(
            e.kind(),
            format!("读取 Exif 头部失败 '{}': {}", file_path.display(), e),
        ))
    })?;

    extractor.extract_metadata(&header)
}

/// 生成 200px 宽缩略图
///
/// 解码 JPEG → 按比例缩放到 600px 长边（Lanczos3）→ 编码为 JPEG
///
/// 600px 需要高质量缩放，使用 Lanczos3 保证清晰度
pub fn generate_thumbnail(jpeg_data: &[u8]) -> Result<Vec<u8>, AppError> {
    let img = image::load_from_memory(jpeg_data)
        .map_err(|e| AppError::ImageProcessError(format!("JPEG 解码失败: {}", e)))?;

    let (orig_width, orig_height) = (img.width(), img.height());

    let (new_width, new_height) = if orig_width <= THUMBNAIL_WIDTH {
        // 不放大
        (orig_width, orig_height)
    } else {
        let ratio = THUMBNAIL_WIDTH as f64 / orig_width as f64;
        let new_height = (orig_height as f64 * ratio).round() as u32;
        (THUMBNAIL_WIDTH, new_height.max(1))
    };

    let resized = img.resize_exact(new_width, new_height, FilterType::Lanczos3);

    let mut buf = Cursor::new(Vec::with_capacity(32 * 1024)); // 预分配 32KB
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, THUMBNAIL_QUALITY);
    resized
        .write_with_encoder(encoder)
        .map_err(|e| AppError::ImageProcessError(format!("缩略图编码失败: {}", e)))?;

    Ok(buf.into_inner())
}

/// 生成 medium 尺寸图片（最大宽度 1920px）
///
/// 用于屏幕显示，比原始嵌入 JPEG（6016×4016）小得多
/// 解码 JPEG → 按比例缩放到 1920px 宽（Lanczos3）→ 编码为 JPEG（质量 80%）
pub fn generate_medium(jpeg_data: &[u8]) -> Result<Vec<u8>, AppError> {
    let img = image::load_from_memory(jpeg_data)
        .map_err(|e| AppError::ImageProcessError(format!("Medium JPEG 解码失败: {}", e)))?;

    let (orig_width, orig_height) = (img.width(), img.height());

    let (new_width, new_height) = if orig_width <= MEDIUM_WIDTH {
        // 不放大，但仍重新编码以保证质量和一致性
        (orig_width, orig_height)
    } else {
        let ratio = MEDIUM_WIDTH as f64 / orig_width as f64;
        let new_height = (orig_height as f64 * ratio).round() as u32;
        (MEDIUM_WIDTH, new_height.max(1))
    };

    let resized = img.resize_exact(new_width, new_height, FilterType::Lanczos3);

    let mut buf = Cursor::new(Vec::with_capacity(128 * 1024)); // 预分配 128KB
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, MEDIUM_QUALITY);
    resized
        .write_with_encoder(encoder)
        .map_err(|e| AppError::ImageProcessError(format!("Medium JPEG 编码失败: {}", e)))?;

    Ok(buf.into_inner())
}


#[cfg(test)]
mod tests {
    use super::*;
    use image::ImageFormat;

    /// 创建一个最小有效的 JPEG 图像
    fn create_test_jpeg(width: u32, height: u32) -> Vec<u8> {
        let img = image::DynamicImage::new_rgb8(width, height);
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, ImageFormat::Jpeg).unwrap();
        buf.into_inner()
    }

    #[test]
    fn test_generate_thumbnail_landscape() {
        let jpeg = create_test_jpeg(1920, 1280);
        let thumb = generate_thumbnail(&jpeg).unwrap();

        // 解码缩略图验证尺寸
        let img = image::load_from_memory(&thumb).unwrap();
        assert_eq!(img.width(), THUMBNAIL_WIDTH);
        // 1280 * (600/1920) = 400
        assert!((img.height() as i32 - 400).abs() <= 1);
    }

    #[test]
    fn test_generate_thumbnail_portrait() {
        let jpeg = create_test_jpeg(1280, 1920);
        let thumb = generate_thumbnail(&jpeg).unwrap();

        let img = image::load_from_memory(&thumb).unwrap();
        assert_eq!(img.width(), THUMBNAIL_WIDTH);
        // 1920 * (600/1280) = 900
        assert!((img.height() as i32 - 900).abs() <= 1);
    }

    #[test]
    fn test_generate_thumbnail_small_image_no_upscale() {
        let jpeg = create_test_jpeg(150, 100);
        let thumb = generate_thumbnail(&jpeg).unwrap();

        let img = image::load_from_memory(&thumb).unwrap();
        assert_eq!(img.width(), 150);
        assert_eq!(img.height(), 100);
    }

    #[test]
    fn test_generate_thumbnail_invalid_data() {
        let result = generate_thumbnail(&[0x00, 0x01, 0x02]);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::ImageProcessError(_) => {}
            e => panic!("Expected ImageProcessError, got: {:?}", e),
        }
    }

    #[test]
    fn test_process_result_serialization() {
        let result = ProcessResult {
            hash: "abc123".to_string(),
            filename: "DSC_0001.nef".to_string(),
            file_path: "/photos/DSC_0001.nef".to_string(),
            metadata: ImageMetadata::default(),
            medium_path: "/cache/medium/abc123.jpg".to_string(),
            thumbnail_path: "/cache/thumbnail/abc123.jpg".to_string(),
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("abc123"));
        assert!(json.contains("DSC_0001.nef"));
    }
}
