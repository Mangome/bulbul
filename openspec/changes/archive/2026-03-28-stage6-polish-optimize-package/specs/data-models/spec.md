## MODIFIED Requirements

### Requirement: AppError 错误类型

系统 SHALL 定义 `AppError` 枚举使用 `thiserror`，包含 FileNotFound(String)、NefParseError(String)、ExifError(String)、NoEmbeddedJpeg、ImageProcessError(String)、Cancelled、IoError(std::io::Error)、CacheError(String)、ExportError(String)、ConfigError(String)、HashError(String) 变体。SHALL 实现 `serde::Serialize` trait，序列化为错误消息字符串。每个变体 SHALL 提供 `user_message()` 方法返回中文用户友好提示。

#### Scenario: AppError 序列化为字符串

- **WHEN** 将 `AppError::FileNotFound("test.nef".into())` 序列化
- **THEN** 输出 SHALL 为 `"文件未找到: test.nef"`

#### Scenario: IoError 自动转换

- **WHEN** 一个 `std::io::Error` 通过 `?` 操作符传播
- **THEN** SHALL 自动转换为 `AppError::IoError`

#### Scenario: CacheError 用户消息

- **WHEN** 调用 `AppError::CacheError("disk full".into()).user_message()`
- **THEN** 返回 SHALL 为中文用户友好提示，如 `"缓存操作失败，请检查磁盘空间"`

#### Scenario: ExportError 用户消息

- **WHEN** 调用 `AppError::ExportError("permission denied".into()).user_message()`
- **THEN** 返回 SHALL 为中文用户友好提示，如 `"导出失败，请检查目标目录权限"`

#### Scenario: 新增变体序列化

- **WHEN** 将 `AppError::HashError("invalid input".into())` 序列化
- **THEN** 输出 SHALL 为 `"哈希计算错误: invalid input"`
