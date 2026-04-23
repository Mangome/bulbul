## MODIFIED Requirements

### Requirement: SessionState 结构体定义
系统 SHALL 定义 `SessionState` 结构体包含以下字段：current_folder (Option<PathBuf>)、filename_hash_map (HashMap<String, String>)、hash_filename_map (HashMap<String, String>)、hash_path_map (HashMap<String, PathBuf>)、metadata_cache (HashMap<String, ImageMetadata>)、phash_cache (HashMap<String, u64>)、image_infos (Option<Vec<ImageInfoWithPhash>>)、group_result (Option<GroupResult>)、processing_state (ProcessingState)、cancel_flag (Arc<AtomicBool>)、cache_dir (PathBuf)、detection_cache (HashMap<String, DetectionCacheEntry>)。

其中 DetectionCacheEntry 包含：score (Option<u32>)、method (FocusScoringMethod)、bboxes (Vec<DetectionBox>)。

#### Scenario: SessionState 初始化
- **WHEN** 调用 `SessionState::new()` 或 `SessionState::default()`
- **THEN** current_folder SHALL 为 None，所有 HashMap SHALL 为空（包括 detection_cache），image_infos SHALL 为 None，processing_state SHALL 为 Idle，cancel_flag SHALL 为 false，cache_dir SHALL 为空 PathBuf

#### Scenario: pHash 缓存读写
- **WHEN** 计算完一张图片的 pHash 后
- **THEN** 存入 `phash_cache`，key 为文件路径 hash，value 为 u64 pHash 值

#### Scenario: 处理流水线更新 SessionState
- **WHEN** `process_folder` 成功处理 N 个 NEF 文件
- **THEN** `filename_hash_map` SHALL 包含 N 个 filename→hash 映射，`hash_filename_map` SHALL 包含 N 个 hash→filename 映射，`hash_path_map` SHALL 包含 N 个 hash→path 映射，`metadata_cache` SHALL 包含 N 个 hash→ImageMetadata 映射，`image_infos` SHALL 包含 N 个 ImageInfoWithPhash 条目（已按 capture_time, filename 排序）

#### Scenario: 重复处理同一文件夹
- **WHEN** 对同一文件夹再次调用 `process_folder`
- **THEN** SHALL 清空之前的映射数据（包括 detection_cache），重新填充新的处理结果

#### Scenario: FocusScoring 写入 detection_cache
- **WHEN** FocusScoring 后台阶段完成一张照片的检测和分类
- **THEN** SHALL 将该照片的 (score, method, bboxes) 写入 detection_cache，key 为照片 hash

#### Scenario: reclassify 读取 detection_cache
- **WHEN** reclassify 命令被调用
- **THEN** SHALL 从 detection_cache 读取检测结果（bboxes），复用检测框仅重跑分类

#### Scenario: reclassify 更新 detection_cache
- **WHEN** reclassify 命令完成一张照片的重分类
- **THEN** SHALL 用新的分类结果（含更新后的 species_name 和 species_confidence）覆盖 detection_cache 中对应 hash 的 bboxes

### Requirement: SessionState 重置方法
系统 SHALL 提供 `SessionState::reset()` 方法，在重新处理文件夹前清空所有映射和缓存数据，重置 processing_state 为 Idle，重置 cancel_flag 为 false。

#### Scenario: 重置后状态
- **WHEN** SessionState 已有处理结果后调用 `reset()`
- **THEN** 所有 HashMap SHALL 为空（包括 detection_cache），phash_cache SHALL 为空，image_infos SHALL 为 None，processing_state SHALL 为 Idle，cancel_flag SHALL 为 false，current_folder SHALL 为 None，group_result SHALL 为 None
