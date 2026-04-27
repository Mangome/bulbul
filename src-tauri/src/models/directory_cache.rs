//! 目录结果缓存数据模型
//!
//! 定义图片级和目录级的缓存结构体，用于持久化处理流水线结果，
//! 避免重新打开同一目录时重复执行完整流水线。

use serde::{Deserialize, Serialize};

use crate::core::grouping::ImageInfoWithPhash;
use crate::core::raw_processor::ProcessResult;
use crate::models::{GroupResult, ImageMetadata};

/// 文件指纹，用于检测文件是否发生变化
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileFingerprint {
    /// 文件最后修改时间（Unix 时间戳秒）
    pub modified: f64,
    /// 文件大小（字节）
    pub size: u64,
}

/// 单张图片的处理结果缓存
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageResultCache {
    pub hash: String,
    pub filename: String,
    pub file_path: String,
    pub metadata: ImageMetadata,
    pub phash: Option<u64>,
    pub medium_path: String,
    pub thumbnail_path: String,
    pub fingerprint: FileFingerprint,
}

impl From<&ProcessResult> for ImageResultCache {
    fn from(result: &ProcessResult) -> Self {
        Self {
            hash: result.hash.clone(),
            filename: result.filename.clone(),
            file_path: result.file_path.clone(),
            metadata: result.metadata.clone(),
            phash: None,
            medium_path: result.medium_path.clone(),
            thumbnail_path: result.thumbnail_path.clone(),
            fingerprint: FileFingerprint {
                modified: 0.0,
                size: 0,
            },
        }
    }
}

/// 目录级分组缓存
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryGroupCache {
    pub folder_path: String,
    pub file_hashes: Vec<String>,
    pub group_result: GroupResult,
    pub image_infos: Vec<ImageInfoWithPhash>,
    pub cached_at: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{GroupData, PerformanceMetrics};

    fn make_test_metadata() -> ImageMetadata {
        ImageMetadata {
            capture_time: Some("2024:01:15 10:30:00".to_string()),
            camera_make: Some("Nikon".to_string()),
            camera_model: Some("Z9".to_string()),
            focus_score: Some(4),
            ..Default::default()
        }
    }

    #[test]
    fn test_file_fingerprint_serialize_roundtrip() {
        let fp = FileFingerprint {
            modified: 1705312200.0,
            size: 52_428_800,
        };

        let json = serde_json::to_string(&fp).unwrap();
        let restored: FileFingerprint = serde_json::from_str(&json).unwrap();

        assert!((restored.modified - fp.modified).abs() < f64::EPSILON);
        assert_eq!(restored.size, fp.size);
    }

    #[test]
    fn test_image_result_cache_serialize_roundtrip() {
        let cache = ImageResultCache {
            hash: "abc123".to_string(),
            filename: "IMG_001.nef".to_string(),
            file_path: "/photos/IMG_001.nef".to_string(),
            metadata: make_test_metadata(),
            phash: Some(0xABCD_1234_5678_9ABC),
            medium_path: "/cache/medium/abc123.jpg".to_string(),
            thumbnail_path: "/cache/thumbnail/abc123.jpg".to_string(),
            fingerprint: FileFingerprint {
                modified: 1705312200.0,
                size: 52_428_800,
            },
        };

        let json = serde_json::to_string(&cache).unwrap();
        let restored: ImageResultCache = serde_json::from_str(&json).unwrap();

        assert_eq!(restored.hash, "abc123");
        assert_eq!(restored.filename, "IMG_001.nef");
        assert_eq!(restored.phash, Some(0xABCD_1234_5678_9ABC));
        assert_eq!(restored.metadata.camera_make, Some("Nikon".to_string()));
        assert_eq!(restored.fingerprint.size, 52_428_800);
    }

    #[test]
    fn test_image_result_cache_phash_none() {
        let cache = ImageResultCache {
            hash: "def456".to_string(),
            filename: "IMG_002.nef".to_string(),
            file_path: "/photos/IMG_002.nef".to_string(),
            metadata: ImageMetadata::default(),
            phash: None,
            medium_path: "/cache/medium/def456.jpg".to_string(),
            thumbnail_path: "/cache/thumbnail/def456.jpg".to_string(),
            fingerprint: FileFingerprint {
                modified: 0.0,
                size: 0,
            },
        };

        let json = serde_json::to_string(&cache).unwrap();
        let restored: ImageResultCache = serde_json::from_str(&json).unwrap();

        assert_eq!(restored.phash, None);
    }

    #[test]
    fn test_directory_group_cache_serialize_roundtrip() {
        let group = GroupData {
            id: 0,
            name: "Group 1".to_string(),
            image_count: 2,
            avg_similarity: 0.95,
            representative_hash: "h1".to_string(),
            picture_hashes: vec!["h1".to_string(), "h2".to_string()],
            picture_names: vec!["a.nef".to_string(), "b.nef".to_string()],
            picture_paths: vec!["/a.nef".to_string(), "/b.nef".to_string()],
        };

        let cache = DirectoryGroupCache {
            folder_path: "/photos/birds".to_string(),
            file_hashes: vec!["h1".to_string(), "h2".to_string()],
            group_result: GroupResult {
                groups: vec![group],
                total_images: 2,
                total_groups: 1,
                processed_files: 2,
                performance: PerformanceMetrics {
                    total_time_ms: 1000.0,
                    scan_time_ms: 100.0,
                    process_time_ms: 500.0,
                    similarity_time_ms: 200.0,
                    grouping_time_ms: 50.0,
                },
            },
            image_infos: vec![],
            cached_at: "2026-04-27T12:00:00".to_string(),
        };

        let json = serde_json::to_string(&cache).unwrap();
        let restored: DirectoryGroupCache = serde_json::from_str(&json).unwrap();

        assert_eq!(restored.folder_path, "/photos/birds");
        assert_eq!(restored.file_hashes.len(), 2);
        assert_eq!(restored.group_result.total_images, 2);
        assert_eq!(restored.cached_at, "2026-04-27T12:00:00");
    }
}
