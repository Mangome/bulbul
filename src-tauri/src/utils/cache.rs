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
}
