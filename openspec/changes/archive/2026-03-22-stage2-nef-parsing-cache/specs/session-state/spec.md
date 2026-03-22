## MODIFIED Requirements

### Requirement: SessionState 结构体定义
系统 SHALL 定义 `SessionState` 结构体包含以下字段：current_folder (Option<PathBuf>)、filename_hash_map (HashMap<String, String>)、hash_filename_map (HashMap<String, String>)、hash_path_map (HashMap<String, PathBuf>)、metadata_cache (HashMap<String, ImageMetadata>)、group_result (Option<GroupResult>)、processing_state (ProcessingState)、cancel_flag (Arc<AtomicBool>)、cache_dir (PathBuf)。新增 `cache_dir` 字段用于存储应用缓存基础目录路径。

#### Scenario: SessionState 初始化
- **WHEN** 调用 `SessionState::new()` 或 `SessionState::default()`
- **THEN** current_folder SHALL 为 None，所有 HashMap SHALL 为空，processing_state SHALL 为 Idle，cancel_flag SHALL 为 false，cache_dir SHALL 为空 PathBuf

#### Scenario: 处理流水线更新 SessionState
- **WHEN** `process_folder` 成功处理 N 个 NEF 文件
- **THEN** `filename_hash_map` SHALL 包含 N 个 filename→hash 映射，`hash_filename_map` SHALL 包含 N 个 hash→filename 映射，`hash_path_map` SHALL 包含 N 个 hash→path 映射，`metadata_cache` SHALL 包含 N 个 hash→ImageMetadata 映射

#### Scenario: 重复处理同一文件夹
- **WHEN** 对同一文件夹再次调用 `process_folder`
- **THEN** SHALL 清空之前的映射数据，重新填充新的处理结果

## ADDED Requirements

### Requirement: SessionState 重置方法
系统 SHALL 提供 `SessionState::reset()` 方法，在重新处理文件夹前清空所有映射和缓存数据，重置 processing_state 为 Idle，重置 cancel_flag 为 false。

#### Scenario: 重置后状态
- **WHEN** SessionState 已有处理结果后调用 `reset()`
- **THEN** 所有 HashMap SHALL 为空，processing_state SHALL 为 Idle，cancel_flag SHALL 为 false，current_folder SHALL 为 None

### Requirement: SessionState 初始化时设置缓存目录
系统 SHALL 提供 `SessionState::with_cache_dir(cache_dir: PathBuf)` 构造方法，在应用启动时通过 Tauri 路径 API 获取缓存目录并传入。

#### Scenario: 带缓存目录初始化
- **WHEN** 调用 `SessionState::with_cache_dir(PathBuf::from("C:\\Users\\test\\AppData\\Local\\bulbul"))`
- **THEN** `cache_dir` SHALL 为传入的路径，其余字段 SHALL 为默认值
