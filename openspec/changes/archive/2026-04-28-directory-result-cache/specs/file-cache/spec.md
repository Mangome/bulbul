## MODIFIED Requirements

### Requirement: 缓存目录初始化
系统 SHALL 在首次处理时自动创建缓存目录结构：`{app_cache_dir}/bulbul/medium/`、`{app_cache_dir}/bulbul/thumbnail/`、`{app_cache_dir}/bulbul/result/` 和 `{app_cache_dir}/bulbul/groups/`。`app_cache_dir` 通过 Tauri 的 `app.path().cache_dir()` 获取。

#### Scenario: 缓存目录不存在
- **WHEN** 首次运行处理流水线，缓存目录尚未创建
- **THEN** SHALL 递归创建 `medium/`、`thumbnail/`、`result/` 和 `groups/` 子目录

#### Scenario: 缓存目录已存在
- **WHEN** 缓存目录已存在
- **THEN** SHALL 不报错，直接使用已有目录

#### Scenario: 目录创建失败
- **WHEN** 缓存路径不可写（权限不足等）
- **THEN** SHALL 返回 `AppError::IoError` 错误并包含明确的路径信息

### Requirement: 缓存大小计算
系统 SHALL 提供 `get_cache_size(cache_base_dir: &Path)` 异步函数，遍历 `medium/`、`thumbnail/`、`result/` 和 `groups/` 子目录，返回总大小和文件数量。

#### Scenario: 有缓存文件时计算
- **WHEN** 各子目录下有缓存文件
- **THEN** SHALL 返回所有子目录中文件的总大小和总数量

#### Scenario: 空缓存目录时计算
- **WHEN** 所有缓存子目录存在但无文件
- **THEN** SHALL 返回 `(0, 0)`

#### Scenario: 缓存子目录不存在时计算
- **WHEN** 部分子目录不存在
- **THEN** SHALL 视为 0 大小，不报错

### Requirement: 全量缓存清理
系统 SHALL 提供 `clear_all_cache(cache_base_dir: &Path)` 异步函数，删除 `medium/`、`thumbnail/`、`result/` 和 `groups/` 下所有文件，保留目录结构。

#### Scenario: 删除所有缓存文件
- **WHEN** 各子目录下有缓存文件
- **THEN** SHALL 删除所有文件，目录本身保留

#### Scenario: 忽略文件不存在错误
- **WHEN** 删除过程中某个文件已被外部删除
- **THEN** SHALL 忽略 NotFound 错误，继续删除其余文件
