## Requirements

### Requirement: 缓存目录初始化
系统 SHALL 在首次处理时自动创建缓存目录结构：`{app_cache_dir}/bulbul/medium/` 和 `{app_cache_dir}/bulbul/thumbnail/`。`app_cache_dir` 通过 Tauri 的 `app.path().cache_dir()` 获取。

#### Scenario: 缓存目录不存在
- **WHEN** 首次运行处理流水线，缓存目录尚未创建
- **THEN** SHALL 递归创建 `medium/` 和 `thumbnail/` 子目录

#### Scenario: 缓存目录已存在
- **WHEN** 缓存目录已存在
- **THEN** SHALL 不报错，直接使用已有目录

#### Scenario: 目录创建失败
- **WHEN** 缓存路径不可写（权限不足等）
- **THEN** SHALL 返回 `AppError::IoError` 错误并包含明确的路径信息

### Requirement: 缓存命中检测
系统 SHALL 根据文件哈希检查 `{cache_dir}/medium/{hash}.jpg` 和 `{cache_dir}/thumbnail/{hash}.jpg` 是否同时存在来判定缓存命中。

#### Scenario: 缓存完全命中
- **WHEN** medium 和 thumbnail 文件均存在
- **THEN** SHALL 返回缓存命中，跳过 JPEG 提取和缩略图生成

#### Scenario: 缓存部分命中
- **WHEN** 仅 medium 存在但 thumbnail 不存在
- **THEN** SHALL 视为缓存未命中，重新处理

#### Scenario: 缓存完全未命中
- **WHEN** medium 和 thumbnail 文件均不存在
- **THEN** SHALL 视为缓存未命中，执行完整处理流程

### Requirement: 缓存文件写入
系统 SHALL 使用 `tokio::fs` 异步写入缓存文件，写入完成后验证文件存在。

#### Scenario: 异步写入 medium 和 thumbnail
- **WHEN** JPEG 提取和缩略图生成成功
- **THEN** SHALL 异步写入两个文件到缓存目录，写入完成后两个文件均 SHALL 存在且大小 > 0

### Requirement: 缓存路径构建
系统 SHALL 提供函数根据文件哈希和类型（medium/thumbnail）构建完整的缓存文件路径。

#### Scenario: 构建 medium 缓存路径
- **WHEN** 哈希为 `"abc123"`, 类型为 `medium`
- **THEN** 返回 `{cache_dir}/medium/abc123.jpg`

#### Scenario: 构建 thumbnail 缓存路径
- **WHEN** 哈希为 `"abc123"`, 类型为 `thumbnail`
- **THEN** 返回 `{cache_dir}/thumbnail/abc123.jpg`
