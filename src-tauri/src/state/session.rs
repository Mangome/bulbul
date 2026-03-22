use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use crate::models::{GroupResult, ImageMetadata, ProcessingState};

/// 全局会话状态，跨 Command 共享
pub struct SessionState {
    pub current_folder: Option<PathBuf>,
    pub filename_hash_map: HashMap<String, String>,
    pub hash_filename_map: HashMap<String, String>,
    pub hash_path_map: HashMap<String, PathBuf>,
    pub metadata_cache: HashMap<String, ImageMetadata>,
    pub group_result: Option<GroupResult>,
    pub processing_state: ProcessingState,
    pub cancel_flag: Arc<AtomicBool>,
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            current_folder: None,
            filename_hash_map: HashMap::new(),
            hash_filename_map: HashMap::new(),
            hash_path_map: HashMap::new(),
            metadata_cache: HashMap::new(),
            group_result: None,
            processing_state: ProcessingState::Idle,
            cancel_flag: Arc::new(AtomicBool::new(false)),
        }
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
    use std::sync::atomic::Ordering;

    #[test]
    fn test_initial_state() {
        let state = SessionState::new();
        assert!(state.current_folder.is_none());
        assert!(state.filename_hash_map.is_empty());
        assert!(state.hash_filename_map.is_empty());
        assert!(state.hash_path_map.is_empty());
        assert!(state.metadata_cache.is_empty());
        assert!(state.group_result.is_none());
        assert_eq!(state.processing_state, ProcessingState::Idle);
        assert!(!state.cancel_flag.load(Ordering::Relaxed));
    }

    #[test]
    fn test_default_equals_new() {
        let state = SessionState::default();
        assert!(state.current_folder.is_none());
        assert!(state.filename_hash_map.is_empty());
        assert_eq!(state.processing_state, ProcessingState::Idle);
    }
}
