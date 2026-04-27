## MODIFIED Requirements

### Requirement: SessionState 结构体定义
系统 SHALL 定义 `SessionState` 结构体包含以下字段：current_folder (Option<PathBuf>)、filename_hash_map (HashMap<String, String>)、hash_filename_map (HashMap<String, String>)、hash_path_map (HashMap<String, PathBuf>)、metadata_cache (HashMap<String, ImageMetadata>)、phash_cache (HashMap<String, u64>)、image_infos (Option<Vec<ImageInfoWithPhash>>)、group_result (Option<GroupResult>)、processing_state (ProcessingState)、cancel_flag (Arc<AtomicBool>)、cache_dir (PathBuf)、detection_cache (HashMap<String, DetectionCacheEntry>)、**process_results (Option<Vec<ProcessResult>>)**。

#### Scenario: SessionState 初始化
- **WHEN** 调用 `SessionState::new()` 或 `SessionState::default()`
- **THEN** current_folder SHALL 为 None，所有 HashMap SHALL 为空（包括 detection_cache），image_infos SHALL 为 None，processing_state SHALL 为 Idle，cancel_flag SHALL 为 false，cache_dir SHALL 为空 PathBuf，process_results SHALL 为 None

#### Scenario: 缓存恢复填充 SessionState
- **WHEN** 从磁盘缓存恢复处理结果
- **THEN** process_results SHALL 为 Some(Vec<ProcessResult>)，包含所有图片的处理结果，filename_hash_map、hash_filename_map、hash_path_map、metadata_cache、phash_cache SHALL 从缓存数据恢复

### Requirement: SessionState 重置方法
系统 SHALL 提供 `SessionState::reset()` 方法，在重新处理文件夹前清空所有映射和缓存数据，重置 processing_state 为 Idle，重置 cancel_flag 为 false。

#### Scenario: 重置后状态
- **WHEN** SessionState 已有处理结果后调用 `reset()`
- **THEN** 所有 HashMap SHALL 为空（包括 detection_cache），phash_cache SHALL 为空，image_infos SHALL 为 None，processing_state SHALL 为 Idle，cancel_flag SHALL 为 false，current_folder SHALL 为 None，group_result SHALL 为 None，process_results SHALL 为 None
