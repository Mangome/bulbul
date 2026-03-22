## ADDED Requirements

### Requirement: SessionState 结构体定义
系统 SHALL 定义 `SessionState` 结构体包含以下字段：current_folder (Option<PathBuf>)、filename_hash_map (HashMap<String, String>)、hash_filename_map (HashMap<String, String>)、hash_path_map (HashMap<String, PathBuf>)、metadata_cache (HashMap<String, ImageMetadata>)、group_result (Option<GroupResult>)、processing_state (ProcessingState)、cancel_flag (Arc<AtomicBool>)。

#### Scenario: SessionState 初始化
- **WHEN** 调用 `SessionState::new()` 或 `SessionState::default()`
- **THEN** current_folder SHALL 为 None，所有 HashMap SHALL 为空，processing_state SHALL 为 Idle，cancel_flag SHALL 为 false

### Requirement: SessionState 作为 Tauri 共享状态
系统 SHALL 使用 `tauri::State<Arc<Mutex<SessionState>>>` 类型在 Tauri Commands 间共享 SessionState。在 `lib.rs` 的 Tauri Builder 中 SHALL 通过 `.manage()` 注册。

#### Scenario: 多 Command 并发访问安全
- **WHEN** 两个 Tauri Command 同时尝试读取 SessionState
- **THEN** Mutex 保证串行化访问，无数据竞争

#### Scenario: State 在 Command 中可获取
- **WHEN** 一个 Tauri Command 声明参数 `state: tauri::State<'_, Arc<Mutex<SessionState>>>`
- **THEN** SHALL 能成功获取到锁并读写 SessionState
