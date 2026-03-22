## MODIFIED Requirements

### Requirement: scan_raw_files 命令
系统 SHALL 提供 `scan_raw_files` IPC 命令，接受文件夹路径参数，扫描该目录下所有 `.nef` 文件（大小写不敏感，非递归），返回文件路径列表。扫描完成后 SHALL 更新 `SessionState.current_folder`。

#### Scenario: 扫描包含 NEF 文件的文件夹
- **WHEN** 调用 `scan_raw_files` 传入包含 `.nef` 和 `.NEF` 文件的文件夹路径
- **THEN** 返回所有 NEF 文件的绝对路径列表，大小写不敏感匹配，同时更新 SessionState.current_folder

#### Scenario: 空文件夹
- **WHEN** 调用 `scan_raw_files` 传入一个不包含 NEF 文件的文件夹
- **THEN** 返回空列表

## ADDED Requirements

### Requirement: process_folder 命令
系统 SHALL 提供 `process_folder` IPC 命令，接受文件夹路径和可选参数（similarity_threshold、time_gap_seconds），执行完整的处理流水线：扫描 NEF 文件 → 并发处理每个文件（提取 JPEG + Exif + 缩略图）→ 更新 SessionState 映射 → 推送进度事件 → 返回处理结果。本阶段不执行 pHash 和分组（返回每张图片独立成组的临时结果）。

#### Scenario: 成功处理文件夹
- **WHEN** 调用 `process_folder` 传入包含 10 个 NEF 文件的文件夹路径
- **THEN** SHALL 依次经历 Scanning → Processing → Completed 状态，每处理完一个文件 emit `processing-progress` 事件，最终返回处理结果，SessionState 中 `filename_hash_map`、`hash_filename_map`、`hash_path_map`、`metadata_cache` SHALL 包含 10 条记录

#### Scenario: 空文件夹处理
- **WHEN** 调用 `process_folder` 传入不包含 NEF 文件的文件夹
- **THEN** SHALL 返回空结果（total_images = 0），不报错

#### Scenario: 部分文件处理失败
- **WHEN** 调用 `process_folder`，其中 2 个 NEF 文件损坏
- **THEN** SHALL 继续处理其余文件，损坏文件被跳过但计入错误统计，最终返回成功处理的文件结果

#### Scenario: 并发控制
- **WHEN** 调用 `process_folder` 处理 20 个 NEF 文件
- **THEN** SHALL 最多同时处理 8 个文件（Semaphore 限制）

#### Scenario: 进度事件推送
- **WHEN** 处理过程中
- **THEN** SHALL 在每个文件处理完成后 emit `processing-progress` 事件，payload 为 `ProcessingProgress` 结构，包含正确的 current、total、progress_percent、current_file

### Requirement: cancel_processing 命令
系统 SHALL 提供 `cancel_processing` IPC 命令，设置 `SessionState.cancel_flag` 为 true，使正在进行的处理流水线在完成当前文件后停止。

#### Scenario: 取消正在进行的处理
- **WHEN** `process_folder` 正在执行，调用 `cancel_processing`
- **THEN** SHALL 设置 cancel_flag 为 true，流水线 SHALL 在当前文件完成后检测到取消标志，停止新任务派发，processing_state 转为 Cancelling → Cancelled

#### Scenario: 无进行中的处理时取消
- **WHEN** 没有正在执行的处理流水线，调用 `cancel_processing`
- **THEN** SHALL 成功返回，不报错

### Requirement: get_image_url 命令
系统 SHALL 提供 `get_image_url` IPC 命令，接受图片哈希和尺寸类型（"medium" | "thumbnail"），返回对应缓存文件的本地路径字符串。前端通过 `convertFileSrc` 将路径转为 `asset://` 协议 URL。

#### Scenario: 获取 medium 图片路径
- **WHEN** 调用 `get_image_url` 传入有效 hash 和 size="medium"
- **THEN** SHALL 返回 `{cache_dir}/medium/{hash}.jpg` 的完整路径

#### Scenario: 获取 thumbnail 图片路径
- **WHEN** 调用 `get_image_url` 传入有效 hash 和 size="thumbnail"
- **THEN** SHALL 返回 `{cache_dir}/thumbnail/{hash}.jpg` 的完整路径

#### Scenario: 缓存文件不存在
- **WHEN** 调用 `get_image_url` 传入未处理过的 hash
- **THEN** SHALL 返回错误

### Requirement: get_metadata 命令
系统 SHALL 提供 `get_metadata` IPC 命令，接受图片哈希，从 `SessionState.metadata_cache` 中查找并返回对应的 `ImageMetadata`。

#### Scenario: 获取已缓存的元数据
- **WHEN** 调用 `get_metadata` 传入已处理文件的 hash
- **THEN** SHALL 返回完整的 `ImageMetadata` 结构

#### Scenario: hash 不存在
- **WHEN** 调用 `get_metadata` 传入未知 hash
- **THEN** SHALL 返回错误

### Requirement: get_batch_metadata 命令
系统 SHALL 提供 `get_batch_metadata` IPC 命令，接受多个图片哈希的数组，批量从 `SessionState.metadata_cache` 查找，返回 `HashMap<String, ImageMetadata>`。

#### Scenario: 批量获取元数据
- **WHEN** 调用 `get_batch_metadata` 传入 5 个有效 hash
- **THEN** SHALL 返回包含 5 个条目的 HashMap

#### Scenario: 部分 hash 不存在
- **WHEN** 调用 `get_batch_metadata` 传入 5 个 hash 其中 2 个不存在
- **THEN** SHALL 返回 3 个有效条目的 HashMap，跳过不存在的 hash
