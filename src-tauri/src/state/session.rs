use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::core::grouping::ImageInfoWithPhash;
use crate::core::raw_processor::ProcessResult;
use crate::models::{DetectionCache, GroupResult, ImageMetadata, ProcessingState};

/// 全局会话状态，跨 Command 共享
pub struct SessionState {
    pub current_folder: Option<PathBuf>,
    pub filename_hash_map: HashMap<String, String>,
    pub hash_filename_map: HashMap<String, String>,
    pub hash_path_map: HashMap<String, PathBuf>,
    pub metadata_cache: HashMap<String, ImageMetadata>,
    /// 文件路径 hash → pHash 感知哈希值的缓存
    pub phash_cache: HashMap<String, u64>,
    /// 分组输入缓存（已排序），用于 regroup 时复用
    pub image_infos: Option<Vec<ImageInfoWithPhash>>,
    pub group_result: Option<GroupResult>,
    pub processing_state: ProcessingState,
    pub cancel_flag: Arc<AtomicBool>,
    pub cache_dir: PathBuf,
    /// 照片 hash → 检测结果缓存，供 reclassify 复用
    pub detection_cache: DetectionCache,
    /// 处理结果缓存（阶段 2 输出），用于缓存恢复
    pub process_results: Option<Vec<ProcessResult>>,
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
            image_infos: None,
            group_result: None,
            processing_state: ProcessingState::Idle,
            cancel_flag: Arc::new(AtomicBool::new(false)),
            cache_dir: PathBuf::new(),
            detection_cache: HashMap::new(),
            process_results: None,
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
        self.image_infos = None;
        self.group_result = None;
        self.processing_state = ProcessingState::Idle;
        self.cancel_flag.store(false, Ordering::Relaxed);
        self.detection_cache.clear();
        self.process_results = None;
    }

    /// 从缓存数据恢复 SessionState 的所有映射字段
    ///
    /// 从图片结果缓存和目录分组缓存中恢复 filename_hash_map、hash_filename_map、
    /// hash_path_map、metadata_cache、phash_cache、detection_cache、image_infos、
    /// group_result 和 process_results。
    pub fn restore_from_cache(
        &mut self,
        group_cache: &crate::models::DirectoryGroupCache,
        image_results: &[crate::models::ImageResultCache],
    ) {
        self.current_folder = Some(PathBuf::from(&group_cache.folder_path));
        self.group_result = Some(group_cache.group_result.clone());
        self.image_infos = Some(group_cache.image_infos.clone());

        let mut process_results = Vec::with_capacity(image_results.len());

        for irc in image_results {
            // 恢复映射
            self.filename_hash_map
                .insert(irc.filename.clone(), irc.hash.clone());
            self.hash_filename_map
                .insert(irc.hash.clone(), irc.filename.clone());
            self.hash_path_map
                .insert(irc.hash.clone(), PathBuf::from(&irc.file_path));
            self.metadata_cache
                .insert(irc.hash.clone(), irc.metadata.clone());

            if let Some(phash) = irc.phash {
                self.phash_cache.insert(irc.hash.clone(), phash);
            }

            // 恢复 detection_cache（focus_score_method 为 Some 表示 FocusScoring 已运行）
            if irc.metadata.focus_score_method.is_some() || !irc.metadata.detection_bboxes.is_empty() {
                self.detection_cache.insert(
                    irc.hash.clone(),
                    crate::models::DetectionCacheEntry {
                        score: irc.metadata.focus_score,
                        method: irc
                            .metadata
                            .focus_score_method
                            .clone()
                            .unwrap_or(crate::core::focus_score::FocusScoringMethod::Undetected),
                        bboxes: irc.metadata.detection_bboxes.clone(),
                    },
                );
            }

            // 构建 ProcessResult
            process_results.push(ProcessResult {
                hash: irc.hash.clone(),
                filename: irc.filename.clone(),
                file_path: irc.file_path.clone(),
                metadata: irc.metadata.clone(),
                medium_path: irc.medium_path.clone(),
                thumbnail_path: irc.thumbnail_path.clone(),
            });
        }

        self.process_results = Some(process_results);
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
        assert!(state.image_infos.is_none());
        assert!(state.group_result.is_none());
        assert_eq!(state.processing_state, ProcessingState::Idle);
        assert!(!state.cancel_flag.load(Ordering::Relaxed));
        assert!(state.detection_cache.is_empty());
        assert_eq!(state.cache_dir, PathBuf::new());
        assert!(state.process_results.is_none());
    }

    #[test]
    fn test_default_equals_new() {
        let state = SessionState::default();
        assert!(state.current_folder.is_none());
        assert!(state.filename_hash_map.is_empty());
        assert!(state.phash_cache.is_empty());
        assert!(state.image_infos.is_none());
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
        assert!(state.image_infos.is_none());
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
        assert!(state.image_infos.is_none());
        assert!(state.group_result.is_none());
        assert_eq!(state.processing_state, ProcessingState::Idle);
        assert!(!state.cancel_flag.load(Ordering::Relaxed));
        // cache_dir 应保留
        assert_eq!(state.cache_dir, PathBuf::from("/cache"));
        assert!(state.detection_cache.is_empty());
        assert!(state.process_results.is_none());
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
