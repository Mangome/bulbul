//! 文件缓存管理
//!
//! 提供缓存目录创建、缓存命中检测、缓存文件异步写入等功能。

use std::path::{Path, PathBuf};

use crate::models::AppError;
use crate::utils::paths::get_cache_file_path;

/// 确保缓存子目录存在：`{cache_base_dir}/medium/` 和 `{cache_base_dir}/thumbnail/`
pub async fn ensure_cache_dirs(cache_base_dir: &Path) -> Result<(), AppError> {
    let medium_dir = cache_base_dir.join("medium");
    let thumbnail_dir = cache_base_dir.join("thumbnail");

    tokio::fs::create_dir_all(&medium_dir).await.map_err(|e| {
        AppError::CacheError(format!("无法创建 medium 缓存目录 '{}': {}", medium_dir.display(), e))
    })?;

    tokio::fs::create_dir_all(&thumbnail_dir)
        .await
        .map_err(|e| {
            AppError::CacheError(format!(
                "无法创建 thumbnail 缓存目录 '{}': {}",
                thumbnail_dir.display(),
                e
            ))
        })?;

    Ok(())
}

/// 检查给定 hash 的 medium 和 thumbnail 缓存文件是否同时存在
pub fn is_cached(cache_base_dir: &Path, hash: &str) -> bool {
    let medium_path = get_cache_file_path(cache_base_dir, hash, "medium");
    let thumbnail_path = get_cache_file_path(cache_base_dir, hash, "thumbnail");
    medium_path.exists() && thumbnail_path.exists()
}

/// 异步写入 medium JPEG 数据到缓存
pub async fn write_medium(
    cache_base_dir: &Path,
    hash: &str,
    data: &[u8],
) -> Result<PathBuf, AppError> {
    let path = get_cache_file_path(cache_base_dir, hash, "medium");
    tokio::fs::write(&path, data).await.map_err(|e| {
        AppError::CacheError(format!("写入 medium 缓存失败 '{}': {}", path.display(), e))
    })?;
    Ok(path)
}

/// 异步写入 thumbnail JPEG 数据到缓存
pub async fn write_thumbnail(
    cache_base_dir: &Path,
    hash: &str,
    data: &[u8],
) -> Result<PathBuf, AppError> {
    let path = get_cache_file_path(cache_base_dir, hash, "thumbnail");
    tokio::fs::write(&path, data).await.map_err(|e| {
        AppError::CacheError(format!("写入 thumbnail 缓存失败 '{}': {}", path.display(), e))
    })?;
    Ok(path)
}

/// 遍历 medium/ + thumbnail/ 子目录，返回 (总字节数, 文件数量)
///
/// 子目录不存在时视为 0 大小，不报错。
pub async fn get_cache_size(cache_base_dir: &Path) -> (u64, u64) {
    let mut total_size: u64 = 0;
    let mut file_count: u64 = 0;

    for subdir in &["medium", "thumbnail"] {
        let dir_path = cache_base_dir.join(subdir);
        let mut entries = match tokio::fs::read_dir(&dir_path).await {
            Ok(entries) => entries,
            Err(_) => continue, // 子目录不存在，跳过
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

/// 删除 medium/ + thumbnail/ 子目录下所有文件，保留目录结构
///
/// 忽略 NotFound 错误，其他 IO 错误返回 `AppError::CacheError`。
pub async fn clear_all_cache(cache_base_dir: &Path) -> Result<(), AppError> {
    for subdir in &["medium", "thumbnail"] {
        let dir_path = cache_base_dir.join(subdir);
        let mut entries = match tokio::fs::read_dir(&dir_path).await {
            Ok(entries) => entries,
            Err(_) => continue, // 子目录不存在，跳过
        };

        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if let Err(e) = tokio::fs::remove_file(&path).await {
                match e.kind() {
                    std::io::ErrorKind::NotFound => continue,
                    _ => {
                        return Err(AppError::CacheError(format!(
                            "删除缓存文件失败 '{}': {}",
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_ensure_cache_dirs_creates_directories() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");

        ensure_cache_dirs(&cache_base).await.unwrap();

        assert!(cache_base.join("medium").exists());
        assert!(cache_base.join("thumbnail").exists());
    }

    #[tokio::test]
    async fn test_ensure_cache_dirs_idempotent() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");

        ensure_cache_dirs(&cache_base).await.unwrap();
        // 二次调用不应报错
        ensure_cache_dirs(&cache_base).await.unwrap();

        assert!(cache_base.join("medium").exists());
        assert!(cache_base.join("thumbnail").exists());
    }

    #[tokio::test]
    async fn test_is_cached_both_exist() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        ensure_cache_dirs(&cache_base).await.unwrap();

        let hash = "abc123";
        tokio::fs::write(cache_base.join("medium").join("abc123.jpg"), b"medium_data")
            .await
            .unwrap();
        tokio::fs::write(
            cache_base.join("thumbnail").join("abc123.jpg"),
            b"thumb_data",
        )
        .await
        .unwrap();

        assert!(is_cached(&cache_base, hash));
    }

    #[tokio::test]
    async fn test_is_cached_partial_miss() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        ensure_cache_dirs(&cache_base).await.unwrap();

        // 仅写入 medium，缺少 thumbnail
        tokio::fs::write(cache_base.join("medium").join("partial.jpg"), b"data")
            .await
            .unwrap();

        assert!(!is_cached(&cache_base, "partial"));
    }

    #[tokio::test]
    async fn test_is_cached_complete_miss() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        ensure_cache_dirs(&cache_base).await.unwrap();

        assert!(!is_cached(&cache_base, "nonexistent"));
    }

    #[tokio::test]
    async fn test_write_medium() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        ensure_cache_dirs(&cache_base).await.unwrap();

        let data = b"fake jpeg medium data";
        let path = write_medium(&cache_base, "test_hash", data).await.unwrap();

        assert!(path.exists());
        let content = tokio::fs::read(&path).await.unwrap();
        assert_eq!(content, data);
    }

    #[tokio::test]
    async fn test_write_thumbnail() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        ensure_cache_dirs(&cache_base).await.unwrap();

        let data = b"fake jpeg thumbnail data";
        let path = write_thumbnail(&cache_base, "test_hash", data)
            .await
            .unwrap();

        assert!(path.exists());
        let content = tokio::fs::read(&path).await.unwrap();
        assert_eq!(content, data);
    }

    // ── get_cache_size 测试 ──

    #[tokio::test]
    async fn test_get_cache_size_with_files() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        ensure_cache_dirs(&cache_base).await.unwrap();

        // medium: 3 files, 1MB each
        for i in 0..3u8 {
            let data = vec![i; 1_048_576]; // 1MB
            tokio::fs::write(cache_base.join("medium").join(format!("h{i}.jpg")), &data)
                .await
                .unwrap();
        }
        // thumbnail: 3 files, 100KB each
        for i in 0..3u8 {
            let data = vec![i; 102_400]; // 100KB
            tokio::fs::write(cache_base.join("thumbnail").join(format!("h{i}.jpg")), &data)
                .await
                .unwrap();
        }

        let (total_size, file_count) = get_cache_size(&cache_base).await;
        assert_eq!(file_count, 6);
        assert_eq!(total_size, 3 * 1_048_576 + 3 * 102_400);
    }

    #[tokio::test]
    async fn test_get_cache_size_empty_dirs() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        ensure_cache_dirs(&cache_base).await.unwrap();

        let (total_size, file_count) = get_cache_size(&cache_base).await;
        assert_eq!(total_size, 0);
        assert_eq!(file_count, 0);
    }

    #[tokio::test]
    async fn test_get_cache_size_nonexistent_dirs() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        // 不创建目录

        let (total_size, file_count) = get_cache_size(&cache_base).await;
        assert_eq!(total_size, 0);
        assert_eq!(file_count, 0);
    }

    // ── clear_all_cache 测试 ──

    #[tokio::test]
    async fn test_clear_all_cache_deletes_files() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        ensure_cache_dirs(&cache_base).await.unwrap();

        // 创建缓存文件
        tokio::fs::write(cache_base.join("medium").join("a.jpg"), b"medium_a")
            .await
            .unwrap();
        tokio::fs::write(cache_base.join("thumbnail").join("a.jpg"), b"thumb_a")
            .await
            .unwrap();

        clear_all_cache(&cache_base).await.unwrap();

        // 文件应被删除
        assert!(!cache_base.join("medium/a.jpg").exists());
        assert!(!cache_base.join("thumbnail/a.jpg").exists());
        // 目录应保留
        assert!(cache_base.join("medium").is_dir());
        assert!(cache_base.join("thumbnail").is_dir());
    }

    #[tokio::test]
    async fn test_clear_all_cache_empty_dirs() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");
        ensure_cache_dirs(&cache_base).await.unwrap();

        // 空目录不应报错
        clear_all_cache(&cache_base).await.unwrap();
    }

    #[tokio::test]
    async fn test_clear_all_cache_nonexistent_dirs() {
        let dir = tempdir().unwrap();
        let cache_base = dir.path().join("bulbul");

        // 目录不存在不应报错
        clear_all_cache(&cache_base).await.unwrap();
    }
}
