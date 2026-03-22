use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::models::{GroupResult, ImageMetadata, ProcessingState};

/// 全局会话状态，跨 Command 共享
pub struct SessionState {
    pub current_folder: Option<PathBuf>,
    pub filename_hash_map: HashMap<String, String>,
    pub hash_filename_map: HashMap<String, String>,
    pub hash_path_map: HashMap<String, PathBuf>,
    pub metadata_cache: HashMap<String, ImageMetadata>,
    /// 文件路径 hash → pHash 感知哈希值的缓存
    pub phash_cache: HashMap<String, u64>,
    pub group_result: Option<GroupResult>,
    pub processing_state: ProcessingState,
    pub cancel_flag: Arc<AtomicBool>,
    pub cache_dir: PathBuf,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            current_folder: None,
            filename_hash_map: HashMap::new(),
            hash_filename_map: HashMap::new(),
            hash_path_map: HashMap::new(),
            metadata_cache: HashMap::new(),
            phash_cache: HashMap::new(),
            group_result: None,
            processing_state: ProcessingState::Idle,
            cancel_flag: Arc::new(AtomicBool::new(false)),
            cache_dir: PathBuf::new(),
        }
    }

    /// 使用指定的缓存目录创建 SessionState
    pub fn with_cache_dir(cache_dir: PathBuf) -> Self {
        Self {
            cache_dir,
            ..Self::new()
        }
    }

    /// 重置所有状态为初始值（用于重新处理文件夹前）
    ///
    /// 清空所有映射和缓存数据，重置 processing_state 为 Idle，
    /// 重置 cancel_flag 为 false。保留 cache_dir。
    pub fn reset(&mut self) {
        self.current_folder = None;
        self.filename_hash_map.clear();
        self.hash_filename_map.clear();
        self.hash_path_map.clear();
        self.metadata_cache.clear();
        self.phash_cache.clear();
        self.group_result = None;
        self.processing_state = ProcessingState::Idle;
        self.cancel_flag.store(false, Ordering::Relaxed);
    }
}

impl Default for SessionState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_state() {
        let state = SessionState::new();
        assert!(state.current_folder.is_none());
        assert!(state.filename_hash_map.is_empty());
        assert!(state.hash_filename_map.is_empty());
        assert!(state.hash_path_map.is_empty());
        assert!(state.metadata_cache.is_empty());
        assert!(state.phash_cache.is_empty());
        assert!(state.group_result.is_none());
        assert_eq!(state.processing_state, ProcessingState::Idle);
        assert!(!state.cancel_flag.load(Ordering::Relaxed));
        assert_eq!(state.cache_dir, PathBuf::new());
    }

    #[test]
    fn test_default_equals_new() {
        let state = SessionState::default();
        assert!(state.current_folder.is_none());
        assert!(state.filename_hash_map.is_empty());
        assert!(state.phash_cache.is_empty());
        assert_eq!(state.processing_state, ProcessingState::Idle);
        assert_eq!(state.cache_dir, PathBuf::new());
    }

    #[test]
    fn test_with_cache_dir() {
        let cache_dir = PathBuf::from("C:\\Users\\test\\AppData\\Local\\bulbul");
        let state = SessionState::with_cache_dir(cache_dir.clone());

        assert_eq!(state.cache_dir, cache_dir);
        assert!(state.current_folder.is_none());
        assert!(state.filename_hash_map.is_empty());
        assert!(state.phash_cache.is_empty());
        assert_eq!(state.processing_state, ProcessingState::Idle);
    }

    #[test]
    fn test_reset() {
        let mut state = SessionState::with_cache_dir(PathBuf::from("/cache"));

        // 填充一些数据
        state.current_folder = Some(PathBuf::from("/photos"));
        state.filename_hash_map.insert("a.nef".into(), "hash_a".into());
        state.hash_filename_map.insert("hash_a".into(), "a.nef".into());
        state.hash_path_map.insert("hash_a".into(), PathBuf::from("/photos/a.nef"));
        state.metadata_cache.insert("hash_a".into(), ImageMetadata::default());
        state.phash_cache.insert("hash_a".into(), 0xAAAA);
        state.processing_state = ProcessingState::Processing;
        state.cancel_flag.store(true, Ordering::Relaxed);

        // 重置
        state.reset();

        assert!(state.current_folder.is_none());
        assert!(state.filename_hash_map.is_empty());
        assert!(state.hash_filename_map.is_empty());
        assert!(state.hash_path_map.is_empty());
        assert!(state.metadata_cache.is_empty());
        assert!(state.phash_cache.is_empty());
        assert!(state.group_result.is_none());
        assert_eq!(state.processing_state, ProcessingState::Idle);
        assert!(!state.cancel_flag.load(Ordering::Relaxed));
        // cache_dir 应保留
        assert_eq!(state.cache_dir, PathBuf::from("/cache"));
    }

    #[test]
    fn test_reset_preserves_cache_dir() {
        let cache_dir = PathBuf::from("/my/cache/dir");
        let mut state = SessionState::with_cache_dir(cache_dir.clone());
        state.current_folder = Some(PathBuf::from("/photos"));
        state.phash_cache.insert("test".into(), 42);
        state.reset();
        assert_eq!(state.cache_dir, cache_dir);
        assert!(state.phash_cache.is_empty());
    }

    #[test]
    fn test_phash_cache_operations() {
        let mut state = SessionState::new();
        assert!(state.phash_cache.is_empty());

        state.phash_cache.insert("hash_a".into(), 0xDEADBEEF);
        assert_eq!(state.phash_cache.get("hash_a"), Some(&0xDEADBEEF));
        assert_eq!(state.phash_cache.len(), 1);

        state.phash_cache.insert("hash_b".into(), 0xCAFEBABE);
        assert_eq!(state.phash_cache.len(), 2);
    }
}
