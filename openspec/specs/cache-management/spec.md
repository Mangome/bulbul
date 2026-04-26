## Purpose

提供缓存大小查询、缓存清理 IPC 命令及前端缓存管理交互逻辑。

## Requirements

### Requirement: 缓存大小查询 IPC 命令
系统 SHALL 提供 `get_cache_size` IPC 命令，遍历 `{cache_dir}/medium/` 和 `{cache_dir}/thumbnail/` 目录，返回总大小（字节）、文件数量和缓存目录路径。

#### Scenario: 查询有缓存时的结果
- **WHEN** 缓存目录中有 50 个 medium 文件（共 500MB）和 50 个 thumbnail 文件（共 50MB）
- **THEN** SHALL 返回 `{ totalSize: 576716800, fileCount: 100, cacheDir: "<path>" }`

#### Scenario: 查询空缓存时的结果
- **WHEN** 缓存目录存在但无文件
- **THEN** SHALL 返回 `{ totalSize: 0, fileCount: 0, cacheDir: "<path>" }`

#### Scenario: 缓存目录不存在时的处理
- **WHEN** 缓存目录不存在
- **THEN** SHALL 返回 `{ totalSize: 0, fileCount: 0, cacheDir: "<path>" }`，不报错

### Requirement: 缓存清理 IPC 命令
系统 SHALL 提供 `clear_cache` IPC 命令，删除 `{cache_dir}/medium/` 和 `{cache_dir}/thumbnail/` 目录下所有文件，保留目录结构。

#### Scenario: 清理成功
- **WHEN** 缓存目录中有文件
- **THEN** SHALL 删除所有 `.jpg` 文件，保留 `medium/` 和 `thumbnail/` 目录本身，返回成功

#### Scenario: 清理空缓存
- **WHEN** 缓存目录中无文件
- **THEN** SHALL 不报错，直接返回成功

#### Scenario: 部分文件删除失败
- **WHEN** 部分缓存文件被占用无法删除
- **THEN** SHALL 忽略 NotFound 错误，其他 IO 错误 SHALL 返回 `AppError::CacheError`

### Requirement: 缓存大小格式化
前端 SHALL 提供 `formatCacheSize()` 工具函数，将字节数转换为人类可读格式。

#### Scenario: MB 级别格式化
- **WHEN** 传入 `134217728`（128 MB）
- **THEN** SHALL 返回 `"128.0 MB"`

#### Scenario: GB 级别格式化
- **WHEN** 传入 `1610612736`（1.5 GB）
- **THEN** SHALL 返回 `"1.5 GB"`

#### Scenario: KB 级别格式化
- **WHEN** 传入 `512000`（500 KB）
- **THEN** SHALL 返回 `"500.0 KB"`

#### Scenario: 零字节
- **WHEN** 传入 `0`
- **THEN** SHALL 返回 `"0 B"`

### Requirement: 清理缓存后自动重处理
清理缓存成功后，如果当前有已打开的目录，系统 SHALL 自动触发 `startProcessing(currentFolder)` 重新处理。

#### Scenario: 有已打开目录时自动重处理
- **WHEN** 缓存清理成功且 `currentFolder` 非空
- **THEN** SHALL 清空前端 ImageBitmap 内存缓存，调用 `startProcessing(currentFolder)`，显示 Toast 提示"缓存已清理，正在重新处理..."

#### Scenario: 无已打开目录时仅清缓存
- **WHEN** 缓存清理成功且 `currentFolder` 为空
- **THEN** SHALL 清空前端 ImageBitmap 内存缓存，显示 Toast 提示"缓存已清理"

#### Scenario: 清理失败时不触发重处理
- **WHEN** 缓存清理失败
- **THEN** SHALL 显示错误 Toast 提示，不触发重处理
