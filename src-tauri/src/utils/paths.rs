//! 路径工具函数
//!
//! 提供文件路径规范化、MD5 哈希计算、缓存路径构建等辅助函数。

use std::path::{Path, PathBuf};

use crate::models::AppError;

/// 规范化文件路径为绝对路径，消除 `..`、`.`、符号链接等
pub fn canonicalize_path(path: &Path) -> Result<PathBuf, AppError> {
    std::fs::canonicalize(path).map_err(|e| {
        AppError::IoError(std::io::Error::new(
            e.kind(),
            format!("无法规范化路径 '{}': {}", path.display(), e),
        ))
    })
}

/// 计算文件路径的 MD5 哈希值
///
/// 先将路径规范化为绝对路径的 UTF-8 字符串，再计算 MD5，
/// 返回 32 字符十六进制小写字符串。
pub fn compute_path_hash(path: &Path) -> Result<String, AppError> {
    let canonical = canonicalize_path(path)?;
    let path_str = canonical.to_string_lossy();
    let digest = md5::compute(path_str.as_bytes());
    Ok(format!("{:x}", digest))
}

/// 获取应用缓存基础目录 `{app_cache_dir}/bulbul/`
pub fn get_cache_base_dir(app_cache_dir: &Path) -> PathBuf {
    app_cache_dir.join("bulbul")
}

/// 根据 hash 和类型构建完整缓存文件路径
///
/// 返回 `{cache_base_dir}/{size_type}/{hash}.jpg`
pub fn get_cache_file_path(cache_base_dir: &Path, hash: &str, size_type: &str) -> PathBuf {
    cache_base_dir.join(size_type).join(format!("{}.jpg", hash))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn test_canonicalize_path_existing_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.nef");
        File::create(&file_path).unwrap().write_all(b"test").unwrap();

        let result = canonicalize_path(&file_path).unwrap();
        assert!(result.is_absolute());
        assert!(result.exists());
    }

    #[test]
    fn test_canonicalize_path_nonexistent_file() {
        let result = canonicalize_path(Path::new("/nonexistent/path/file.nef"));
        assert!(result.is_err());
    }

    #[test]
    fn test_compute_path_hash_deterministic() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("IMG_001.nef");
        File::create(&file_path).unwrap().write_all(b"nef").unwrap();

        let hash1 = compute_path_hash(&file_path).unwrap();
        let hash2 = compute_path_hash(&file_path).unwrap();

        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 32);
        // 验证是十六进制小写
        assert!(hash1.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
    }

    #[test]
    fn test_compute_path_hash_different_paths() {
        let dir = tempdir().unwrap();
        let file1 = dir.path().join("a.nef");
        let file2 = dir.path().join("b.nef");
        File::create(&file1).unwrap().write_all(b"a").unwrap();
        File::create(&file2).unwrap().write_all(b"b").unwrap();

        let hash1 = compute_path_hash(&file1).unwrap();
        let hash2 = compute_path_hash(&file2).unwrap();

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_compute_path_hash_normalized_consistency() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("IMG_001.nef");
        File::create(&file_path).unwrap().write_all(b"nef").unwrap();

        // 通过 `./` 相对路径引用同一文件
        let relative_path = dir.path().join(".").join("IMG_001.nef");

        let hash1 = compute_path_hash(&file_path).unwrap();
        let hash2 = compute_path_hash(&relative_path).unwrap();

        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_get_cache_base_dir() {
        let cache_dir = Path::new("C:\\Users\\test\\AppData\\Local");
        let result = get_cache_base_dir(cache_dir);
        assert_eq!(result, PathBuf::from("C:\\Users\\test\\AppData\\Local\\bulbul"));
    }

    #[test]
    fn test_get_cache_file_path_medium() {
        let base = Path::new("/cache/bulbul");
        let result = get_cache_file_path(base, "abc123def456", "medium");
        assert_eq!(
            result,
            PathBuf::from("/cache/bulbul/medium/abc123def456.jpg")
        );
    }

    #[test]
    fn test_get_cache_file_path_thumbnail() {
        let base = Path::new("/cache/bulbul");
        let result = get_cache_file_path(base, "abc123def456", "thumbnail");
        assert_eq!(
            result,
            PathBuf::from("/cache/bulbul/thumbnail/abc123def456.jpg")
        );
    }
}
