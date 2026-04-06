//! 合焦程度评分模块
//!
//! 基于 Laplacian 方差 + 分块检测，计算图像的合焦程度（1-5 星）。
//!
//! 算法流程：
//! 1. 加载 JPEG 图像
//! 2. 转灰度 + 等比下采样到长边 512px
//! 3. 应用 Laplacian 卷积（二阶梯度检测）
//! 4. 分块评估（5×4 = 20 块）
//! 5. 取 Top-3 块方差的中位数作为合焦指标（抗噪更鲁棒）
//! 6. 映射到 1-5 星评级
//!
//! 性能：单张 medium JPEG ~100-150ms

use std::path::Path;

use image::imageops::FilterType;
use serde::{Deserialize, Serialize};

use crate::models::AppError;
use crate::core::bird_detection::DetectionBox;

/// 合焦评分方法标记
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "PascalCase")]
pub enum FocusScoringMethod {
    /// 全画面评分（旧方法）
    FullImage,
    /// 鸟区域评分（新方法）
    BirdRegion,
    /// 未检测到主体
    Undetected,
}

/// 分块尺寸（行数）
#[cfg(test)]
const BLOCK_ROWS: usize = 4;
/// 分块尺寸（列数）
#[cfg(test)]
const BLOCK_COLS: usize = 5;

/// 下采样长边最大值
const ANALYSIS_LONG_EDGE: u32 = 512;

/// Laplacian 核（标准 3×3）
const LAPLACIAN_KERNEL: [[f32; 3]; 3] = [
    [0.0, -1.0, 0.0],
    [-1.0, 4.0, -1.0],
    [0.0, -1.0, 0.0],
];

/// 评估合焦时取分块方差的 Top-K
#[cfg(test)]
const TOP_K_BLOCKS: usize = 3;

/// 从 JPEG 路径计算合焦评分（支持全画面和区域评分）
///
/// 返回 (Some(1-5 星), 评分方法) 或 (None, Undetected)
pub fn calculate_focus_score_with_bbox(
    jpeg_path: &Path,
    bbox: Option<&DetectionBox>,
) -> Result<(Option<u32>, FocusScoringMethod), AppError> {
    let img = image::open(jpeg_path).map_err(|e| {
        AppError::ImageProcessError(format!("无法加载图片 '{}': {}", jpeg_path.display(), e))
    })?;

    // 如果没有检测到鸟，返回 Undetected
    if bbox.is_none() {
        return Ok((None, FocusScoringMethod::Undetected));
    }

    // 有检测框，使用区域评分
    let score = score_from_image_with_bbox(&img, bbox.unwrap())?;
    Ok((Some(score), FocusScoringMethod::BirdRegion))
}

/// 在指定检测框内计算合焦评分
fn score_from_image_with_bbox(img: &image::DynamicImage, bbox: &DetectionBox) -> Result<u32, AppError> {
    // 转灰度 + 等比下采样
    let gray = img.grayscale();
    let resized = gray.resize(ANALYSIS_LONG_EDGE, ANALYSIS_LONG_EDGE, FilterType::Lanczos3);
    let luma = resized.to_luma8();

    // 应用 Laplacian 卷积
    let laplacian = apply_laplacian(&luma);

    // 在 bbox 区域内计算方差
    let robust_variance = evaluate_blocks_in_bbox(&laplacian, bbox)?;

    // 映射到 1-5 星
    Ok(variance_to_score(robust_variance))
}

/// 从 DynamicImage 计算合焦评分的核心逻辑
#[cfg(test)]
fn score_from_image(img: &image::DynamicImage) -> u32 {
    // 转灰度 + 等比下采样（保持宽高比，长边 = ANALYSIS_LONG_EDGE）
    let gray = img.grayscale();
    let resized = gray.resize(ANALYSIS_LONG_EDGE, ANALYSIS_LONG_EDGE, FilterType::Lanczos3);
    let luma = resized.to_luma8();

    // 应用 Laplacian 卷积
    let laplacian = apply_laplacian(&luma);

    // 分块评估，取 Top-K 的中位数
    let robust_variance = evaluate_blocks_robust(&laplacian);

    // 映射到 1-5 星
    variance_to_score(robust_variance)
}

/// 计算单个 JPEG 的合焦评分（从内存 JPEG 数据）
#[cfg(test)]
pub fn calculate_focus_score_from_memory(jpeg_data: &[u8]) -> Result<u32, AppError> {
    let img = image::load_from_memory(jpeg_data).map_err(|e| {
        AppError::ImageProcessError(format!("JPEG 解码失败: {}", e))
    })?;

    Ok(score_from_image(&img))
}

/// 应用 Laplacian 卷积（二阶梯度检测）
///
/// 不使用 padding，直接跳过边界像素（避免 0-padding 引入的伪边缘）
fn apply_laplacian(luma: &image::GrayImage) -> Vec<Vec<f32>> {
    let (width, height) = luma.dimensions();
    let w = width as usize;
    let h = height as usize;

    if w < 3 || h < 3 {
        return vec![vec![0.0]];
    }

    // 输出尺寸 = (w-2) × (h-2)，跳过边缘 1 像素
    let out_w = w - 2;
    let out_h = h - 2;
    let mut result = vec![vec![0.0f32; out_w]; out_h];

    for y in 0..out_h {
        for x in 0..out_w {
            let mut sum = 0.0f32;
            for ky in 0..3 {
                for kx in 0..3 {
                    let pixel = luma.get_pixel((x + kx) as u32, (y + ky) as u32).0[0] as f32;
                    sum += pixel * LAPLACIAN_KERNEL[ky][kx];
                }
            }
            result[y][x] = sum.abs();
        }
    }

    result
}

/// 分块评估：将图像分成 5×4 块，计算每块的方差
///
/// 返回 Top-K 块方差的中位数（比单纯取最大值更鲁棒）
///
/// 取中位数的好处：
/// - 抗噪点：单个高噪声区域不会拉高整体评分
/// - 抗纹理误导：砖墙/树叶等规则纹理不会被当作"极佳对焦"
/// - 同时仍然反映对焦最好区域的质量
#[cfg(test)]
fn evaluate_blocks_robust(laplacian: &[Vec<f32>]) -> f64 {
    let height = laplacian.len();
    if height == 0 {
        return 0.0;
    }
    let width = laplacian[0].len();
    if width == 0 {
        return 0.0;
    }

    let block_height = height / BLOCK_ROWS;
    let block_width = width / BLOCK_COLS;

    if block_height == 0 || block_width == 0 {
        return 0.0;
    }

    let mut block_variances = Vec::with_capacity(BLOCK_ROWS * BLOCK_COLS);

    for row_idx in 0..BLOCK_ROWS {
        for col_idx in 0..BLOCK_COLS {
            let y_start = row_idx * block_height;
            let y_end = if row_idx == BLOCK_ROWS - 1 {
                height
            } else {
                (row_idx + 1) * block_height
            };

            let x_start = col_idx * block_width;
            let x_end = if col_idx == BLOCK_COLS - 1 {
                width
            } else {
                (col_idx + 1) * block_width
            };

            let variance = calculate_block_variance(&laplacian[y_start..y_end], x_start, x_end);
            block_variances.push(variance);
        }
    }

    // 降序排列
    block_variances.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));

    // 取 Top-K 的中位数
    let k = TOP_K_BLOCKS.min(block_variances.len());
    if k == 0 {
        return 0.0;
    }
    let top_k = &block_variances[..k];
    top_k[k / 2] // 中位数
}

/// 在检测框内计算方差（区域合焦评分）
fn evaluate_blocks_in_bbox(
    laplacian: &[Vec<f32>],
    bbox: &DetectionBox,
) -> Result<f64, AppError> {
    let height = laplacian.len();
    if height == 0 {
        return Ok(0.0);
    }
    let width = laplacian[0].len();
    if width == 0 {
        return Ok(0.0);
    }

    // 将相对坐标 [0, 1] 映射到 Laplacian 图像坐标
    let x1_px = ((bbox.x1 as f32 * width as f32) as usize).max(0).min(width);
    let y1_px = ((bbox.y1 as f32 * height as f32) as usize).max(0).min(height);
    let x2_px = ((bbox.x2 as f32 * width as f32) as usize).max(0).min(width);
    let y2_px = ((bbox.y2 as f32 * height as f32) as usize).max(0).min(height);

    // 防止极小区域（< 10px²）
    let area = (x2_px - x1_px) * (y2_px - y1_px);
    if area < 10 {
        return Ok(0.0); // 太小，无法评分
    }

    // 在 bbox 区域内计算所有像素的方差
    let mut sum = 0.0f64;
    let mut sum_sq = 0.0f64;
    let mut count = 0usize;

    for y in y1_px..y2_px {
        for x in x1_px..x2_px {
            if x < width && y < height {
                let v = laplacian[y][x] as f64;
                sum += v;
                sum_sq += v * v;
                count += 1;
            }
        }
    }

    if count == 0 {
        return Ok(0.0);
    }

    let mean = sum / count as f64;
    // Var(X) = E[X²] - (E[X])²
    Ok((sum_sq / count as f64) - mean * mean)
}

/// 计算指定行范围和列范围内的方差
#[cfg(test)]
fn calculate_block_variance(rows: &[Vec<f32>], x_start: usize, x_end: usize) -> f64 {
    let mut sum = 0.0f64;
    let mut sum_sq = 0.0f64;
    let mut count = 0usize;

    for row in rows {
        for x in x_start..x_end {
            let v = row[x] as f64;
            sum += v;
            sum_sq += v * v;
            count += 1;
        }
    }

    if count == 0 {
        return 0.0;
    }

    let mean = sum / count as f64;
    // Var(X) = E[X²] - (E[X])²
    (sum_sq / count as f64) - mean * mean
}

/// 将方差映射到 1-5 星评级
///
/// 阈值基于 Nikon NEF 嵌入 JPEG（全尺寸预览）经 512px 下采样后的
/// Laplacian 方差分布调优。相机内 JPEG 经过锐化处理，方差值普遍偏高。
///
/// 参考值（Nikon D750, 85mm f/1.4）：
/// - 精准合焦：800-2000+
/// - 略微失焦：300-800
/// - 明显失焦：50-300
/// - 严重失焦：< 50
fn variance_to_score(variance: f64) -> u32 {
    if variance >= 1200.0 {
        5
    } else if variance >= 600.0 {
        4
    } else if variance >= 200.0 {
        3
    } else if variance >= 50.0 {
        2
    } else {
        1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::ImageFormat;
    use std::io::Cursor;

    /// 创建锐利的测试图像（高频内容）
    fn create_sharp_test_image(width: u32, height: u32) -> Vec<u8> {
        let mut img = image::RgbImage::new(width, height);
        for y in 0..height {
            for x in 0..width {
                // 棋盘图案：高频内容 = 高 Laplacian 响应
                let val = if (x / 10 + y / 10) % 2 == 0 { 255 } else { 0 };
                img.put_pixel(x, y, image::Rgb([val, val, val]));
            }
        }
        let dyn_img = image::DynamicImage::ImageRgb8(img);
        let mut buf = Cursor::new(Vec::new());
        dyn_img.write_to(&mut buf, ImageFormat::Jpeg).unwrap();
        buf.into_inner()
    }

    /// 创建模糊的测试图像（低频内容）
    fn create_blurred_test_image(width: u32, height: u32) -> Vec<u8> {
        let img = image::RgbImage::new(width, height);
        let dyn_img = image::DynamicImage::ImageRgb8(img);
        let mut buf = Cursor::new(Vec::new());
        dyn_img.write_to(&mut buf, ImageFormat::Jpeg).unwrap();
        buf.into_inner()
    }

    #[test]
    fn test_sharp_image_high_score() {
        let sharp_data = create_sharp_test_image(800, 600);
        let score = calculate_focus_score_from_memory(&sharp_data).unwrap();
        assert!(score >= 4, "Sharp image should score high, got {}", score);
    }

    #[test]
    fn test_blurred_image_low_score() {
        let blurred_data = create_blurred_test_image(800, 600);
        let score = calculate_focus_score_from_memory(&blurred_data).unwrap();
        assert!(score <= 2, "Blurred image should score low, got {}", score);
    }

    #[test]
    fn test_score_range() {
        let sharp_data = create_sharp_test_image(800, 600);
        let score = calculate_focus_score_from_memory(&sharp_data).unwrap();
        assert!(score >= 1 && score <= 5, "Score must be 1-5, got {}", score);
    }

    #[test]
    fn test_variance_to_score_boundaries() {
        assert_eq!(variance_to_score(2000.0), 5);
        assert_eq!(variance_to_score(1200.0), 5);
        assert_eq!(variance_to_score(800.0), 4);
        assert_eq!(variance_to_score(600.0), 4);
        assert_eq!(variance_to_score(400.0), 3);
        assert_eq!(variance_to_score(200.0), 3);
        assert_eq!(variance_to_score(100.0), 2);
        assert_eq!(variance_to_score(50.0), 2);
        assert_eq!(variance_to_score(30.0), 1);
    }

    #[test]
    fn test_invalid_jpeg_returns_error() {
        let result = calculate_focus_score_from_memory(&[0x00, 0x01, 0x02]);
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::ImageProcessError(_) => {}
            e => panic!("Expected ImageProcessError, got: {:?}", e),
        }
    }

    #[test]
    fn test_laplacian_kernel_properties() {
        let sum: f32 = LAPLACIAN_KERNEL
            .iter()
            .flat_map(|row| row.iter())
            .sum();
        assert_eq!(sum, 0.0, "Laplacian kernel sum should be 0");
    }

    #[test]
    fn test_proportional_resize() {
        // 验证 800x600 图像下采样后保持宽高比
        let data = create_sharp_test_image(800, 600);
        let img = image::load_from_memory(&data).unwrap();
        let resized = img.resize(ANALYSIS_LONG_EDGE, ANALYSIS_LONG_EDGE, FilterType::Lanczos3);
        // 长边 = 800，缩放到 512 → 512x384
        assert_eq!(resized.width(), 512);
        assert_eq!(resized.height(), 384);
    }

    // ── 3.6-3.12 区域评分和枚举序列化测试 ──

    /// 创建 DynamicImage（锐利棋盘纹理）
    fn create_sharp_dynamic_image(width: u32, height: u32) -> image::DynamicImage {
        let mut img = image::RgbImage::new(width, height);
        for y in 0..height {
            for x in 0..width {
                let val = if (x / 10 + y / 10) % 2 == 0 { 255 } else { 0 };
                img.put_pixel(x, y, image::Rgb([val, val, val]));
            }
        }
        image::DynamicImage::ImageRgb8(img)
    }

    /// 创建 DynamicImage（纯色模糊）
    fn create_blurred_dynamic_image(width: u32, height: u32) -> image::DynamicImage {
        let img = image::RgbImage::new(width, height);
        image::DynamicImage::ImageRgb8(img)
    }

    /// 创建混合图像：左半锐利（棋盘），右半模糊（纯灰色）
    fn create_mixed_dynamic_image(width: u32, height: u32) -> image::DynamicImage {
        let mut img = image::RgbImage::new(width, height);
        let mid_x = width / 2;
        for y in 0..height {
            for x in 0..width {
                let val = if x < mid_x {
                    // 左半：棋盘纹理
                    if (x / 10 + y / 10) % 2 == 0 { 255 } else { 0 }
                } else {
                    // 右半：纯灰色
                    128
                };
                img.put_pixel(x, y, image::Rgb([val, val, val]));
            }
        }
        image::DynamicImage::ImageRgb8(img)
    }

    /// 辅助函数：对 DynamicImage 做区域评分
    fn score_image_with_bbox(img: &image::DynamicImage, bbox: &DetectionBox) -> Result<u32, AppError> {
        score_from_image_with_bbox(img, bbox)
    }

    #[test]
    fn test_bbox_full_image_matches_full_image_score() {
        // 3.6: bbox 覆盖全图时评分与旧全画面算法结果一致
        let img = create_sharp_dynamic_image(800, 600);
        let full_score = score_from_image(&img);
        let bbox = DetectionBox {
            x1: 0.0, y1: 0.0, x2: 1.0, y2: 1.0,
            confidence: 0.9,
        };
        let region_score = score_image_with_bbox(&img, &bbox).unwrap();
        // 算法不完全相同（分块 vs 整体方差），但评分应在 ±1 星以内
        let diff = (full_score as i32 - region_score as i32).unsigned_abs();
        assert!(diff <= 1, "Full image score {} vs bbox full score {}, diff too large", full_score, region_score);
    }

    #[test]
    fn test_bbox_sharp_region_high_score() {
        // 3.7: bbox 覆盖锐利区域得分 >= 4
        let img = create_sharp_dynamic_image(800, 600);
        let bbox = DetectionBox {
            x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9,
            confidence: 0.9,
        };
        let score = score_image_with_bbox(&img, &bbox).unwrap();
        assert!(score >= 4, "Sharp region should score >= 4, got {}", score);
    }

    #[test]
    fn test_bbox_blurred_region_low_score() {
        // 3.8: bbox 覆盖模糊区域得分 <= 2
        let img = create_blurred_dynamic_image(800, 600);
        let bbox = DetectionBox {
            x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9,
            confidence: 0.9,
        };
        let score = score_image_with_bbox(&img, &bbox).unwrap();
        assert!(score <= 2, "Blurred region should score <= 2, got {}", score);
    }

    #[test]
    fn test_bbox_none_returns_undetected() {
        // 3.9: bbox 为 None 时返回 score=None, method=Undetected
        let sharp_data = create_sharp_test_image(800, 600);
        let tmp_dir = tempfile::tempdir().unwrap();
        let tmp_path = tmp_dir.path().join("test.jpg");
        std::fs::write(&tmp_path, &sharp_data).unwrap();

        let (score, method) = calculate_focus_score_with_bbox(&tmp_path, None).unwrap();
        assert_eq!(score, None, "No bbox should return None score");
        assert_eq!(method, FocusScoringMethod::Undetected);
    }

    #[test]
    fn test_bbox_tiny_area_no_panic() {
        // 3.10: bbox 极小区域（< 10px²）不 panic，返回合理评分或 fallback
        let img = create_sharp_dynamic_image(800, 600);
        let bbox = DetectionBox {
            x1: 0.5, y1: 0.5, x2: 0.501, y2: 0.501,
            confidence: 0.9,
        };
        // 应该不 panic，返回低评分（区域太小，方差为 0）
        let score = score_image_with_bbox(&img, &bbox).unwrap();
        assert!(score >= 1 && score <= 5, "Score must be valid 1-5, got {}", score);
    }

    #[test]
    fn test_bbox_out_of_bounds_clamp() {
        // 3.11: bbox 坐标越界（x2 > 1.0）时 clamp 到有效范围
        let img = create_sharp_dynamic_image(800, 600);
        let bbox = DetectionBox {
            x1: 0.8, y1: 0.8, x2: 1.5, y2: 1.5,
            confidence: 0.9,
        };
        // 应不 panic（evaluate_blocks_in_bbox 中 min(width) 约束）
        let result = score_image_with_bbox(&img, &bbox);
        assert!(result.is_ok(), "Out-of-bounds bbox should not panic");
    }

    #[test]
    fn test_focus_scoring_method_serialization() {
        // 3.12: FocusScoringMethod 枚举序列化
        let bird = FocusScoringMethod::BirdRegion;
        let json = serde_json::to_string(&bird).unwrap();
        assert_eq!(json, "\"BirdRegion\"");

        let undetected = FocusScoringMethod::Undetected;
        let json = serde_json::to_string(&undetected).unwrap();
        assert_eq!(json, "\"Undetected\"");

        let full = FocusScoringMethod::FullImage;
        let json = serde_json::to_string(&full).unwrap();
        assert_eq!(json, "\"FullImage\"");

        // 反序列化
        let deserialized: FocusScoringMethod = serde_json::from_str("\"BirdRegion\"").unwrap();
        assert_eq!(deserialized, FocusScoringMethod::BirdRegion);
    }

    #[test]
    fn test_bbox_with_bird_region_method() {
        // 验证 calculate_focus_score_with_bbox 正确返回 BirdRegion 方法
        let sharp_data = create_sharp_test_image(800, 600);
        let tmp_dir = tempfile::tempdir().unwrap();
        let tmp_path = tmp_dir.path().join("test.jpg");
        std::fs::write(&tmp_path, &sharp_data).unwrap();

        let bbox = DetectionBox {
            x1: 0.1, y1: 0.1, x2: 0.9, y2: 0.9,
            confidence: 0.9,
        };
        let (score, method) = calculate_focus_score_with_bbox(&tmp_path, Some(&bbox)).unwrap();
        assert!(score.is_some());
        assert_eq!(method, FocusScoringMethod::BirdRegion);
    }
}
