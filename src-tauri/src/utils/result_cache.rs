//! 处理结果缓存读写
//!
//! 提供图片级 (`result/{hash}.json`) 和目录级 (`groups/{dir_hash}.json`) 缓存的
//! 加载、保存、删除和清理功能。

use std::path::Path;

use crate::models::directory_cache::{DirectoryGroupCache, ImageResultCache};
use crate::models::AppError;
use crate::utils::paths::compute_path_hash;

// ── 图片结果缓存 ──

/// 加载指定 hash 的图片结果缓存
///
/// 缓存不存在时返回 None，反序列化失败时也返回 None（降级为完整流水线）
pub async fn load_image_result(cache_dir: &Path, hash: &str) -> Option<ImageResultCache> {
    let path = cache_dir.join("result").join(format!("{}.json", hash));
    let data = tokio::fs::read(&path).await.ok()?;
    serde_json::from_slice(&data).ok()
}

/// 保存图片结果缓存到 `$CACHE_DIR/bulbul/result/{hash}.json`
pub async fn save_image_result(
    cache_dir: &Path,
    hash: &str,
    result: &ImageResultCache,
) -> Result<(), AppError> {
    let path = cache_dir.join("result").join(format!("{}.json", hash));
    let data = serde_json::to_vec(result).map_err(|e| {
        AppError::CacheError(format!("序列化图片结果缓存失败 '{}': {}", hash, e))
    })?;
    tokio::fs::write(&path, &data).await.map_err(|e| {
        AppError::CacheError(format!(
            "写入图片结果缓存失败 '{}': {}",
            path.display(),
            e
        ))
    })
}

/// 删除指定 hash 的图片结果缓存
#[allow(dead_code)] // 公共 API，供未来缓存管理命令使用
pub async fn delete_image_result(cache_dir: &Path, hash: &str) -> Result<(), AppError> {
    let path = cache_dir.join("result").join(format!("{}.json", hash));
    if path.exists() {
        tokio::fs::remove_file(&path).await.map_err(|e| {
            AppError::CacheError(format!(
                "删除图片结果缓存失败 '{}': {}",
                path.display(),
                e
            ))
        })?;
    }
    Ok(())
}

// ── 目录分组缓存 ──

/// 加载目录分组缓存
///
/// 缓存不存在或反序列化失败时返回 None
pub async fn load_group_cache(cache_dir: &Path, folder_path: &str) -> Option<DirectoryGroupCache> {
    let dir_hash = compute_path_hash(Path::new(folder_path)).ok()?;
    let path = cache_dir.join("groups").join(format!("{}.json", dir_hash));
    let data = tokio::fs::read(&path).await.ok()?;
    serde_json::from_slice(&data).ok()
}

/// 保存目录分组缓存到 `$CACHE_DIR/bulbul/groups/{MD5(dir_path)}.json`
pub async fn save_group_cache(
    cache_dir: &Path,
    folder_path: &str,
    cache: &DirectoryGroupCache,
) -> Result<(), AppError> {
    let dir_hash = compute_path_hash(Path::new(folder_path)).map_err(|e| {
        AppError::CacheError(format!("计算目录路径哈希失败 '{}': {}", folder_path, e))
    })?;
    let path = cache_dir.join("groups").join(format!("{}.json", dir_hash));
    let data = serde_json::to_vec(cache).map_err(|e| {
        AppError::CacheError(format!("序列化目录分组缓存失败 '{}': {}", folder_path, e))
    })?;
    tokio::fs::write(&path, &data).await.map_err(|e| {
        AppError::CacheError(format!(
            "写入目录分组缓存失败 '{}': {}",
            path.display(),
            e
        ))
    })
}

/// 删除目录分组缓存
#[allow(dead_code)] // 公共 API，供未来缓存管理命令使用
pub async fn delete_group_cache(cache_dir: &Path, folder_path: &str) -> Result<(), AppError> {
    let dir_hash = compute_path_hash(Path::new(folder_path)).map_err(|e| {
        AppError::CacheError(format!("计算目录路径哈希失败 '{}': {}", folder_path, e))
    })?;
    let path = cache_dir.join("groups").join(format!("{}.json", dir_hash));
    if path.exists() {
        tokio::fs::remove_file(&path).await.map_err(|e| {
            AppError::CacheError(format!(
                "删除目录分组缓存失败 '{}': {}",
                path.display(),
                e
            ))
        })?;
    }
    Ok(())
}

// ── 批量清理与统计 ──

/// 删除 `result/` 和 `groups/` 子目录下所有文件，保留目录结构
#[allow(dead_code)] // 公共 API，供未来缓存管理命令使用
pub async fn clear_all_result_caches(cache_dir: &Path) -> Result<(), AppError> {
    for subdir in &["result", "groups"] {
        let dir_path = cache_dir.join(subdir);
        let mut entries = match tokio::fs::read_dir(&dir_path).await {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if let Err(e) = tokio::fs::remove_file(&path).await {
                match e.kind() {
                    std::io::ErrorKind::NotFound => continue,
                    _ => {
                        return Err(AppError::CacheError(format!(
                            "删除结果缓存文件失败 '{}': {}",
                            path.display(),
                            e
                        )))
                    }
                }
            }
        }
    }

    Ok(())
}

/// 统计 `result/` 和 `groups/` 子目录的缓存大小
///
/// 返回 (总字节数, 文件数量)
#[allow(dead_code)] // 公共 API，供未来缓存管理命令使用
pub async fn get_result_cache_size(cache_dir: &Path) -> (u64, u64) {
    let mut total_size: u64 = 0;
    let mut file_count: u64 = 0;

    for subdir in &["result", "groups"] {
        let dir_path = cache_dir.join(subdir);
        let mut entries = match tokio::fs::read_dir(&dir_path).await {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(metadata) = entry.metadata().await {
                if metadata.is_file() {
                    total_size += metadata.len();
                    file_count += 1;
                }
            }
        }
    }

    (total_size, file_count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{GroupData, GroupResult, PerformanceMetrics};
    use tempfile::tempdir;

    fn make_test_image_result(hash: &str) -> ImageResultCache {
        ImageResultCache {
            hash: hash.to_string(),
            filename: format!("{}.nef", hash),
            file_path: format!("/photos/{}.nef", hash),
            metadata: Default::default(),
            phash: Some(0xABCD),
            medium_path: format!("/cache/medium/{}.jpg", hash),
            thumbnail_path: format!("/cache/thumbnail/{}.jpg", hash),
            fingerprint: crate::models::directory_cache::FileFingerprint {
                modified: 1705312200.0,
                size: 52_428_800,
            },
        }
    }

    #[tokio::test]
    async fn test_save_and_load_image_result() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("bulbul");
        tokio::fs::create_dir_all(cache_dir.join("result"))
            .await
            .unwrap();

        let result = make_test_image_result("abc123");
        save_image_result(&cache_dir, "abc123", &result)
            .await
            .unwrap();

        let loaded = load_image_result(&cache_dir, "abc123").await;
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.hash, "abc123");
        assert_eq!(loaded.phash, Some(0xABCD));
        assert_eq!(loaded.fingerprint.size, 52_428_800);
    }

    #[tokio::test]
    async fn test_load_image_result_not_found() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("bulbul");
        tokio::fs::create_dir_all(cache_dir.join("result"))
            .await
            .unwrap();

        let loaded = load_image_result(&cache_dir, "nonexistent").await;
        assert!(loaded.is_none());
    }

    #[tokio::test]
    async fn test_delete_image_result() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("bulbul");
        tokio::fs::create_dir_all(cache_dir.join("result"))
            .await
            .unwrap();

        let result = make_test_image_result("del_me");
        save_image_result(&cache_dir, "del_me", &result)
            .await
            .unwrap();
        delete_image_result(&cache_dir, "del_me").await.unwrap();
        assert!(load_image_result(&cache_dir, "del_me").await.is_none());
    }

    #[tokio::test]
    async fn test_delete_image_result_nonexistent() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("bulbul");
        tokio::fs::create_dir_all(cache_dir.join("result"))
            .await
            .unwrap();

        // 不存在时不报错
        delete_image_result(&cache_dir, "ghost").await.unwrap();
    }

    #[tokio::test]
    async fn test_save_and_load_group_cache() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("bulbul");
        tokio::fs::create_dir_all(cache_dir.join("groups"))
            .await
            .unwrap();

        // 创建真实文件以使 compute_path_hash 成功
        let folder_path = dir.path().join("birds");
        tokio::fs::create_dir_all(&folder_path).await.unwrap();

        let cache = DirectoryGroupCache {
            folder_path: folder_path.to_string_lossy().to_string(),
            file_hashes: vec!["h1".to_string()],
            group_result: GroupResult {
                groups: vec![GroupData {
                    id: 0,
                    name: "G1".to_string(),
                    image_count: 1,
                    avg_similarity: 100.0,
                    representative_hash: "h1".to_string(),
                    picture_hashes: vec!["h1".to_string()],
                    picture_names: vec!["a.nef".to_string()],
                    picture_paths: vec!["/a.nef".to_string()],
                }],
                total_images: 1,
                total_groups: 1,
                processed_files: 1,
                performance: PerformanceMetrics {
                    total_time_ms: 100.0,
                    scan_time_ms: 10.0,
                    process_time_ms: 50.0,
                    similarity_time_ms: 20.0,
                    grouping_time_ms: 5.0,
                },
            },
            image_infos: vec![],
            cached_at: "2026-04-27T12:00:00".to_string(),
        };

        let folder_str = folder_path.to_string_lossy().to_string();
        save_group_cache(&cache_dir, &folder_str, &cache)
            .await
            .unwrap();

        let loaded = load_group_cache(&cache_dir, &folder_str).await;
        assert!(loaded.is_some());
        let loaded = loaded.unwrap();
        assert_eq!(loaded.group_result.total_images, 1);
        assert_eq!(loaded.cached_at, "2026-04-27T12:00:00");
    }

    #[tokio::test]
    async fn test_load_group_cache_not_found() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("bulbul");
        tokio::fs::create_dir_all(cache_dir.join("groups"))
            .await
            .unwrap();

        let folder_path = dir.path().join("nonexistent");
        let loaded = load_group_cache(&cache_dir, &folder_path.to_string_lossy()).await;
        assert!(loaded.is_none());
    }

    #[tokio::test]
    async fn test_clear_all_result_caches() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("bulbul");
        tokio::fs::create_dir_all(cache_dir.join("result"))
            .await
            .unwrap();
        tokio::fs::create_dir_all(cache_dir.join("groups"))
            .await
            .unwrap();

        // 写入一些缓存文件
        let result = make_test_image_result("clear_test");
        save_image_result(&cache_dir, "clear_test", &result)
            .await
            .unwrap();
        tokio::fs::write(cache_dir.join("groups").join("test.json"), b"{}")
            .await
            .unwrap();

        clear_all_result_caches(&cache_dir).await.unwrap();

        assert!(load_image_result(&cache_dir, "clear_test").await.is_none());
        assert!(!cache_dir.join("groups/test.json").exists());
        // 目录保留
        assert!(cache_dir.join("result").is_dir());
        assert!(cache_dir.join("groups").is_dir());
    }

    #[tokio::test]
    async fn test_get_result_cache_size() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("bulbul");
        tokio::fs::create_dir_all(cache_dir.join("result"))
            .await
            .unwrap();
        tokio::fs::create_dir_all(cache_dir.join("groups"))
            .await
            .unwrap();

        let result = make_test_image_result("size_test");
        save_image_result(&cache_dir, "size_test", &result)
            .await
            .unwrap();

        let (total_size, file_count) = get_result_cache_size(&cache_dir).await;
        assert!(total_size > 0);
        assert_eq!(file_count, 1);
    }

    #[tokio::test]
    async fn test_get_result_cache_size_empty() {
        let dir = tempdir().unwrap();
        let cache_dir = dir.path().join("bulbul");
        tokio::fs::create_dir_all(cache_dir.join("result"))
            .await
            .unwrap();
        tokio::fs::create_dir_all(cache_dir.join("groups"))
            .await
            .unwrap();

        let (total_size, file_count) = get_result_cache_size(&cache_dir).await;
        assert_eq!(total_size, 0);
        assert_eq!(file_count, 0);
    }
}
