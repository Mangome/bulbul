//! 感知哈希（pHash）算法
//!
//! 基于 DCT-II（离散余弦变换）实现 64-bit 感知哈希，用于图像相似度比较。
//!
//! 算法流程：加载图片 → 转灰度 → Lanczos3 缩放到 9×8 → 2D DCT-II
//! → 取 8×8 低频系数 → 排除 DC 分量 → 与均值比较 → 生成 64-bit hash

use std::path::Path;

use image::imageops::FilterType;
use rustdct::DctPlanner;

use crate::models::AppError;

/// pHash 使用的矩阵行数（高度）
const MATRIX_ROWS: usize = 8;
/// pHash 使用的矩阵列数（宽度，DCT 行方向长度为 9）
const MATRIX_COLS: usize = 9;

/// 计算一张缩略图 JPEG 的感知哈希值
///
/// 输入：缩略图 JPEG 文件路径
/// 输出：64-bit 感知哈希值
///
/// 步骤：
/// 1. 加载图片 → 转灰度
/// 2. Lanczos3 缩放到 9×8
/// 3. 构建 f64 灰度矩阵 [8][9]
/// 4. 2D DCT-II 变换
/// 5. 取 8×8 低频系数，排除 DC 分量 [0][0]，与均值比较生成 64-bit hash
pub fn compute_phash(jpeg_path: &Path) -> Result<u64, AppError> {
    let img = image::open(jpeg_path).map_err(|e| {
        AppError::ImageProcessError(format!("无法加载图片 '{}': {}", jpeg_path.display(), e))
    })?;

    let gray = img.grayscale();
    let resized = gray.resize_exact(
        MATRIX_COLS as u32,
        MATRIX_ROWS as u32,
        FilterType::Lanczos3,
    );

    let luma = resized.to_luma8();
    let mut matrix = build_matrix(&luma);

    dct_2d(&mut matrix);

    Ok(generate_hash(&matrix))
}

/// 从 Luma8 图像构建 [8][9] 的 f64 矩阵
fn build_matrix(luma: &image::GrayImage) -> [[f64; MATRIX_COLS]; MATRIX_ROWS] {
    let mut matrix = [[0.0f64; MATRIX_COLS]; MATRIX_ROWS];
    for row in 0..MATRIX_ROWS {
        for col in 0..MATRIX_COLS {
            matrix[row][col] = luma.get_pixel(col as u32, row as u32).0[0] as f64;
        }
    }
    matrix
}

/// 2D DCT-II 变换：先对每行做 9-point DCT，再对每列做 8-point DCT
///
/// 原地修改矩阵为频域系数
fn dct_2d(matrix: &mut [[f64; MATRIX_COLS]; MATRIX_ROWS]) {
    let mut planner = DctPlanner::new();

    // 对每行做 9-point DCT-II
    let dct_row = planner.plan_dct2(MATRIX_COLS);
    for row in matrix.iter_mut() {
        dct_row.process_dct2(row);
    }

    // 对每列做 8-point DCT-II
    let dct_col = planner.plan_dct2(MATRIX_ROWS);
    for col_idx in 0..MATRIX_COLS {
        let mut col_data: Vec<f64> = (0..MATRIX_ROWS).map(|r| matrix[r][col_idx]).collect();
        dct_col.process_dct2(&mut col_data);
        for (r, val) in col_data.into_iter().enumerate() {
            matrix[r][col_idx] = val;
        }
    }
}

/// 从 DCT 系数矩阵生成 64-bit hash
///
/// 1. 取左上 8×8 区域
/// 2. 排除 DC 分量 [0][0]，计算剩余 63 个系数的均值
/// 3. 逐位比较：大于均值设为 1，否则设为 0
/// 4. 按行优先顺序从 [0][0] 到 [7][7] 生成 64-bit hash
fn generate_hash(matrix: &[[f64; MATRIX_COLS]; MATRIX_ROWS]) -> u64 {
    // 计算 8×8 区域中排除 [0][0] 的 63 个系数的均值
    let mut sum = 0.0f64;
    for row in 0..8 {
        for col in 0..8 {
            if row == 0 && col == 0 {
                continue;
            }
            sum += matrix[row][col];
        }
    }
    let mean = sum / 63.0;

    // 生成 64-bit hash：行优先，从高位到低位
    let mut hash: u64 = 0;
    for row in 0..8 {
        for col in 0..8 {
            hash <<= 1;
            if matrix[row][col] > mean {
                hash |= 1;
            }
        }
    }

    hash
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::ImageFormat;
    use std::io::Cursor;
    use tempfile::tempdir;

    /// 创建测试用 JPEG 文件，返回路径
    fn create_test_jpeg(dir: &Path, name: &str, width: u32, height: u32) -> std::path::PathBuf {
        let img = image::DynamicImage::new_rgb8(width, height);
        let path = dir.join(name);
        let mut buf = Cursor::new(Vec::new());
        img.write_to(&mut buf, ImageFormat::Jpeg).unwrap();
        std::fs::write(&path, buf.into_inner()).unwrap();
        path
    }

    /// 创建带有不同像素值的 JPEG
    fn create_colored_jpeg(
        dir: &Path,
        name: &str,
        width: u32,
        height: u32,
        r: u8,
        g: u8,
        b: u8,
    ) -> std::path::PathBuf {
        let mut img = image::RgbImage::new(width, height);
        for pixel in img.pixels_mut() {
            *pixel = image::Rgb([r, g, b]);
        }
        let dyn_img = image::DynamicImage::ImageRgb8(img);
        let path = dir.join(name);
        let mut buf = Cursor::new(Vec::new());
        dyn_img.write_to(&mut buf, ImageFormat::Jpeg).unwrap();
        std::fs::write(&path, buf.into_inner()).unwrap();
        path
    }

    #[test]
    fn test_same_image_same_hash() {
        let dir = tempdir().unwrap();
        let path = create_test_jpeg(dir.path(), "test.jpg", 200, 133);

        let hash1 = compute_phash(&path).unwrap();
        let hash2 = compute_phash(&path).unwrap();

        assert_eq!(hash1, hash2, "相同图片应产生相同 hash");
    }

    #[test]
    fn test_different_images_different_hash() {
        let dir = tempdir().unwrap();
        let path1 = create_colored_jpeg(dir.path(), "black.jpg", 200, 133, 0, 0, 0);
        let path2 = create_colored_jpeg(dir.path(), "white.jpg", 200, 133, 255, 255, 255);

        let hash1 = compute_phash(&path1).unwrap();
        let hash2 = compute_phash(&path2).unwrap();

        assert_ne!(hash1, hash2, "明显不同的图片应产生不同 hash");
    }

    #[test]
    fn test_invalid_path_returns_error() {
        let result = compute_phash(Path::new("/nonexistent/image.jpg"));
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::ImageProcessError(_) => {}
            e => panic!("Expected ImageProcessError, got: {:?}", e),
        }
    }

    #[test]
    fn test_matrix_dimensions() {
        let img = image::GrayImage::new(MATRIX_COLS as u32, MATRIX_ROWS as u32);
        let matrix = build_matrix(&img);
        assert_eq!(matrix.len(), MATRIX_ROWS);
        assert_eq!(matrix[0].len(), MATRIX_COLS);
    }

    #[test]
    fn test_matrix_values_in_range() {
        let dir = tempdir().unwrap();
        let path = create_colored_jpeg(dir.path(), "mid.jpg", 200, 133, 128, 128, 128);
        let img = image::open(&path).unwrap().grayscale();
        let resized = img.resize_exact(
            MATRIX_COLS as u32,
            MATRIX_ROWS as u32,
            FilterType::Lanczos3,
        );
        let luma = resized.to_luma8();
        let matrix = build_matrix(&luma);

        for row in &matrix {
            for &val in row.iter() {
                assert!(val >= 0.0 && val <= 255.0, "灰度值应在 0-255 范围内");
            }
        }
    }

    #[test]
    fn test_hash_is_u64() {
        let dir = tempdir().unwrap();
        let path = create_test_jpeg(dir.path(), "test.jpg", 200, 133);
        let hash = compute_phash(&path).unwrap();
        // u64 类型保证了是 64 位
        let _: u64 = hash;
    }
}
