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

use crate::models::AppError;

/// 分块尺寸（行数）
const BLOCK_ROWS: usize = 4;
/// 分块尺寸（列数）
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
const TOP_K_BLOCKS: usize = 3;

/// 从 JPEG 路径计算合焦评分
///
/// 返回 1-5 的评分
pub fn calculate_focus_score(jpeg_path: &Path) -> Result<u32, AppError> {
    let img = image::open(jpeg_path).map_err(|e| {
        AppError::ImageProcessError(format!("无法加载图片 '{}': {}", jpeg_path.display(), e))
    })?;

    Ok(score_from_image(&img))
}

/// 计算单个 JPEG 的合焦评分（从内存 JPEG 数据）
#[cfg(test)]
pub fn calculate_focus_score_from_memory(jpeg_data: &[u8]) -> Result<u32, AppError> {
    let img = image::load_from_memory(jpeg_data).map_err(|e| {
        AppError::ImageProcessError(format!("JPEG 解码失败: {}", e))
    })?;

    Ok(score_from_image(&img))
}

/// 从 DynamicImage 计算合焦评分的核心逻辑
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

/// 计算指定行范围和列范围内的方差
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
}
