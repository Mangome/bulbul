## ADDED Requirements

### Requirement: 缓存大小计算
系统 SHALL 提供 `get_cache_size(cache_base_dir: &Path)` 异步函数，遍历 `medium/` 和 `thumbnail/` 子目录，返回总大小和文件数量。

#### Scenario: 有缓存文件时计算
- **WHEN** `medium/` 下有 3 个文件（各 1MB），`thumbnail/` 下有 3 个文件（各 100KB）
- **THEN** SHALL 返回 `(3293184, 6)` （约 3.14MB，6 个文件）

#### Scenario: 空缓存目录时计算
- **WHEN** `medium/` 和 `thumbnail/` 目录存在但无文件
- **THEN** SHALL 返回 `(0, 0)`

#### Scenario: 缓存子目录不存在时计算
- **WHEN** `medium/` 或 `thumbnail/` 目录不存在
- **THEN** SHALL 视为 0 大小，不报错

### Requirement: 全量缓存清理
系统 SHALL 提供 `clear_all_cache(cache_base_dir: &Path)` 异步函数，删除 `medium/` 和 `thumbnail/` 下所有文件，保留目录结构。

#### Scenario: 删除所有缓存文件
- **WHEN** `medium/` 和 `thumbnail/` 下各有若干 `.jpg` 文件
- **THEN** SHALL 删除所有文件，目录本身保留

#### Scenario: 忽略文件不存在错误
- **WHEN** 删除过程中某个文件已被外部删除
- **THEN** SHALL 忽略 NotFound 错误，继续删除其余文件

#### Scenario: 其他 IO 错误
- **WHEN** 删除过程中遇到权限不足等 IO 错误
- **THEN** SHALL 返回 `AppError::CacheError` 并包含错误详情
