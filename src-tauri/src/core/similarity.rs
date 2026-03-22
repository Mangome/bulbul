//! 图像相似度计算
//!
//! 基于 pHash 的汉明距离计算图像对之间的相似度，
//! 包含 LRU 缓存避免重复计算。

use std::num::NonZeroUsize;
use std::path::Path;

use lru::LruCache;

use crate::core::phash;
use crate::models::AppError;
use crate::utils::paths::compute_path_hash;

/// 缓存默认容量
const DEFAULT_CACHE_CAPACITY: usize = 1000;

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

/// pHash 相似度 LRU 缓存
///
/// 使用有序 hash pair 作为 key，确保 `(A, B)` 和 `(B, A)` 命中同一条目
pub struct SimilarityCache {
    cache: LruCache<String, f64>,
    hits: u64,
    misses: u64,
}

impl SimilarityCache {
    /// 创建指定容量的相似度缓存
    pub fn new(capacity: usize) -> Self {
        Self {
            cache: LruCache::new(NonZeroUsize::new(capacity).expect("容量不能为 0")),
            hits: 0,
            misses: 0,
        }
    }

    /// 创建默认容量（1000）的相似度缓存
    pub fn with_default_capacity() -> Self {
        Self::new(DEFAULT_CACHE_CAPACITY)
    }

    /// 构建有序缓存 key：`"{min}:{max}"`
    fn make_key(path_hash1: &str, path_hash2: &str) -> String {
        if path_hash1 <= path_hash2 {
            format!("{}:{}", path_hash1, path_hash2)
        } else {
            format!("{}:{}", path_hash2, path_hash1)
        }
    }

    /// 查询缓存
    pub fn get(&mut self, path_hash1: &str, path_hash2: &str) -> Option<f64> {
        let key = Self::make_key(path_hash1, path_hash2);
        if let Some(&val) = self.cache.get(&key) {
            self.hits += 1;
            Some(val)
        } else {
            self.misses += 1;
            None
        }
    }

    /// 插入缓存
    pub fn put(&mut self, path_hash1: &str, path_hash2: &str, similarity: f64) {
        let key = Self::make_key(path_hash1, path_hash2);
        self.cache.put(key, similarity);
    }

    /// 获取缓存命中次数
    pub fn hits(&self) -> u64 {
        self.hits
    }

    /// 获取缓存未命中次数
    pub fn misses(&self) -> u64 {
        self.misses
    }

    /// 获取当前缓存条目数
    pub fn len(&self) -> usize {
        self.cache.len()
    }
}

/// 计算两张缩略图文件的相似度百分比
///
/// 内部流程：计算文件路径 hash → 查 LRU 缓存 → 未命中则计算 pHash → 汉明距离 → 相似度
pub fn compute_file_similarity(
    path1: &Path,
    path2: &Path,
    phash_cache: &mut std::collections::HashMap<String, u64>,
    similarity_cache: &mut SimilarityCache,
) -> Result<f64, AppError> {
    let path_hash1 = compute_path_hash(path1)?;
    let path_hash2 = compute_path_hash(path2)?;

    // 查相似度缓存
    if let Some(cached) = similarity_cache.get(&path_hash1, &path_hash2) {
        return Ok(cached);
    }

    // 获取或计算 pHash
    let phash1 = get_or_compute_phash(path1, &path_hash1, phash_cache)?;
    let phash2 = get_or_compute_phash(path2, &path_hash2, phash_cache)?;

    let sim = similarity(phash1, phash2);
    similarity_cache.put(&path_hash1, &path_hash2, sim);

    Ok(sim)
}

/// 从 pHash 缓存中获取或计算 pHash
fn get_or_compute_phash(
    path: &Path,
    path_hash: &str,
    phash_cache: &mut std::collections::HashMap<String, u64>,
) -> Result<u64, AppError> {
    if let Some(&cached) = phash_cache.get(path_hash) {
        return Ok(cached);
    }
    let hash = phash::compute_phash(path)?;
    phash_cache.insert(path_hash.to_string(), hash);
    Ok(hash)
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
        assert_eq!(
            hamming_distance(0x0000000000000000, 0xFFFFFFFFFFFFFFFF),
            64
        );
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
        assert_eq!(
            similarity(0x0000000000000000, 0xFFFFFFFFFFFFFFFF),
            0.0
        );
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

    #[test]
    fn test_cache_symmetric_query() {
        let mut cache = SimilarityCache::new(10);
        cache.put("hash_a", "hash_b", 95.0);

        // 正向查询
        assert_eq!(cache.get("hash_a", "hash_b"), Some(95.0));
        // 对称查询
        assert_eq!(cache.get("hash_b", "hash_a"), Some(95.0));
    }

    #[test]
    fn test_cache_hit_miss_stats() {
        let mut cache = SimilarityCache::new(10);

        // miss
        assert_eq!(cache.get("a", "b"), None);
        assert_eq!(cache.misses(), 1);
        assert_eq!(cache.hits(), 0);

        // put + hit
        cache.put("a", "b", 50.0);
        assert_eq!(cache.get("a", "b"), Some(50.0));
        assert_eq!(cache.hits(), 1);
        assert_eq!(cache.misses(), 1);
    }

    #[test]
    fn test_cache_eviction() {
        let mut cache = SimilarityCache::new(2);

        cache.put("a", "b", 90.0);
        cache.put("c", "d", 80.0);
        assert_eq!(cache.len(), 2);

        // 插入第 3 个，最久未使用的 (a,b) 被淘汰
        cache.put("e", "f", 70.0);
        assert_eq!(cache.len(), 2);
        assert_eq!(cache.get("a", "b"), None); // 已淘汰
        assert_eq!(cache.get("e", "f"), Some(70.0));
    }
}
