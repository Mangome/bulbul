//! 图像相似度计算
//!
//! 基于 pHash 的汉明距离计算图像对之间的相似度百分比。

/// 计算两个 64-bit pHash 之间的汉明距离（不同位数）
pub fn hamming_distance(hash1: u64, hash2: u64) -> u32 {
    (hash1 ^ hash2).count_ones()
}

/// 将汉明距离转换为相似度百分比
///
/// 公式：`(1.0 - distance / 64.0) * 100.0`，精度保留 2 位小数
pub fn similarity(hash1: u64, hash2: u64) -> f64 {
    let distance = hamming_distance(hash1, hash2);
    let raw = (1.0 - distance as f64 / 64.0) * 100.0;
    (raw * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hamming_distance_identical() {
        assert_eq!(hamming_distance(0xABCD1234, 0xABCD1234), 0);
    }

    #[test]
    fn test_hamming_distance_all_different() {
        assert_eq!(hamming_distance(0x0000000000000000, 0xFFFFFFFFFFFFFFFF), 64);
    }

    #[test]
    fn test_hamming_distance_known_value() {
        // 差 1 位
        assert_eq!(hamming_distance(0b0000, 0b0001), 1);
        // 差 2 位
        assert_eq!(hamming_distance(0b0000, 0b0011), 2);
    }

    #[test]
    fn test_similarity_identical() {
        assert_eq!(similarity(42, 42), 100.0);
    }

    #[test]
    fn test_similarity_all_different() {
        assert_eq!(similarity(0x0000000000000000, 0xFFFFFFFFFFFFFFFF), 0.0);
    }

    #[test]
    fn test_similarity_known_distance_6() {
        // 构建 distance = 6 的两个 hash
        let h1: u64 = 0;
        let h2: u64 = 0b111111; // 6 位不同
        assert_eq!(hamming_distance(h1, h2), 6);

        let sim = similarity(h1, h2);
        // (1.0 - 6/64) * 100 = 90.625 → 保留 2 位小数 = 90.63
        assert!((sim - 90.63).abs() < 0.01, "Expected ~90.63, got {}", sim);
    }
}
