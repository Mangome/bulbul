## ADDED Requirements

### Requirement: ImageMetadata 结构体定义
系统 SHALL 定义 `ImageMetadata` 结构体，包含时间（capture_time, modify_time）、相机（camera_make, camera_model, serial_number）、镜头（lens_model, lens_serial, focal_length）、曝光（f_number, exposure_time, iso_speed）、闪光灯（flash_fired, flash_mode）、测光（exposure_mode, metering_mode, exposure_compensation）、白平衡（white_balance, color_space）、图像（image_width, image_height, orientation）、GPS（gps_latitude, gps_longitude, gps_altitude）、文件（file_size, compression）全部字段，所有字段 SHALL 使用 `Option<T>` 包装，结构体 SHALL 派生 `Debug, Clone, Serialize, Deserialize`。

#### Scenario: ImageMetadata 序列化为 JSON
- **WHEN** 创建一个包含部分字段值的 `ImageMetadata` 实例并序列化为 JSON
- **THEN** JSON 输出包含所有设置的字段值，未设置的 Option 字段序列化为 `null`

#### Scenario: ImageMetadata 从 JSON 反序列化
- **WHEN** 提供一个包含部分字段的 JSON 字符串
- **THEN** 成功反序列化为 `ImageMetadata`，缺失字段自动填充为 `None`

#### Scenario: ImageMetadata 默认值
- **WHEN** 创建 `ImageMetadata` 的 Default 实例
- **THEN** 所有字段 SHALL 为 `None`

### Requirement: GroupData 和 GroupResult 结构体定义
系统 SHALL 定义 `GroupData` 结构体（id: u32, name: String, image_count: usize, avg_similarity: f64, representative_hash: String, picture_hashes: Vec<String>, picture_names: Vec<String>, picture_paths: Vec<String>）和 `GroupResult` 结构体（groups: Vec<GroupData>, total_images: usize, total_groups: usize, processed_files: usize, performance: PerformanceMetrics）。`PerformanceMetrics` SHALL 包含 total_time_ms, scan_time_ms, process_time_ms, similarity_time_ms, grouping_time_ms 字段（均为 f64）。所有结构体 SHALL 派生 `Debug, Clone, Serialize, Deserialize`。

#### Scenario: GroupData 序列化往返
- **WHEN** 创建 `GroupData` 实例，序列化为 JSON 后再反序列化
- **THEN** 反序列化结果与原始实例全部字段值相等

#### Scenario: GroupResult 包含性能指标
- **WHEN** 创建包含多个 GroupData 的 GroupResult
- **THEN** `total_groups` 等于 `groups.len()`，`performance` 中各时间字段 SHALL ≥ 0.0

### Requirement: ProcessingState 枚举和 ProcessingProgress 结构体
系统 SHALL 定义 `ProcessingState` 枚举包含 Idle、Scanning、Processing、Analyzing、Grouping、Completed、Cancelling、Cancelled、Error 九个变体，使用 `#[serde(rename_all = "snake_case")]` 序列化。系统 SHALL 定义 `ProcessingProgress` 结构体包含 state、current、total、progress_percent、message、current_file、elapsed_ms、estimated_remaining_ms 字段。

#### Scenario: ProcessingState 序列化为 snake_case
- **WHEN** 将 `ProcessingState::Scanning` 序列化为 JSON
- **THEN** 输出 SHALL 为 `"scanning"`

#### Scenario: ProcessingProgress 完整序列化
- **WHEN** 创建一个 progress_percent 为 50.0 的 ProcessingProgress 并序列化
- **THEN** JSON 中 `progress_percent` 为 50.0，`state` 为对应的 snake_case 字符串

### Requirement: AppError 错误类型
系统 SHALL 定义 `AppError` 枚举使用 `thiserror`，包含 FileNotFound(String)、NefParseError(String)、ExifError(String)、NoEmbeddedJpeg、ImageProcessError(String)、Cancelled、IoError(std::io::Error) 变体。SHALL 实现 `serde::Serialize` trait，序列化为错误消息字符串。

#### Scenario: AppError 序列化为字符串
- **WHEN** 将 `AppError::FileNotFound("test.nef".into())` 序列化
- **THEN** 输出 SHALL 为 `"文件未找到: test.nef"`

#### Scenario: IoError 自动转换
- **WHEN** 一个 `std::io::Error` 通过 `?` 操作符传播
- **THEN** SHALL 自动转换为 `AppError::IoError`
